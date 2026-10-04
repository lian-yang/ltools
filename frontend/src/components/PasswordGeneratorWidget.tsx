import { useState, useCallback, useEffect, useMemo } from 'react';
import { Icon } from './Icon';
import { useToast } from '../hooks/useToast';
import { t } from '@/i18n';

/**
 * 密码选项接口
 */
interface PasswordOptions {
  length: number;
  includeLowercase: boolean;
  includeUppercase: boolean;
  includeNumbers: boolean;
  includeSpecialChars: boolean;
  excludeSimilar: boolean;
}

/**
 * 密码历史记录项接口
 */
interface PasswordHistoryItem {
  password: string;
  length: number;
  options: PasswordOptions;
  timestamp: number;
  strength: PasswordStrength;
}

/**
 * 密码强度类型
 */
type PasswordStrength = 'weak' | 'medium' | 'strong' | 'very-strong';

/**
 * 密码强度配置
 */
const STRENGTH_CONFIG = {
  weak: { color: '#EF4444', label: t('弱'), width: '25%' },
  medium: { color: '#F59E0B', label: t('中'), width: '50%' },
  strong: { color: '#22C55E', label: t('强'), width: '75%' },
  'very-strong': { color: '#7C3AED', label: t('很强'), width: '100%' },
};

/**
 * 计算密码强度
 */
const calculateStrength = (password: string): PasswordStrength => {
  let score = 0;

  // 长度评分
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // 字符类型评分
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  // 根据评分返回强度
  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  if (score <= 5) return 'strong';
  return 'very-strong';
};

/**
 * 生成随机密码
 */
const generatePassword = (options: PasswordOptions): string => {
  // 构建字符池
  let charset = '';
  if (options.includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (options.includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (options.includeNumbers) charset += '0123456789';
  if (options.includeSpecialChars) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  // 排除相似字符
  if (options.excludeSimilar) {
    const similar = '0O1lI';
    charset = charset.split('').filter(c => !similar.includes(c)).join('');
  }

  // 如果字符池为空，返回空字符串
  if (charset.length === 0) return '';

  // 使用安全的随机方法生成密码
  const array = new Uint32Array(options.length);
  crypto.getRandomValues(array);
  return Array.from(array, x => charset[x % charset.length]).join('');
};

/**
 * 格式化时间显示
 */
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // 小于 1 分钟
  if (diff < 60000) {
    return t('刚刚');
  }

  // 小于 1 小时
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return t('{n}分钟前', { n: minutes });
  }

  // 小于 1 天
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return t('{n}小时前', { n: hours });
  }

  // 显示具体时间
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * 历史记录项组件
 */
interface HistoryRecordProps {
  item: PasswordHistoryItem;
  onClick: (item: PasswordHistoryItem) => void;
}

function HistoryRecord({ item, onClick }: HistoryRecordProps): JSX.Element {
  const strengthConfig = STRENGTH_CONFIG[item.strength];

  // 截断密码显示
  const displayPassword = item.password.length > 20
    ? item.password.substring(0, 20) + '...'
    : item.password;

  return (
    <div
      className="glass-light rounded-lg p-3 hover:bg-white/5 transition-all duration-200 cursor-pointer clickable"
      onClick={() => onClick(item)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-white/90 truncate">{displayPassword}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-white/40">{item.length} {t('位')}</span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${strengthConfig.color}20`,
                color: strengthConfig.color,
                border: `1px solid ${strengthConfig.color}40`,
              }}
            >
              {strengthConfig.label}
            </span>
          </div>
        </div>
        <span className="text-xs text-white/30 whitespace-nowrap">{formatTime(item.timestamp)}</span>
      </div>
    </div>
  );
}

/**
 * 密码生成器主组件
 */
export function PasswordGeneratorWidget(): JSX.Element {
  const [password, setPassword] = useState<string>('');
  const [options, setOptions] = useState<PasswordOptions>({
    length: 16,
    includeLowercase: true,
    includeUppercase: true,
    includeNumbers: true,
    includeSpecialChars: true,
    excludeSimilar: false,
  });
  const [history, setHistory] = useState<PasswordHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const { success, error } = useToast();

  // 当前密码强度
  const strength = useMemo(() => {
    if (!password) return 'weak';
    return calculateStrength(password);
  }, [password]);

  const strengthConfig = STRENGTH_CONFIG[strength];

  // 检查是否至少选择了一种字符类型
  const hasValidOptions = useMemo(() => {
    return options.includeLowercase ||
           options.includeUppercase ||
           options.includeNumbers ||
           options.includeSpecialChars;
  }, [options]);

  // 生成新密码
  const generateNewPassword = useCallback(() => {
    if (!hasValidOptions) {
      error(t('请至少选择一种字符类型'));
      return;
    }

    const newPassword = generatePassword(options);
    setPassword(newPassword);

    // 添加到历史记录
    const historyItem: PasswordHistoryItem = {
      password: newPassword,
      length: options.length,
      options: { ...options },
      timestamp: Date.now(),
      strength: calculateStrength(newPassword),
    };

    setHistory(prev => [historyItem, ...prev].slice(0, 20));
  }, [options, hasValidOptions, error]);

  // 复制密码到剪贴板
  const copyPassword = useCallback(async () => {
    if (!password) {
      error(t('没有可复制的密码'));
      return;
    }

    try {
      await navigator.clipboard.writeText(password);
      success(t('密码已复制到剪贴板'));
    } catch (err) {
      error(t('复制失败，请手动复制'));
    }
  }, [password, success, error]);

  // 从历史记录恢复
  const loadFromHistory = useCallback((item: PasswordHistoryItem) => {
    setPassword(item.password);
    setOptions(item.options);
  }, []);

  // 清空历史记录
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  // 更新选项
  const updateOption = useCallback(<K extends keyof PasswordOptions>(
    key: K,
    value: PasswordOptions[K]
  ) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  }, []);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Enter 或 Space：生成新密码
      if (e.key === 'Enter' || (e.key === ' ' && !e.repeat)) {
        e.preventDefault();
        generateNewPassword();
      }
      // Ctrl+C：复制密码
      else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        // 让浏览器处理默认的复制行为
        // 如果有选中的文本，就复制选中的文本
        // 否则复制生成的密码
        const selection = window.getSelection();
        if (selection && selection.toString().length === 0) {
          e.preventDefault();
          copyPassword();
        }
      }
      // Esc：清空显示
      else if (e.key === 'Escape') {
        setPassword('');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [generateNewPassword, copyPassword]);

  // 初始化时生成一个密码
  useEffect(() => {
    if (!password) {
      generateNewPassword();
    }
  }, []);

  return (
    <div className="flex justify-center gap-6">
      {/* 密码生成器主体 */}
      <div className="max-w-md">
        {/* 密码显示区域 */}
        <div className="glass-heavy rounded-2xl p-6 mb-6">
          <div className="mb-4">
            <label className="text-sm text-white/50 mb-2 block">{t('生成的密码')}</label>
            <div className="relative">
              <input
                type="text"
                className={`w-full px-4 py-4 bg-[#0D0F1A]/50 border border-white/10 rounded-xl text-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50 focus:border-[#7C3AED]/50 transition-all duration-200 font-mono ${
                  !password ? 'text-white/30' : ''
                }`}
                value={password || t('点击生成按钮创建密码')}
                readOnly
                placeholder={t("点击生成按钮创建密码")}
              />
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/10 transition-colors clickable"
                onClick={copyPassword}
                disabled={!password}
                title={t("复制密码")}
              >
                <Icon name="copy" size={20} color={!password ? 'rgba(255,255,255,0.2)' : '#A78BFA'} />
              </button>
            </div>
          </div>

          {/* 强度指示条 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/60">{t('密码强度')}</span>
              <span
                className="text-sm font-medium"
                style={{ color: strengthConfig.color }}
              >
                {strengthConfig.label}
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300 ease-out"
                style={{
                  width: password ? strengthConfig.width : '0%',
                  backgroundColor: strengthConfig.color,
                }}
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <button
              className="flex-1 px-6 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl transition-all duration-200 font-medium clickable hover-lift flex items-center justify-center gap-2"
              onClick={generateNewPassword}
              disabled={!hasValidOptions}
            >
              <Icon name="refresh" size={18} color="white" />
              {t('生成密码')}
            </button>
            <button
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all duration-200 font-medium clickable border border-white/10"
              onClick={copyPassword}
              disabled={!password}
              title={t("复制密码")}
            >
              <Icon name="copy" size={18} color={!password ? 'rgba(255,255,255,0.2)' : '#A78BFA'} />
            </button>
          </div>

          {/* 警告信息 */}
          {!hasValidOptions && (
            <div className="mt-4 p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20">
              <p className="text-sm text-[#EF4444] flex items-center gap-2">
                <Icon name="exclamation-circle" size={16} color="#EF4444" />
                {t('请至少选择一种字符类型')}
              </p>
            </div>
          )}
        </div>

        {/* 控制面板 */}
        <div className="glass-light rounded-xl p-5 mb-6">
          <h3 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2">
            <Icon name="funnel" size={16} color="#A78BFA" />
            {t('密码选项')}
          </h3>

          {/* 长度控制 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-white/70">{t('密码长度')}</label>
              <span className="text-sm font-mono text-[#A78BFA] bg-[#7C3AED]/10 px-2 py-1 rounded">
                {options.length}
              </span>
            </div>
            <input
              type="range"
              min="4"
              max="64"
              value={options.length}
              onChange={(e) => updateOption('length', parseInt(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer clickable [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#7C3AED] [&::-webkit-slider-thumb]:hover:bg-[#6D28D9] [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-white/30">4</span>
              <span className="text-xs text-white/30">64</span>
            </div>
          </div>

          {/* 字符类型选择 */}
          <div className="space-y-3">
            <label className="text-sm text-white/70 block mb-2">{t('字符类型')}</label>

            <label className="flex items-center gap-3 cursor-pointer clickable group">
              <input
                type="checkbox"
                checked={options.includeLowercase}
                onChange={(e) => updateOption('includeLowercase', e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#7C3AED] focus:ring-[#7C3AED]/50 cursor-pointer clickable"
              />
              <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                {t('小写字母 (a-z)')}
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer clickable group">
              <input
                type="checkbox"
                checked={options.includeUppercase}
                onChange={(e) => updateOption('includeUppercase', e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#7C3AED] focus:ring-[#7C3AED]/50 cursor-pointer clickable"
              />
              <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                {t('大写字母 (A-Z)')}
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer clickable group">
              <input
                type="checkbox"
                checked={options.includeNumbers}
                onChange={(e) => updateOption('includeNumbers', e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#7C3AED] focus:ring-[#7C3AED]/50 cursor-pointer clickable"
              />
              <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                {t('数字 (0-9)')}
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer clickable group">
              <input
                type="checkbox"
                checked={options.includeSpecialChars}
                onChange={(e) => updateOption('includeSpecialChars', e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#7C3AED] focus:ring-[#7C3AED]/50 cursor-pointer clickable"
              />
              <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                {t('特殊字符 (!@#$%...)')}
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer clickable group mt-4 pt-4 border-t border-white/10">
              <input
                type="checkbox"
                checked={options.excludeSimilar}
                onChange={(e) => updateOption('excludeSimilar', e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#7C3AED] focus:ring-[#7C3AED]/50 cursor-pointer clickable"
              />
              <div className="flex-1">
                <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                  {t('排除相似字符')}
                </span>
                <p className="text-xs text-white/40 mt-0.5">
                  {t('如 0/o、1/l/I 等容易混淆的字符')}
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* 键盘快捷键提示 */}
        <div className="text-center text-xs text-white/30">
          {t('Enter/Space = 生成 | Ctrl+C = 复制 | Esc = 清空')}
        </div>
      </div>

      {/* 历史记录侧边栏 */}
      <div className={`w-72 transition-all duration-300 ${showHistory ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}>
        <div className="glass-light rounded-xl p-4 h-full flex flex-col">
          {/* 历史记录标题 */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white/60 flex items-center gap-2">
              <Icon name="clock" size={14} color="#A78BFA" />
              {t('生成历史')}
            </h3>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button
                  className="text-xs text-white/30 hover:text-[#EF4444] transition-colors clickable flex items-center gap-1"
                  onClick={clearHistory}
                >
                  <Icon name="trash" size={12} />
                  {t('清空')}
                </button>
              )}
              <button
                className="text-xs text-white/30 hover:text-white/60 transition-colors clickable"
                onClick={() => setShowHistory(!showHistory)}
              >
                {showHistory ? t('收起') : t('展开')}
              </button>
            </div>
          </div>

          {/* 历史记录列表 */}
          {showHistory && (
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0 scrollbar-thin">
              {history.length === 0 ? (
                <div className="text-center py-8 text-white/30 text-sm">
                  <Icon name="shield-check" size={24} color="rgba(255,255,255,0.2)" />
                  <p className="mt-2">{t('暂无生成历史')}</p>
                </div>
              ) : (
                history.map((item, index) => (
                  <HistoryRecord
                    key={`${item.timestamp}-${index}`}
                    item={item}
                    onClick={loadFromHistory}
                  />
                ))
              )}
            </div>
          )}

          {/* 历史统计 */}
          {history.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-xs text-white/30">
                {t('共')} {history.length} {t('条记录')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PasswordGeneratorWidget;
