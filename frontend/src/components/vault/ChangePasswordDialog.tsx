import React, { useState } from 'react';
import * as VaultService from '../../../bindings/ltools/plugins/vault/vaultservice';
import { Icon } from '../Icon';
import { Button, Input, Modal, ProgressBar } from '../ui';

interface ChangePasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const strengthLevels = [
  { max: 2, text: '弱', tone: 'error' as const },
  { max: 3, text: '中等', tone: 'warning' as const },
  { max: 4, text: '强', tone: 'success' as const },
  { max: 5, text: '非常强', tone: 'success' as const },
];

const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({ isOpen, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // 验证
    if (!currentPassword) {
      setError('请输入当前主密码');
      return;
    }

    if (newPassword.length < 8) {
      setError('新主密码至少需要 8 个字符');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    if (strength.level < 2) {
      setError('新密码强度太弱，请使用更复杂的密码');
      return;
    }

    setLoading(true);
    try {
      await VaultService.ChangeMasterPassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // 2秒后自动关闭
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError('当前主密码错误或修改失败');
      console.error('Change password failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess(false);
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="修改主密码"
      width={400}
      footer={
        success ? undefined : (
          <>
            <Button variant="ghost" onClick={handleClose}>
              取消
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="change-password-form"
              loading={loading}
              disabled={!currentPassword || !newPassword || !confirmPassword}
            >
              确认修改
            </Button>
          </>
        )
      }
    >
      {success ? (
        <div className="py-4 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full" style={{ background: 'rgba(48,209,88,0.14)' }}>
            <Icon name="check-circle" size={22} color="var(--color-success-text)" />
          </div>
          <h3 className="text-[14px] font-medium text-text-1">修改成功</h3>
          <p className="mt-1 text-[12px] text-text-3">主密码已成功更新</p>
        </div>
      ) : (
        <form id="change-password-form" onSubmit={handleSubmit} className="space-y-4">
          {/* 当前密码 */}
          <div>
            <label className="field-label">当前主密码</label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="输入当前主密码"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="icon-btn icon-btn-sm absolute right-1 top-1"
                aria-label={showCurrentPassword ? '隐藏密码' : '显示密码'}
              >
                <Icon name={showCurrentPassword ? 'eye-off' : 'eye'} size={14} />
              </button>
            </div>
          </div>

          {/* 新密码 */}
          <div>
            <label className="field-label">新主密码</label>
            <div className="relative">
              <Input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="输入新主密码"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="icon-btn icon-btn-sm absolute right-1 top-1"
                aria-label={showNewPassword ? '隐藏密码' : '显示密码'}
              >
                <Icon name={showNewPassword ? 'eye-off' : 'eye'} size={14} />
              </button>
            </div>

            {/* 密码强度 */}
            {newPassword && (
              <div className="mt-2">
                <ProgressBar value={(strength.level / 5) * 100} tone={strength.tone} />
                <p className="mt-1 text-[11px] text-text-3">
                  密码强度:<span className="text-text-1">{strength.text}</span>
                </p>
              </div>
            )}
          </div>

          {/* 确认新密码 */}
          <div>
            <label className="field-label">确认新密码</label>
            <Input
              type={showNewPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入新主密码"
            />
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="flex items-center gap-2 rounded-[6px] px-3 py-2 text-[12px]" style={{ background: 'rgba(255,69,58,0.12)', color: 'var(--color-error-text)' }}>
              <Icon name="x-circle" size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
};

export default ChangePasswordDialog;
