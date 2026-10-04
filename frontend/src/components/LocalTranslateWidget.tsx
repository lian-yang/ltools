import { useState, useEffect } from 'react';
import { Icon, type IconName } from './Icon';
import * as LocalTranslateService from '../../bindings/ltools/plugins/localtranslate/localtranslateservice';
import type { ProviderStatus, TranslationResult } from '../../bindings/ltools/plugins/localtranslate/models';
import { ProviderType } from '../../bindings/ltools/plugins/localtranslate/models';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { SetupWizard } from './SetupWizard';
import { useToast } from '../hooks/useToast';
import { t } from '@/i18n';

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
  { code: 'zh', name: t('中文'), flag: '🇨🇳' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: t('日本語'), flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
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
      setError(t('请输入要翻译的文本'));
      return;
    }

    // 检查是否有可用的供应商
    const availableProviders = providerStatuses.filter(s => s.available);
    if (availableProviders.length === 0) {
      setError(t('没有可用的翻译供应商，请先配置'));
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
      const errorMessage = err instanceof Error ? err.message : t('翻译失败，请重试');
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
      success(t('已复制到剪贴板'));
    } catch (err) {
      console.error('Failed to copy:', err);
      showError(t('复制失败'));
    }
  };

  // 首次使用引导
  if (isFirstUse && !showSetupWizard) {
    return (
      <div className="glass-heavy rounded-2xl p-12 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#7C3AED]/20 mb-6">
          <Icon name="language" size={40} color="#A78BFA" />
        </div>
        <h2 className="text-2xl font-semibold text-white mb-3">
          {t('欢迎使用智能翻译')}
        </h2>
        <p className="text-white/40 mb-8 max-w-md mx-auto">
          {t('支持多种 AI 翻译服务，包括本地 Ollama 和云端 API')}
        </p>
        <button
          onClick={() => setShowSetupWizard(true)}
          className="px-8 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl transition-all font-medium"
        >
          {t('开始配置')}
        </button>
      </div>
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

  const getLanguageInfo = (code: string) => LANGUAGES.find(l => l.code === code) || { name: code, flag: '🌐' };

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">{t('智能翻译')}</h2>
          <p className="text-sm text-white/40">
            {providerStatuses.filter(s => s.available).length} {t('个可用供应商')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {providerStatuses.filter(s => s.available).slice(0, 3).map(status => (
              <div
                key={status.type}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-lg text-xs font-medium text-[#A78BFA]"
              >
                <Icon name={PROVIDER_ICONS[status.type] || 'cube'} size={14} />
                <span>{PROVIDER_NAMES[status.type] || status.type}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowSetupWizard(true)}
            className="p-2.5 hover:bg-white/5 rounded-lg transition-colors clickable"
            title={t("设置")}
          >
            <Icon name="cog" size={18} color="rgba(255,255,255,0.6)" />
          </button>
        </div>
      </div>

      {/* 语言选择器 */}
      <div className="glass-light rounded-xl p-4">
        <div className="flex items-center justify-center gap-4">
          <Select value={sourceLang} onValueChange={setSourceLang}>
            <SelectTrigger className="w-40">
              <SelectValue>
                <span className="flex items-center gap-2">
                  <span>{getLanguageInfo(sourceLang).flag}</span>
                  <span>{getLanguageInfo(sourceLang).name}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(lang => (
                <SelectItem key={lang.code} value={lang.code}>
                  <span className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            onClick={handleSwapLanguages}
            className="p-2.5 hover:bg-[#7C3AED]/10 rounded-xl transition-all clickable"
            title={t("交换语言")}
          >
            <Icon name="refresh-cw" size={18} color="#A78BFA" />
          </button>

          <Select value={targetLang} onValueChange={setTargetLang}>
            <SelectTrigger className="w-40">
              <SelectValue>
                <span className="flex items-center gap-2">
                  <span>{getLanguageInfo(targetLang).flag}</span>
                  <span>{getLanguageInfo(targetLang).name}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(lang => (
                <SelectItem key={lang.code} value={lang.code}>
                  <span className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 翻译区域 */}
      <div className="grid grid-cols-2 gap-4 min-h-[400px]">
        {/* 输入框 */}
        <div className="glass-light rounded-xl p-6 relative">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t("输入要翻译的文本...")}
            className="w-full h-full bg-transparent resize-none focus:outline-none text-white/90 placeholder-white/30 text-base leading-relaxed min-h-[320px]"
          />
          {inputText && (
            <button
              onClick={() => setInputText('')}
              className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-lg transition-colors clickable"
            >
              <Icon name="x-mark" size={16} color="rgba(255,255,255,0.4)" />
            </button>
          )}
          <div className="absolute bottom-4 left-6 text-xs text-white/30">
            {inputText.length} {t('字符')}
          </div>
        </div>

        {/* 输出框 */}
        <div className="glass-light rounded-xl p-6 relative min-h-[400px]">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Icon name="refresh-cw" size={32} color="#A78BFA" className="animate-spin" />
                <span className="text-sm text-white/40">{t('翻译中...')}</span>
              </div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#EF4444]/10 flex items-center justify-center">
                  <Icon name="exclamation-circle" size={24} color="#EF4444" />
                </div>
                <p className="text-sm text-center text-[#EF4444]">{error}</p>
              </div>
            </div>
          ) : outputText ? (
            <>
              <div className="pb-16 min-h-[320px] overflow-auto">
                <p className="text-white/90 text-base leading-relaxed whitespace-pre-wrap">{outputText}</p>
              </div>
              <div className="absolute bottom-4 left-6 right-6">
                <div className="flex items-center justify-between">
                  {activeProvider && (
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <Icon name={PROVIDER_ICONS[activeProvider] || 'cube'} size={14} />
                      <span>{t('使用')} {PROVIDER_NAMES[activeProvider] || activeProvider}</span>
                    </div>
                  )}
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7C3AED]/10 hover:bg-[#7C3AED]/20 border border-[#7C3AED]/20 rounded-lg transition-colors text-xs text-[#A78BFA] font-medium clickable"
                  >
                    <Icon name="clipboard" size={14} />
                    {t('复制')}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Icon name="language" size={48} color="rgba(255,255,255,0.1)" />
                <p className="text-sm text-white/30">{t('翻译结果将显示在这里')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 翻译按钮 */}
      <button
        onClick={handleTranslate}
        disabled={loading || !inputText.trim()}
        className={`w-full py-3.5 text-white rounded-xl transition-all font-medium flex items-center justify-center gap-2.5 clickable ${
          loading
            ? 'bg-[#7C3AED] cursor-wait'
            : !inputText.trim()
            ? 'bg-[#7C3AED]/50 cursor-not-allowed'
            : 'bg-[#7C3AED] hover:bg-[#6D28D9]'
        }`}
      >
        {loading ? (
          <>
            <Icon name="refresh-cw" size={16} className="animate-spin" />
            {t('翻译中...')}
          </>
        ) : (
          <>
            <Icon name="language" size={16} />
            {t('翻译')}
          </>
        )}
      </button>
    </div>
  );
}
