import { useState, useEffect, useCallback } from 'react';
import { Icon, type IconName } from './Icon';
import * as LocalTranslateService from '../../bindings/ltools/plugins/localtranslate/localtranslateservice';
import { ProviderType, type ProviderStatus } from '../../bindings/ltools/plugins/localtranslate/models';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge, Button, Field, IconButton, Input, Spinner } from './ui';

/**
 * SetupWizard - 多供应商翻译配置向导
 *
 * 3步向导流程：
 * 1. 选择供应商
 * 2. 配置供应商
 * 3. 测试连接
 */

interface SetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface ProviderConfig {
  type: ProviderType;
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
}

interface OllamaModel {
  name: string;
  size: number;
  modified: string;
}

const PROVIDER_INFO: Record<string, { name: string; description: string; icon: IconName; requiresApiKey: boolean; requiresBaseUrl: boolean; supportsCustomBaseUrl: boolean; defaultModel: string; defaultBaseUrl: string }> = {
  [ProviderType.ProviderOpenAI]: {
    name: 'OpenAI',
    description: '使用 GPT-4o-mini 进行翻译',
    icon: 'sparkles',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsCustomBaseUrl: true,  // 支持自定义 baseUrl
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  [ProviderType.ProviderAnthropic]: {
    name: 'Anthropic',
    description: '使用 Claude 3.5 Sonnet 进行翻译',
    icon: 'cpu',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsCustomBaseUrl: true,  // 支持自定义 baseUrl
    defaultModel: 'claude-3-5-sonnet-20241022',
    defaultBaseUrl: 'https://api.anthropic.com',
  },
  [ProviderType.ProviderDeepSeek]: {
    name: 'DeepSeek',
    description: '使用 DeepSeek Chat 进行翻译',
    icon: 'code',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsCustomBaseUrl: true,  // 支持自定义 baseUrl
    defaultModel: 'deepseek-chat',
    defaultBaseUrl: 'https://api.deepseek.com',
  },
  [ProviderType.ProviderOllama]: {
    name: 'Ollama',
    description: '本地运行的 Ollama 服务',
    icon: 'server',
    requiresApiKey: false,
    requiresBaseUrl: true,  // 必须填写
    supportsCustomBaseUrl: true,
    defaultModel: 'qwen2.5:3b',
    defaultBaseUrl: 'http://localhost:11434',
  },
};

const STEP_LABELS = ['选择供应商', '配置参数', '测试连接'] as const;

export function SetupWizard({ isOpen, onClose, onComplete }: SetupWizardProps): JSX.Element | null {
  const [step, setStep] = useState(1);
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<ProviderType[]>([]);
  const [configs, setConfigs] = useState<Record<ProviderType, ProviderConfig>>({} as Record<ProviderType, ProviderConfig>);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<Partial<Record<ProviderType, { success: boolean; message: string }>>>({});
  const [loading, setLoading] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [detectingOllama, setDetectingOllama] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化：获取供应商状态
  useEffect(() => {
    if (isOpen) {
      loadProviderStatuses();
    }
  }, [isOpen]);

  const loadProviderStatuses = async () => {
    try {
      setLoading(true);
      const statuses = await LocalTranslateService.GetProviderStatuses();
      setProviderStatuses(statuses);

      // 初始化选中的供应商（默认启用本地模型）
      const enabled = statuses
        .filter(s => s.enabled)
        .map(s => s.type);
      setSelectedProviders(enabled);

      // 初始化配置
      const initialConfigs: Record<ProviderType, ProviderConfig> = {} as Record<ProviderType, ProviderConfig>;
      statuses.forEach(status => {
        const info = PROVIDER_INFO[status.type];
        initialConfigs[status.type] = {
          type: status.type,
          enabled: status.enabled,
          apiKey: '',
          baseUrl: info?.defaultBaseUrl || '',
          model: status.model || info?.defaultModel || '',
          maxTokens: 1024,
        };
      });
      setConfigs(initialConfigs);
    } catch (err) {
      console.error('Failed to load provider statuses:', err);
      setError('加载供应商状态失败');
    } finally {
      setLoading(false);
    }
  };

  // 检测 Ollama 服务
  const detectOllama = useCallback(async (baseUrl: string) => {
    setDetectingOllama(true);
    try {
      // 尝试获取 Ollama 模型列表
      const models = await LocalTranslateService.DetectOllamaModels(baseUrl);
      {
        setOllamaModels(models);

        // 自动选择第一个模型
        if (models.length > 0 && !configs[ProviderType.ProviderOllama]?.model) {
          updateConfig(ProviderType.ProviderOllama, { model: models[0].name });
        }

        return { success: true, message: `检测到 ${models.length} 个模型` };
      }
    } catch (err) {
      return { success: false, message: 'Ollama 服务未运行' };
    } finally {
      setDetectingOllama(false);
    }
  }, [configs]);

  // 更新配置
  const updateConfig = (type: ProviderType, updates: Partial<ProviderConfig>) => {
    setConfigs(prev => ({
      ...prev,
      [type]: { ...prev[type], ...updates },
    }));
  };

  // 切换供应商选择
  const toggleProvider = (type: ProviderType) => {
    setSelectedProviders(prev => {
      const isSelected = prev.includes(type);
      if (isSelected) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });

    // 更新配置中的启用状态
    updateConfig(type, { enabled: !selectedProviders.includes(type) });
  };

  // 测试单个供应商
  const testProvider = async (type: ProviderType): Promise<{ success: boolean; message: string }> => {
    const config = configs[type];
    const info = PROVIDER_INFO[type];

    try {
      switch (type) {
        case ProviderType.ProviderOllama:
          if (!config.baseUrl) {
            return { success: false, message: '请填写 Ollama 服务地址' };
          }
          const result = await detectOllama(config.baseUrl);
          return result;

        default:
          // 云端 API 供应商
          if (info.requiresApiKey && !config.apiKey) {
            return { success: false, message: '请输入 API Key' };
          }

          // 尝试翻译测试
          try {
            const testResult = await LocalTranslateService.TranslateWithProvider(
              'Hello',
              'en',
              'zh',
              type
            );
            if (testResult) {
              return { success: true, message: '连接成功' };
            }
            return { success: false, message: '翻译失败' };
          } catch (err) {
            const message = err instanceof Error ? err.message : '连接失败';
            return { success: false, message };
          }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '测试失败';
      return { success: false, message };
    }
  };

  // 测试所有选中的供应商
  const testAllProviders = async () => {
    setTesting(true);
    setTestResults({});

    const results: Partial<Record<ProviderType, { success: boolean; message: string }>> = {};

    for (const type of selectedProviders) {
      results[type] = await testProvider(type);
    }

    setTestResults(results);
    setTesting(false);
  };

  // 保存配置
  const saveConfig = async () => {
    try {
      setLoading(true);

      // 配置并启用选中的供应商
      for (const type of selectedProviders) {
        const config = configs[type];
        if (config) {
          const input = {
            apiKey: config.apiKey || '',
            baseUrl: config.baseUrl || '',
            model: config.model || '',
            maxTokens: config.maxTokens || 1024,
          };

          console.log(`Configuring provider ${type}:`, input);
          await LocalTranslateService.ConfigureProvider(type, input);
        }
      }

      // 禁用未选中的供应商
      const allTypes = Object.values(ProviderType).filter(t => t !== ProviderType.$zero);
      for (const type of allTypes) {
        if (!selectedProviders.includes(type)) {
          await LocalTranslateService.SetProviderEnabled(type, false);
        }
      }

      onComplete();
      onClose();
    } catch (err) {
      console.error('Failed to save config:', err);
      setError('保存配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 重置并关闭
  const handleClose = () => {
    setStep(1);
    setSelectedProviders([]);
    setConfigs({} as Record<ProviderType, ProviderConfig>);
    setTestResults({});
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="scrim fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div className="absolute inset-0" onClick={handleClose} />

      {/* 向导容器 */}
      <div
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[12px] border border-hairline-strong bg-surface-2"
        style={{ boxShadow: 'var(--shadow-modal)' }}
        role="dialog"
        aria-modal="true"
      >
        {/* 头部 */}
        <div className="hairline-b flex shrink-0 items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Icon name="language" size={18} className="text-accent-text" />
            <h2 className="text-[14px] font-semibold text-text-1">翻译供应商配置</h2>
          </div>
          <IconButton name="x" label="关闭向导" size="sm" onClick={handleClose} disabled={loading} />
        </div>

        {/* 步骤指示器 */}
        <div className="hairline-b flex shrink-0 items-center justify-center gap-2 px-5 py-3">
          {STEP_LABELS.map((label, i) => {
            const s = i + 1;
            const isCurrent = s === step;
            const isDone = s < step;
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={
                    isCurrent
                      ? { background: 'var(--color-accent)', color: '#fff' }
                      : isDone
                        ? { background: 'var(--color-accent-subtle)', color: 'var(--color-accent-text)' }
                        : { background: 'var(--color-surface-4)', color: 'var(--color-text-3)' }
                  }
                >
                  {isDone ? <Icon name="check" size={12} /> : s}
                </div>
                <span className={`text-[12px] ${isCurrent ? 'font-medium text-text-1' : 'text-text-3'}`}>
                  {label}
                </span>
                {s < STEP_LABELS.length && <div className="mx-1 h-px w-8 bg-hairline" />}
              </div>
            );
          })}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-5 mt-4 flex shrink-0 items-center gap-2 rounded-[7px] border border-error/20 bg-error/10 px-3 py-2">
            <Icon name="exclamation-circle" size={15} className="shrink-0 text-error-text" />
            <span className="text-[12.5px] text-error-text">{error}</span>
          </div>
        )}

        {/* 内容区域 */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading && providerStatuses.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size={20} />
            </div>
          ) : (
            <>
              {/* 步骤 1: 选择供应商 */}
              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-[12.5px] text-text-2">
                    选择您想要使用的翻译供应商。系统会按照优先级自动选择可用的供应商。
                  </p>

                  <div className="grid grid-cols-1 gap-2">
                    {providerStatuses.map((status) => {
                      const info = PROVIDER_INFO[status.type];
                      const isSelected = selectedProviders.includes(status.type);

                      return (
                        <div
                          key={status.type}
                          onClick={() => toggleProvider(status.type)}
                          className={`cursor-pointer rounded-[9px] border p-3.5 transition-colors duration-150 ${
                            isSelected
                              ? 'border-accent bg-accent-subtle'
                              : 'border-hairline bg-surface-1 hover:border-hairline-strong'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] border border-hairline bg-surface-2">
                              <Icon
                                name={info.icon}
                                size={17}
                                className={isSelected ? 'text-accent-text' : 'text-text-3'}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-[12.5px] font-medium text-text-1">{info.name}</h3>
                                {status.available && <Badge tone="success">可用</Badge>}
                              </div>
                              <p className="mt-0.5 text-[11.5px] text-text-3">{info.description}</p>
                              <p className="tnum mt-0.5 truncate font-mono text-[11px] text-text-4">
                                模型: {status.model || info.defaultModel}
                              </p>
                            </div>
                            <div
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                isSelected ? 'border-accent' : 'border-hairline-strong'
                              }`}
                              style={isSelected ? { background: 'var(--color-accent)', color: '#fff' } : undefined}
                            >
                              {isSelected && <Icon name="check" size={11} />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 步骤 2: 配置供应商 */}
              {step === 2 && (
                <div className="space-y-5">
                  <p className="text-[12.5px] text-text-2">
                    为选中的供应商配置参数。API Key 可以稍后从环境变量读取。
                  </p>

                  {selectedProviders.map((type) => {
                    const info = PROVIDER_INFO[type];
                    const config = configs[type];

                    if (!config) return null;

                    return (
                      <div key={type} className="card-inset p-4">
                        <div className="hairline-b mb-3 flex items-center gap-2 pb-2.5">
                          <Icon name={info.icon} size={16} className="text-text-2" />
                          <h3 className="text-[12.5px] font-medium text-text-1">{info.name}</h3>
                        </div>

                        <div className="space-y-3.5">
                          {/* API Key */}
                          {info.requiresApiKey && (
                            <Field
                              label="API Key"
                              hint={`环境变量: ${type === ProviderType.ProviderOpenAI ? 'OPENAI_API_KEY' : type === ProviderType.ProviderAnthropic ? 'ANTHROPIC_API_KEY' : 'DEEPSEEK_API_KEY'}（可选，优先从环境变量读取）`}
                            >
                              <Input
                                type="password"
                                value={config.apiKey}
                                onChange={(e) => updateConfig(type, { apiKey: e.target.value })}
                                placeholder={`输入 ${info.name} API Key`}
                              />
                            </Field>
                          )}

                          {/* Base URL */}
                          {(info.requiresBaseUrl || info.supportsCustomBaseUrl) && (
                            <Field
                              label="服务地址"
                              hint={info.requiresBaseUrl ? undefined : `可选，留空使用默认地址 ${info.defaultBaseUrl}`}
                            >
                              <div className="flex gap-2">
                                <Input
                                  type="text"
                                  className="flex-1"
                                  value={config.baseUrl}
                                  onChange={(e) => updateConfig(type, { baseUrl: e.target.value })}
                                  placeholder={info.defaultBaseUrl}
                                />
                                {type === ProviderType.ProviderOllama && (
                                  <Button
                                    variant="secondary"
                                    onClick={() => detectOllama(config.baseUrl || info.defaultBaseUrl)}
                                    disabled={detectingOllama}
                                    loading={detectingOllama}
                                  >
                                    {detectingOllama ? '检测中...' : '检测'}
                                  </Button>
                                )}
                              </div>
                            </Field>
                          )}

                          {/* 模型选择 */}
                          <Field label="模型">
                            {type === ProviderType.ProviderOllama && ollamaModels.length > 0 ? (
                              <Select
                                value={config.model}
                                onValueChange={(value) => updateConfig(type, { model: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="选择模型" />
                                </SelectTrigger>
                                <SelectContent>
                                  {ollamaModels.map((model) => (
                                    <SelectItem key={model.name} value={model.name}>
                                      {model.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                type="text"
                                value={config.model}
                                onChange={(e) => updateConfig(type, { model: e.target.value })}
                                placeholder={info.defaultModel}
                              />
                            )}
                          </Field>

                          {/* Max Tokens */}
                          <Field label="最大 Token 数">
                            <Input
                              type="number"
                              className="tnum w-32"
                              value={config.maxTokens}
                              onChange={(e) => updateConfig(type, { maxTokens: parseInt(e.target.value) || 1024 })}
                              min={100}
                              max={4096}
                            />
                          </Field>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 步骤 3: 测试连接 */}
              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-[12.5px] text-text-2">
                    测试与各个供应商的连接状态。测试成功后即可开始使用翻译功能。
                  </p>

                  <Button
                    variant="primary"
                    icon="refresh-cw"
                    onClick={testAllProviders}
                    disabled={testing || selectedProviders.length === 0}
                    loading={testing}
                  >
                    {testing ? '测试中...' : '开始测试'}
                  </Button>

                  {/* 测试结果 */}
                  {Object.keys(testResults).length > 0 && (
                    <div className="space-y-1.5">
                      {selectedProviders.map((type) => {
                        const info = PROVIDER_INFO[type];
                        const result = testResults?.[type];

                        return (
                          <div
                            key={type}
                            className={`flex items-center gap-2.5 rounded-[7px] border px-3 py-2.5 ${
                              result
                                ? result.success
                                  ? 'border-success/20 bg-success/10'
                                  : 'border-error/20 bg-error/10'
                                : 'border-hairline bg-surface-1'
                            }`}
                          >
                            <Icon name={info.icon} size={15} className="shrink-0 text-text-3" />
                            <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-1">{info.name}</span>
                            {result && (
                              <>
                                <Icon
                                  name={result.success ? 'check-circle' : 'x-circle'}
                                  size={15}
                                  className={`shrink-0 ${result.success ? 'text-success-text' : 'text-error-text'}`}
                                />
                                <span className={`text-[11.5px] ${result.success ? 'text-success-text' : 'text-error-text'}`}>
                                  {result.message}
                                </span>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="hairline-t flex shrink-0 items-center justify-between px-5 py-3.5">
          <Button
            variant="ghost"
            onClick={step === 1 ? handleClose : () => setStep(step - 1)}
            disabled={loading}
          >
            {step === 1 ? '取消' : '上一步'}
          </Button>

          {step < 3 ? (
            <Button
              variant="primary"
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && selectedProviders.length === 0}
            >
              下一步
            </Button>
          ) : (
            <Button
              variant="primary"
              icon="check"
              onClick={saveConfig}
              disabled={loading}
              loading={loading}
            >
              {loading ? '保存中...' : '完成配置'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
