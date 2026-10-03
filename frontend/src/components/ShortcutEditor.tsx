import { useState, useEffect, useCallback } from 'react';
import { Icon } from './Icon';
import { Button, IconButton, KeyCap, Spinner } from './ui';

/**
 * 快捷键信息接口
 */
interface ShortcutInfo {
  pluginId: string;
  keyCombo: string;
  displayText: string;
}

/**
 * ShortcutEditor 组件属性
 */
interface ShortcutEditorProps {
  pluginId: string;
  pluginName: string;
  currentShortcut?: ShortcutInfo;
  existingShortcuts: Record<string, string>;
  onSave: (keyCombo: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * 快捷键编辑器组件（纯前端实现）
 */
export function ShortcutEditor({ pluginId, pluginName, currentShortcut, existingShortcuts, onSave, onCancel }: ShortcutEditorProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [displayShortcut, setDisplayShortcut] = useState<string>('');

  // 初始化显示当前快捷键
  useEffect(() => {
    if (currentShortcut) {
      setDisplayShortcut(currentShortcut.displayText);
      parseKeyCombo(currentShortcut.keyCombo);
    }
  }, [currentShortcut]);

  /**
   * 解析快捷键组合
   */
  const parseKeyCombo = (keyCombo: string) => {
    const normalized = keyCombo.toLowerCase();
    const parts = normalized.split('+');
    setRecordedKeys(parts);
  };

  /**
   * 格式化按键用于显示
   */
  const formatKeyForDisplay = (key: string): string => {
    const platform = navigator.platform.toLowerCase();
    const isMac = platform.includes('mac');

    switch (key.toLowerCase()) {
      case 'ctrl':
      case 'control':
        return isMac ? '⌘' : 'Ctrl';
      case 'cmd':
      case 'command':
      case 'meta':
        return isMac ? '⌘' : 'Win';
      case 'shift':
        return isMac ? '⇧' : 'Shift';
      case 'alt':
      case 'option':
        return isMac ? '⌥' : 'Alt';
      default:
        return key.toUpperCase();
    }
  };

  /**
   * 获取显示的快捷键文本
   */
  const getDisplayText = useCallback((): string => {
    if (recordedKeys.length === 0) {
      return '按下快捷键组合...';
    }

    // 分离修饰键和主键
    const modifiers: string[] = [];
    let mainKey = '';

    recordedKeys.forEach(key => {
      const lowerKey = key.toLowerCase();
      if (['ctrl', 'control', 'cmd', 'command', 'meta', 'shift', 'alt', 'option'].includes(lowerKey)) {
        modifiers.push(key);
      } else {
        mainKey = key;
      }
    });

    // 格式化显示
    const formattedModifiers = modifiers.map(formatKeyForDisplay);
    const formattedMainKey = mainKey ? formatKeyForDisplay(mainKey) : '';

    return [...formattedModifiers, formattedMainKey].filter(Boolean).join('+');
  }, [recordedKeys]);

  useEffect(() => {
    setDisplayShortcut(getDisplayText());
  }, [recordedKeys, getDisplayText]);

  /**
   * 处理键盘按下事件
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const keys: string[] = [];

    // 收集修饰键
    if (e.ctrlKey) keys.push('ctrl');
    if (e.metaKey) keys.push('cmd');
    if (e.shiftKey) keys.push('shift');
    if (e.altKey) keys.push('alt');

    // 收集主键（排除修饰键）
    const mainKey = /^Digit[0-9]$/.test(e.code) ? e.code.slice(5)
      : /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
    if (!['control', 'meta', 'shift', 'alt'].includes(mainKey)) {
      keys.push(mainKey === ' ' ? 'space' : mainKey);
    }

    // 至少需要一个主键
    const hasMainKey = keys.some(k => !['ctrl', 'cmd', 'shift', 'alt'].includes(k.toLowerCase()));
    if (!hasMainKey) {
      return;
    }

    setRecordedKeys(keys);
    setError(null);
  }, []);

  /**
   * 处理键盘抬起事件 - 完成录制
   */
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (recordedKeys.length > 0) {
      setIsRecording(false);
    }
  }, [recordedKeys.length]);

  /**
   * 开始录制快捷键
   */
  const startRecording = () => {
    setIsRecording(true);
    setRecordedKeys([]);
    setError(null);
  };

  /**
   * 停止录制
   */
  const stopRecording = () => {
    setIsRecording(false);
    setRecordedKeys([]);
    setError(null);
  };

  /**
   * 注册/注销键盘事件监听
   */
  useEffect(() => {
    if (isRecording) {
      window.addEventListener('keydown', handleKeyDown, { capture: true });
      window.addEventListener('keyup', handleKeyUp, { capture: true });
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
    };
  }, [isRecording, handleKeyDown, handleKeyUp]);

  /**
   * 保存快捷键
   */
  const handleSave = async () => {
    if (recordedKeys.length === 0) {
      setError('请先录制快捷键');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // 构建快捷键字符串
      const keyCombo = recordedKeys.join('+');

      // 检查冲突（排除当前插件）
      const conflictingPlugin = existingShortcuts[keyCombo];
      if (conflictingPlugin && conflictingPlugin !== pluginId) {
        setError(`此快捷键已被其他插件使用`);
        return;
      }

      await onSave(keyCombo);
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 清除当前快捷键
   */
  const handleClear = () => {
    setRecordedKeys([]);
    setError(null);
  };

  const displayParts = displayShortcut && displayShortcut !== '按下快捷键组合...'
    ? displayShortcut.split('+').filter(Boolean)
    : [];

  return (
    <div className="scrim fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="animate-scale-in w-full max-w-md rounded-[12px] border border-hairline-strong bg-surface-2 p-5"
        style={{ boxShadow: 'var(--shadow-modal)' }}
        role="dialog"
        aria-modal="true"
      >
        {/* 标题 */}
        <div className="hairline-b mb-4 flex items-center justify-between pb-3">
          <h2 className="text-[14px] font-semibold text-text-1">设置快捷键</h2>
          <IconButton name="x" label="关闭" size="sm" onClick={onCancel} disabled={saving} />
        </div>

        {/* 插件名称 */}
        <div className="mb-4">
          <p className="text-[11.5px] text-text-3">插件</p>
          <p className="mt-0.5 text-[12.5px] font-medium text-text-1">{pluginName}</p>
        </div>

        {/* 快捷键录制区域 */}
        <div className="mb-4">
          <p className="field-label">快捷键组合</p>
          <div
            className={`rounded-[7px] border border-dashed p-4 transition-colors duration-150 ${
              isRecording
                ? 'border-accent bg-accent-subtle'
                : 'border-hairline-strong bg-surface-1 hover:border-white/20'
            } ${saving ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
            onClick={isRecording ? undefined : startRecording}
          >
            {isRecording ? (
              <div className="text-center">
                <div className="mb-1.5 flex items-center justify-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-error" />
                  <span className="text-[12.5px] text-text-1">录制中...</span>
                </div>
                <p className="text-[11.5px] text-text-3">按下快捷键组合，松开完成</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    stopRecording();
                  }}
                >
                  取消录制
                </Button>
              </div>
            ) : (
              <div className="flex min-h-[38px] items-center justify-center gap-1.5">
                {displayParts.length > 0 ? (
                  displayParts.map((part, i) => (
                    <span key={`${part}-${i}`} className="flex items-center gap-1.5">
                      {i > 0 && <span className="text-text-4">+</span>}
                      <KeyCap>{part}</KeyCap>
                    </span>
                  ))
                ) : (
                  <span className="text-[12.5px] text-text-3">点击开始录制快捷键</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-[7px] border border-error/20 bg-error/10 px-3 py-2">
            <Icon name="exclamation-circle" size={15} className="shrink-0 text-error-text" />
            <span className="text-[12.5px] text-error-text">{error}</span>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="flex-1" onClick={onCancel} disabled={saving}>
            取消
          </Button>
          {recordedKeys.length > 0 && (
            <IconButton
              name="trash"
              label="清除已录制的按键"
              tone="danger"
              onClick={handleClear}
              disabled={saving}
            />
          )}
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleSave}
            disabled={saving || recordedKeys.length === 0}
          >
            {saving ? (
              <>
                <Spinner size={12} />
                保存中...
              </>
            ) : (
              '保存'
            )}
          </Button>
        </div>

        {/* 提示信息 */}
        <div className="card-inset mt-4 p-3">
          <p className="flex items-center gap-1.5 text-[11.5px] text-text-3">
            <Icon name="information-circle" size={13} className="shrink-0 text-text-4" />
            提示：可以使用 Ctrl、Shift、Alt、Cmd (macOS) 等修饰键组合。例如：
          </p>
          <div className="mt-2 flex flex-col items-start gap-1.5 pl-[19px]">
            {[
              ['Cmd', 'Shift', 'D'],
              ['Ctrl', 'Shift', 'D'],
              ['Alt', 'Space'],
            ].map((keys, i) => (
              <span key={i} className="flex items-center gap-1">
                {keys.map((k, j) => (
                  <span key={k} className="flex items-center gap-1">
                    {j > 0 && <span className="text-[11px] text-text-4">+</span>}
                    <KeyCap>{k}</KeyCap>
                  </span>
                ))}
                {i === 0 && <span className="ml-1 text-[11px] text-text-4">(macOS)</span>}
                {i === 1 && <span className="ml-1 text-[11px] text-text-4">(Windows/Linux)</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
