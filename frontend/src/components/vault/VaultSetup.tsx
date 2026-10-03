import React, { useState } from 'react';
import * as VaultService from '../../../bindings/ltools/plugins/vault/vaultservice';
import { Icon } from '../Icon';
import { Button, Input, ProgressBar } from '../ui';

interface VaultSetupProps {
  onComplete: () => void;
}

const strengthLevels = [
  { max: 2, text: '弱', tone: 'error' as const },
  { max: 3, text: '中等', tone: 'warning' as const },
  { max: 4, text: '强', tone: 'success' as const },
  { max: 5, text: '非常强', tone: 'success' as const },
];

const VaultSetup: React.FC<VaultSetupProps> = ({ onComplete }) => {
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 密码强度检查
  const getPasswordStrength = (password: string): { level: number; text: string; tone: 'error' | 'warning' | 'success' } => {
    if (!password) return { level: 0, text: '', tone: 'error' };

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    const found = strengthLevels.find((s) => score <= s.max) ?? strengthLevels[strengthLevels.length - 1];
    return { level: score, text: found.text, tone: found.tone };
  };

  const strength = getPasswordStrength(masterPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 验证
    if (masterPassword.length < 8) {
      setError('主密码至少需要 8 个字符');
      return;
    }

    if (masterPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (strength.level < 2) {
      setError('密码强度太弱，请使用更复杂的密码');
      return;
    }

    setLoading(true);
    try {
      await VaultService.Setup(masterPassword);
      onComplete();
    } catch (err) {
      setError('设置失败，请重试');
      console.error('Setup failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center">
      <div className="card w-full max-w-[400px] p-7">
        {/* 头部 */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-[12px] border border-hairline bg-surface-2">
            <Icon name="shield" size={22} color="var(--color-accent-text)" />
          </div>
          <h1 className="text-[17px] font-semibold text-text-1">创建密码保险库</h1>
          <p className="mt-1 text-[12px] text-text-3">设置一个主密码来保护您的所有密码</p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 主密码 */}
          <div>
            <label className="field-label">主密码</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                className="h-9 pr-10"
                placeholder="输入主密码"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="icon-btn absolute right-1 top-1 h-7 w-7"
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={14} />
              </button>
            </div>

            {/* 密码强度指示器 */}
            {masterPassword && (
              <div className="mt-2">
                <ProgressBar value={(strength.level / 5) * 100} tone={strength.tone} />
                <p className="mt-1 text-[11px] text-text-3">
                  密码强度:<span className="text-text-1">{strength.text}</span>
                </p>
              </div>
            )}
          </div>

          {/* 确认密码 */}
          <div>
            <label className="field-label">确认密码</label>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-9"
              placeholder="再次输入主密码"
            />
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="rounded-[6px] px-3 py-2 text-[12px]" style={{ background: 'rgba(255,69,58,0.12)', color: 'var(--color-error-text)' }}>
              {error}
            </div>
          )}

          {/* 提示 */}
          <div className="rounded-[7px] px-3.5 py-3" style={{ background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.18)' }}>
            <div className="flex gap-2.5">
              <Icon name="warning" size={14} color="var(--color-warning-text)" className="mt-0.5 shrink-0" />
              <div className="text-[11.5px] leading-relaxed text-text-2">
                <p className="mb-0.5 font-medium" style={{ color: 'var(--color-warning-text)' }}>重要提示</p>
                <p>主密码是访问您所有密码的唯一方式。如果忘记主密码,将无法恢复您的数据。请务必牢记。</p>
              </div>
            </div>
          </div>

          {/* 提交按钮 */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={loading}
            disabled={!masterPassword || !confirmPassword}
            icon="shield"
          >
            {loading ? '创建中…' : '创建保险库'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default VaultSetup;
