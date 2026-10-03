import { useState, useEffect } from 'react';
import { Icon, type IconName } from './Icon';
import * as LocalTranslateService from '../../bindings/ltools/plugins/localtranslate/localtranslateservice';
import type { ProviderStatus, TranslationResult } from '../../bindings/ltools/plugins/localtranslate/models';
import { ProviderType } from '../../bindings/ltools/plugins/localtranslate/models';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge, Button, EmptyState, IconButton, Spinner } from './ui';
import { SetupWizard } from './SetupWizard';
import { useToast } from '../hooks/useToast';

/**
 * LocalTranslateWidget - 多供应商翻译组件
 *
 * 支持多种翻译供应商：
 * - Ollama (本地 LLM 服务)
 * - OpenAI (GPT-4o-mini)
 * - Anthropic (Claude 3.5 Sonnet)
 * - DeepSeek (DeepSeek Chat)
 */

const PROVIDER_NAMES: Record<string, string> = {
  [ProviderType.ProviderOpenAI]: 'OpenAI',
  [ProviderType.ProviderAnthropic]: 'Anthropic',
  [ProviderType.ProviderDeepSeek]: 'DeepSeek',
  [ProviderType.ProviderOllama]: 'Ollama',
};

const PROVIDER_ICONS: Record<string, IconName> = {
  [ProviderType.ProviderOpenAI]: 'sparkles',
  [ProviderType.ProviderAnthropic]: 'cpu',
  [ProviderType.ProviderDeepSeek]: 'code',
  [ProviderType.ProviderOllama]: 'server',
};

const LANGUAGES = [
  { code: 'zh', name: '中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
];

export function LocalTranslateWidget(): JSX.Element {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState('zh');
  const [targetLang, setTargetLang] = useState('en');

  // 供应商状态
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [isFirstUse, setIsFirstUse] = useState(false);

  // Toast 通知
  const { success, error: showError } = useToast();

  // 初始化：检查供应商状态
  useEffect(() => {
    loadProviderStatuses();
  }, []);

  const loadProviderStatuses = async () => {
    try {
      const statuses = await LocalTranslateService.GetProviderStatuses();
      setProviderStatuses(statuses);

      // 检查是否是首次使用
      const hasAvailable = statuses.some(s => s.available);
      setIsFirstUse(!hasAvailable);
    } catch (err) {
        console.error('Failed to load provider statuses:', err);
    }
  };

  // 交换语言
  const handleSwapLanguages = () => {
    const tempLang = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(tempLang);
    // 同时交换文本
    const tempInput = inputText;
    setInputText(outputText);
    setOutputText(tempInput);
  };

  // 执行翻译
  const handleTranslate = async () => {
    if (!inputText.trim()) {
      setError('请输入要翻译的文本');
      return;
    }

    // 检查是否有可用的供应商
    const availableProviders = providerStatuses.filter(s => s.available);
    if (availableProviders.length === 0) {
      setError('没有可用的翻译供应商，请先配置');
      setShowSetupWizard(true);
      return;
    }

    setLoading(true);
    setError(null);
    setActiveProvider(null);

    try {
      const result: TranslationResult | null = await LocalTranslateService.Translate(inputText, sourceLang, targetLang);
      if (result) {
        setOutputText(result.translatedText || '');
        setActiveProvider(result.provider || null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '翻译失败，请重试';
      setError(errorMessage);
      console.error('Translation error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 复制翻译结果
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(outputText);
      success('已复制到剪贴板');
    } catch (err) {
      console.error('Failed to copy:', err);
      showError('复制失败');
    }
  };

  // 首次使用引导
  if (isFirstUse && !showSetupWizard) {
    return (
      <EmptyState
        icon="language"
        title="欢迎使用智能翻译"
        description="支持多种 AI 翻译服务，包括本地 Ollama 和云端 API"
        className="py-12"
        action={
          <Button variant="primary" onClick={() => setShowSetupWizard(true)}>
            开始配置
          </Button>
        }
      />
    );
  }

  // 配置向导
  if (showSetupWizard) {
    return (
      <SetupWizard
        isOpen={showSetupWizard}
        onClose={() => {
          setShowSetupWizard(false);
          loadProviderStatuses();
        }}
        onComplete={() => {
          setShowSetupWizard(false);
          setIsFirstUse(false);
          loadProviderStatuses();
        }}
      />
    );
  }

  const getLanguageInfo = (code: string) =>
    LANGUAGES.find(l => l.code === code) || { code, name: code };

  const availableProviders = providerStatuses.filter(s => s.available);

  const renderLanguageSelect = (
    value: string,
    onChange: (code: string) => void,
    ariaLabel: string
  ) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-36" aria-label={ariaLabel}>
        <SelectValue>
          <span className="truncate">{getLanguageInfo(value).name}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map(lang => (
          <SelectItem key={lang.code} value={lang.code}>
            <span className="flex items-center gap-2">
              <span>{lang.name}</span>
              <span className="font-mono text-[10.5px] uppercase text-text-4">{lang.code}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4">
      {/* 工具行：可用供应商 + 设置 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          {availableProviders.slice(0, 3).map(status => (
            <Badge key={status.type} tone="neutral" className="gap-1.5">
              <Icon name={PROVIDER_ICONS[status.type] || 'cube'} size={12} />
              <span>{PROVIDER_NAMES[status.type] || status.type}</span>
            </Badge>
          ))}
          {availableProviders.length === 0 && (
            <span className="text-[12px] text-text-4">暂无可用供应商，请先配置</span>
          )}
        </div>
        <IconButton name="cog" label="设置" onClick={() => setShowSetupWizard(true)} />
      </div>

      {/* 语言选择器 */}
      <div className="card flex items-center justify-center gap-3 px-4 py-3">
        {renderLanguageSelect(sourceLang, setSourceLang, '源语言')}
        <IconButton name="refresh-cw" label="交换语言" onClick={handleSwapLanguages} />
        {renderLanguageSelect(targetLang, setTargetLang, '目标语言')}
      </div>

      {/* 源文 / 译文双栏 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 输入面板 */}
        <div className="card relative flex min-h-[360px] min-w-0 flex-col p-4">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="输入要翻译的文本..."
            aria-label="源文本"
            className="input min-h-0 flex-1 resize-none border-0 bg-transparent px-0 py-0 text-[13.5px] leading-relaxed"
          />
          <div className="hairline-t mt-3 flex items-center justify-between pt-2.5">
            <span className="tnum text-[11.5px] text-text-4">{inputText.length} 字符</span>
            {inputText && (
              <button
                className="icon-btn icon-btn-sm"
                onClick={() => setInputText('')}
                title="清空输入"
                aria-label="清空输入"
              >
                <Icon name="x-mark" size={13} />
              </button>
            )}
          </div>
        </div>

        {/* 输出面板 */}
        <div className="card relative flex min-h-[360px] min-w-0 flex-col p-4">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="flex flex-col items-center gap-2.5">
                <Spinner size={20} />
                <span className="text-[12px] text-text-3">翻译中...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-1 items-center justify-center p-2">
              <div className="flex flex-col items-center gap-2.5 text-center">
                <Icon name="exclamation-circle" size={22} color="var(--color-error-text)" />
                <p className="text-[12px] leading-relaxed text-error-text">{error}</p>
              </div>
            </div>
          ) : outputText ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <p className="break-words whitespace-pre-wrap text-[13.5px] leading-relaxed text-text-1 select-text">
                  {outputText}
                </p>
              </div>
              <div className="hairline-t mt-3 flex items-center justify-between gap-3 pt-2.5">
                {activeProvider ? (
                  <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-text-3">
                    <Icon name={PROVIDER_ICONS[activeProvider] || 'cube'} size={13} className="shrink-0" />
                    <span className="truncate">使用 {PROVIDER_NAMES[activeProvider] || activeProvider}</span>
                  </span>
                ) : (
                  <span />
                )}
                <Button variant="ghost" size="sm" icon="clipboard" onClick={handleCopy}>
                  复制
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="flex flex-col items-center gap-2.5">
                <Icon name="language" size={26} color="var(--color-text-4)" />
                <p className="text-[12px] text-text-4">翻译结果将显示在这里</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 翻译按钮 */}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        icon="language"
        loading={loading}
        disabled={!inputText.trim()}
        onClick={handleTranslate}
      >
        {loading ? '翻译中…' : '翻译'}
      </Button>
    </div>
  );
}
