import { useState, useEffect, useCallback } from 'react';
import { Icon } from './Icon';
import * as LocalTranslateService from '../../bindings/ltools/plugins/localtranslate/localtranslateservice';
import { ProviderType, type ProviderStatus } from '../../bindings/ltools/plugins/localtranslate/models';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { t as tI18n, t } from '@/i18n';

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

const PROVIDER_INFO: Record<string, { name: string; description: string; icon: string; requiresApiKey: boolean; requiresBaseUrl: boolean; supportsCustomBaseUrl: boolean; defaultModel: string; defaultBaseUrl: string }> = {
  [ProviderType.ProviderOpenAI]: {
    name: 'OpenAI',
    description: tI18n('使用 GPT-4o-mini 进行翻译'),
    icon: 'sparkles',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsCustomBaseUrl: true,  // 支持自定义 baseUrl
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  [ProviderType.ProviderAnthropic]: {
    name: 'Anthropic',
    description: tI18n('使用 Claude 3.5 Sonnet 进行翻译'),
    icon: 'cpu',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsCustomBaseUrl: true,  // 支持自定义 baseUrl
    defaultModel: 'claude-3-5-sonnet-20241022',
    defaultBaseUrl: 'https://api.anthropic.com',
  },
  [ProviderType.ProviderDeepSeek]: {
    name: 'DeepSeek',
    description: tI18n('使用 DeepSeek Chat 进行翻译'),
    icon: 'code',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsCustomBaseUrl: true,  // 支持自定义 baseUrl
    defaultModel: 'deepseek-chat',
    defaultBaseUrl: 'https://api.deepseek.com',
  },
  [ProviderType.ProviderOllama]: {
    name: 'Ollama',
    description: tI18n('本地运行的 Ollama 服务'),
    icon: 'server',
    requiresApiKey: false,
    requiresBaseUrl: true,  // 必须填写
    supportsCustomBaseUrl: true,
    defaultModel: 'qwen2.5:3b',
    defaultBaseUrl: 'http://localhost:11434',
  },
};

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
      setError(tI18n('加载供应商状态失败'));
    } finally {
      setLoading(false);
    }
  };

  // 检测 Ollama 服务
  const detectOllama = useCallback(async (baseUrl: string) => {
    setDetectingOllama(true);
    try {
      // 尝试获取 Ollama 模型列表
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        const models = data.models?.map((m: any) => ({
          name: m.name,
          size: m.size,
          modified: m.modified,
        })) || [];
        setOllamaModels(models);

        // 自动选择第一个模型
        if (models.length > 0 && !configs[ProviderType.ProviderOllama]?.model) {
          updateConfig(ProviderType.ProviderOllama, { model: models[0].name });
        }

        return { success: true, message: t('检测到 {n} 个模型', { n: models.length }) };
      } else {
        return { success: false, message: tI18n('无法连接到 Ollama 服务') };
      }
    } catch (err) {
      return { success: false, message: tI18n('Ollama 服务未运行') };
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
            return { success: false, message: tI18n('请填写 Ollama 服务地址') };
          }
          const result = await detectOllama(config.baseUrl);
          return result;

        default:
          // 云端 API 供应商
          if (info.requiresApiKey && !config.apiKey) {
            return { success: false, message: tI18n('请输入 API Key') };
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
              return { success: true, message: tI18n('连接成功') };
            }
            return { success: false, message: tI18n('翻译失败') };
          } catch (err) {
            const message = err instanceof Error ? err.message : tI18n('连接失败');
            return { success: false, message };
          }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : tI18n('测试失败');
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
      setError(tI18n('保存配置失败'));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* 向导容器 */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-[#1A1F2E] border border-white/10 shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Icon name="language" size={24} color="#7C3AED" />
            <h2 className="text-xl font-bold text-white">{tI18n('翻译供应商配置')}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* 步骤指示器 */}
        <div className="flex items-center justify-center gap-4 p-4 bg-white/5">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  s === step
                    ? 'bg-[#7C3AED] text-white'
                    : s < step
                    ? 'bg-green-500 text-white'
                    : 'bg-white/10 text-white/40'
                }`}
              >
                {s < step ? <Icon name="check" size={16} /> : s}
              </div>
              <span
                className={`text-sm ${
                  s === step ? 'text-white' : 'text-white/40'
                }`}
              >
                {s === 1 ? tI18n('选择供应商') : s === 2 ? tI18n('配置参数') : tI18n('测试连接')}
              </span>
              {s < 3 && <div className="w-8 h-px bg-white/10 ml-2" />}
            </div>
          ))}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
            <Icon name="exclamation-circle" size={18} color="#EF4444" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {/* 步骤 1: 选择供应商 */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-white/60 text-sm mb-4">
                {tI18n('选择您想要使用的翻译供应商。系统会按照优先级自动选择可用的供应商。')}
              </p>

              <div className="grid grid-cols-1 gap-3">
                {providerStatuses.map((status) => {
                  const info = PROVIDER_INFO[status.type];
                  const isSelected = selectedProviders.includes(status.type);

                  return (
                    <div
                      key={status.type}
                      onClick={() => toggleProvider(status.type)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#7C3AED]/20 border-[#7C3AED]'
                          : 'bg-white/5 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-[#7C3AED]' : 'bg-white/10'
                          }`}
                        >
                          <Icon
                            name={info.icon as any}
                            size={20}
                            color={isSelected ? 'white' : '#A78BFA'}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-white">{info.name}</h3>
                            {status.available && (
                              <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
                                {tI18n('可用')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-white/50 mt-1">{info.description}</p>
                          <p className="text-xs text-white/30 mt-1">
                            {tI18n('模型:')} {status.model || info.defaultModel}
                          </p>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? 'border-[#7C3AED] bg-[#7C3AED]'
                              : 'border-white/30'
                          }`}
                        >
                          {isSelected && <Icon name="check" size={14} color="white" />}
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
            <div className="space-y-6">
              <p className="text-white/60 text-sm">
                {tI18n('为选中的供应商配置参数。API Key 可以稍后从环境变量读取。')}
              </p>

              {selectedProviders.map((type) => {
                const info = PROVIDER_INFO[type];
                const config = configs[type];

                if (!config) return null;

                return (
                  <div key={type} className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-3 mb-4">
                      <Icon name={info.icon as any} size={20} color="#7C3AED" />
                      <h3 className="font-medium text-white">{info.name}</h3>
                    </div>

                    <div className="space-y-4">
                      {/* API Key */}
                      {info.requiresApiKey && (
                        <div>
                          <label className="block text-sm text-white/60 mb-2">
                            API Key
                            <span className="text-white/30 ml-1">{tI18n('(可选，优先从环境变量读取)')}</span>
                          </label>
                          <input
                            type="password"
                            value={config.apiKey}
                            onChange={(e) => updateConfig(type, { apiKey: e.target.value })}
                            placeholder={t('输入 {name} API Key', { name: info.name })}
                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#7C3AED] transition-colors"
                          />
                          <p className="text-xs text-white/30 mt-1">
                            {tI18n('环境变量:')} {type === ProviderType.ProviderOpenAI ? 'OPENAI_API_KEY' : type === ProviderType.ProviderAnthropic ? 'ANTHROPIC_API_KEY' : 'DEEPSEEK_API_KEY'}
                          </p>
                        </div>
                      )}

                      {/* Base URL */}
                      {(info.requiresBaseUrl || info.supportsCustomBaseUrl) && (
                        <div>
                          <label className="block text-sm text-white/60 mb-2">
                            {tI18n('服务地址')}
                            {!info.requiresBaseUrl && (
                              <span className="text-white/30 ml-1">{tI18n('(可选，留空使用默认地址)')}</span>
                            )}
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={config.baseUrl}
                              onChange={(e) => updateConfig(type, { baseUrl: e.target.value })}
                              placeholder={info.defaultBaseUrl}
                              className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#7C3AED] transition-colors"
                            />
                            {type === ProviderType.ProviderOllama && (
                              <button
                                onClick={() => detectOllama(config.baseUrl || info.defaultBaseUrl)}
                                disabled={detectingOllama}
                                className="px-4 py-2 rounded-lg bg-[#7C3AED]/20 hover:bg-[#7C3AED]/30 text-[#A78BFA] text-sm font-medium transition-colors disabled:opacity-50"
                              >
                                {detectingOllama ? tI18n('检测中...') : tI18n('检测')}
                              </button>
                            )}
                          </div>
                          {!info.requiresBaseUrl && (
                            <p className="text-xs text-white/30 mt-1">
                              {tI18n('默认:')} {info.defaultBaseUrl}
                            </p>
                          )}
                        </div>
                      )}

                      {/* 模型选择 */}
                      <div>
                        <label className="block text-sm text-white/60 mb-2">{tI18n('模型')}</label>
                        {type === ProviderType.ProviderOllama && ollamaModels.length > 0 ? (
                          <Select
                            value={config.model}
                            onValueChange={(value) => updateConfig(type, { model: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={tI18n("选择模型")} />
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
                          <input
                            type="text"
                            value={config.model}
                            onChange={(e) => updateConfig(type, { model: e.target.value })}
                            placeholder={info.defaultModel}
                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#7C3AED] transition-colors"
                          />
                        )}
                      </div>

                      {/* Max Tokens */}
                      <div>
                        <label className="block text-sm text-white/60 mb-2">{tI18n('最大 Token 数')}</label>
                        <input
                          type="number"
                          value={config.maxTokens}
                          onChange={(e) => updateConfig(type, { maxTokens: parseInt(e.target.value) || 1024 })}
                          min={100}
                          max={4096}
                          className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#7C3AED] transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 步骤 3: 测试连接 */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-white/60 text-sm">
                {tI18n('测试与各个供应商的连接状态。测试成功后即可开始使用翻译功能。')}
              </p>

              <button
                onClick={testAllProviders}
                disabled={testing || selectedProviders.length === 0}
                className="w-full py-3 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                {testing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{tI18n('测试中...')}</span>
                  </>
                ) : (
                  <>
                    <Icon name="refresh-cw" size={18} />
                    <span>{tI18n('开始测试')}</span>
                  </>
                )}
              </button>

              {/* 测试结果 */}
              {Object.keys(testResults).length > 0 && (
                <div className="space-y-2 mt-4">
                  {selectedProviders.map((type) => {
                    const info = PROVIDER_INFO[type];
                    const result = testResults?.[type];

                    return (
                      <div
                        key={type}
                        className={`p-3 rounded-lg border flex items-center gap-3 ${
                          result
                            ? result.success
                              ? 'bg-green-500/10 border-green-500/20'
                              : 'bg-red-500/10 border-red-500/20'
                            : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <Icon
                          name={info.icon as any}
                          size={18}
                          color={result ? (result.success ? '#22C55E' : '#EF4444') : '#9CA3AF'}
                        />
                        <span className="text-sm text-white flex-1">{info.name}</span>
                        {result && (
                          <>
                            <Icon
                              name={result.success ? 'check-circle' : 'x-circle'}
                              size={18}
                              color={result.success ? '#22C55E' : '#EF4444'}
                            />
                            <span
                              className={`text-xs ${
                                result.success ? 'text-green-400' : 'text-red-400'
                              }`}
                            >
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
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between p-6 border-t border-white/10 bg-white/5">
          <button
            onClick={step === 1 ? handleClose : () => setStep(step - 1)}
            className="px-6 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
          >
            {step === 1 ? tI18n('取消') : tI18n('上一步')}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && selectedProviders.length === 0}
              className="px-6 py-2 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              {tI18n('下一步')}
            </button>
          ) : (
            <button
              onClick={saveConfig}
              disabled={loading}
              className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{tI18n('保存中...')}</span>
                </>
              ) : (
                <>
                  <Icon name="check" size={18} />
                  <span>{tI18n('完成配置')}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
