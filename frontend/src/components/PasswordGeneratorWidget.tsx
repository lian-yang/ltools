import { useState, useCallback, useEffect, useMemo } from 'react';
import { Icon } from './Icon';
import { useToast } from '../hooks/useToast';
import { Badge, Button, Card, Field, KeyCap, ProgressBar, SectionTitle, Toggle, type BadgeTone } from './ui';

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

type StrengthTone = 'error' | 'warning' | 'success';

/**
 * 密码强度配置（红 / 橙 / 绿三档 tone，宽度区分四档）
 */
const STRENGTH_CONFIG: Record<PasswordStrength, { tone: StrengthTone; label: string; width: number }> = {
  weak: { tone: 'error', label: '弱', width: 25 },
  medium: { tone: 'warning', label: '中', width: 50 },
  strong: { tone: 'success', label: '强', width: 75 },
  'very-strong': { tone: 'success', label: '很强', width: 100 },
};

const STRENGTH_BADGE_TONE: Record<StrengthTone, BadgeTone> = {
  error: 'error',
  warning: 'warning',
  success: 'success',
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
    return '刚刚';
  }

  // 小于 1 小时
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}分钟前`;
  }

  // 小于 1 天
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}小时前`;
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
    <button
      className="row row-clickable w-full flex-col items-start gap-1 py-2 text-left"
      onClick={() => onClick(item)}
      title="点击恢复此密码及选项"
    >
      <span className="w-full truncate font-mono text-[12.5px] text-text-1">{displayPassword}</span>
      <span className="flex w-full items-center gap-2">
        <Badge tone={STRENGTH_BADGE_TONE[strengthConfig.tone]}>{strengthConfig.label}</Badge>
        <span className="tnum text-[11px] text-text-3">{item.length} 位</span>
        <span className="tnum ml-auto whitespace-nowrap text-[11px] text-text-4">
          {formatTime(item.timestamp)}
        </span>
      </span>
    </button>
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
      error('请至少选择一种字符类型');
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
      error('没有可复制的密码');
      return;
    }

    try {
      await navigator.clipboard.writeText(password);
      success('密码已复制到剪贴板');
    } catch (err) {
      error('复制失败，请手动复制');
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
      // 焦点在交互元素上时跳过，避免 Enter/Space 双触发（按钮 click + 全局快捷键）
      const target = e.target as HTMLElement | null;
      const isInteractive = !!target && (
        target.tagName === 'BUTTON' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );

      // Enter 或 Space：生成新密码
      if (e.key === 'Enter' || (e.key === ' ' && !e.repeat)) {
        if (isInteractive) return;
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
        if (isInteractive) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      {/* 密码生成器主体 */}
      <div className="min-w-0 flex-1 space-y-5">
        {/* 密码显示与生成 */}
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-medium text-text-2">生成的密码</span>
            {password && (
              <span className={`text-[12px] font-medium ${
                strengthConfig.tone === 'error'
                  ? 'text-error-text'
                  : strengthConfig.tone === 'warning'
                    ? 'text-warning-text'
                    : 'text-success-text'
              }`}>
                {strengthConfig.label}
              </span>
            )}
          </div>

          {/* 密码展示（card-inset + font-mono 15px） */}
          <div className="card-inset relative px-3.5 py-3">
            {password ? (
              <p className="min-w-0 break-all pr-8 font-mono text-[15px] leading-relaxed text-text-1 select-text">
                {password}
              </p>
            ) : (
              <p className="py-0.5 pr-8 font-mono text-[15px] text-text-4">
                点击生成按钮创建密码
              </p>
            )}
            <button
              className="icon-btn absolute right-1.5 top-1/2 -translate-y-1/2"
              onClick={copyPassword}
              disabled={!password}
              title="复制密码"
              aria-label="复制密码"
            >
              <Icon name="copy" size={15} />
            </button>
          </div>

          {/* 强度指示条 */}
          <div className="mt-3">
            <ProgressBar
              value={password ? strengthConfig.width : 0}
              tone={strengthConfig.tone}
            />
          </div>

          {/* 操作按钮 */}
          <div className="mt-4 flex gap-2">
            <Button
              variant="primary"
              size="lg"
              icon="refresh"
              className="flex-1"
              onClick={generateNewPassword}
              disabled={!hasValidOptions}
            >
              生成密码
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon="copy"
              className="w-11 px-0"
              onClick={copyPassword}
              disabled={!password}
              title="复制密码"
              aria-label="复制密码"
            />
          </div>

          {/* 警告信息 */}
          {!hasValidOptions && (
            <div
              className="mt-4 flex items-center gap-2 rounded-[6px] px-3 py-2.5"
              style={{ background: 'rgba(255,69,58,0.12)' }}
            >
              <Icon name="exclamation-circle" size={14} color="var(--color-error-text)" className="shrink-0" />
              <p className="text-[12px] text-error-text">请至少选择一种字符类型</p>
            </div>
          )}
        </Card>

        {/* 控制面板 */}
        <Card className="p-4">
          <SectionTitle title="密码选项" className="mb-1" />

          {/* 长度控制 */}
          <div className="hairline-b py-2">
            <Field horizontal label="密码长度">
              <span className="tnum rounded-[5px] bg-surface-1 px-2 py-1 font-mono text-[12px] text-text-1">
                {options.length}
              </span>
            </Field>
            <input
              type="range"
              min="4"
              max="64"
              value={options.length}
              onChange={(e) => updateOption('length', parseInt(e.target.value))}
              aria-label="密码长度"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-4 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:transition-colors"
            />
            <div className="tnum mt-1 flex justify-between text-[10.5px] text-text-4">
              <span>4</span>
              <span>64</span>
            </div>
          </div>

          {/* 字符类型选择 */}
          <div className="hairline-b">
            <Field horizontal label="小写字母 (a-z)">
              <Toggle
                checked={options.includeLowercase}
                onChange={(checked) => updateOption('includeLowercase', checked)}
                label="包含小写字母"
              />
            </Field>
          </div>
          <div className="hairline-b">
            <Field horizontal label="大写字母 (A-Z)">
              <Toggle
                checked={options.includeUppercase}
                onChange={(checked) => updateOption('includeUppercase', checked)}
                label="包含大写字母"
              />
            </Field>
          </div>
          <div className="hairline-b">
            <Field horizontal label="数字 (0-9)">
              <Toggle
                checked={options.includeNumbers}
                onChange={(checked) => updateOption('includeNumbers', checked)}
                label="包含数字"
              />
            </Field>
          </div>
          <div className="hairline-b">
            <Field horizontal label="特殊字符 (!@#$%...)">
              <Toggle
                checked={options.includeSpecialChars}
                onChange={(checked) => updateOption('includeSpecialChars', checked)}
                label="包含特殊字符"
              />
            </Field>
          </div>
          <div>
            <Field horizontal label="排除相似字符" hint="如 0/o、1/l/I 等容易混淆的字符">
              <Toggle
                checked={options.excludeSimilar}
                onChange={(checked) => updateOption('excludeSimilar', checked)}
                label="排除相似字符"
              />
            </Field>
          </div>
        </Card>

        {/* 键盘快捷键提示 */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11.5px] text-text-4">
          <span className="flex items-center gap-1.5">
            <KeyCap>Enter</KeyCap>
            <KeyCap>Space</KeyCap>
            生成
          </span>
          <span className="flex items-center gap-1.5">
            <KeyCap>Ctrl C</KeyCap>
            复制
          </span>
          <span className="flex items-center gap-1.5">
            <KeyCap>Esc</KeyCap>
            清空
          </span>
        </div>
      </div>

      {/* 历史记录侧边栏 */}
      <aside className="w-full shrink-0 lg:w-72">
        <Card className="flex flex-col p-4">
          {/* 历史记录标题 */}
          <SectionTitle
            title="生成历史"
            action={
              <div className="flex items-center gap-1">
                {history.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="trash"
                    className="text-error-text"
                    onClick={clearHistory}
                  >
                    清空
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
                  {showHistory ? '收起' : '展开'}
                </Button>
              </div>
            }
          />

          {/* 历史记录列表 */}
          {showHistory && (
            <div className="mt-1.5 max-h-[440px] min-h-0 flex-1 space-y-1 overflow-y-auto">
              {history.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
                  <Icon name="shield-check" size={18} color="var(--color-text-4)" />
                  <p className="text-[12px] text-text-3">暂无生成历史</p>
                </div>
              ) : (
                <Card inset className="p-1.5">
                  {history.map((item) => (
                    <HistoryRecord
                      key={item.password}
                      item={item}
                      onClick={loadFromHistory}
                    />
                  ))}
                </Card>
              )}
            </div>
          )}

          {/* 历史统计 */}
          {history.length > 0 && (
            <p className="tnum hairline-t mt-3 pt-3 text-[11.5px] text-text-4">
              共 {history.length} 条记录
            </p>
          )}
        </Card>
      </aside>
    </div>
  );
}

export default PasswordGeneratorWidget;
