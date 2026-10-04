import React, { useState } from 'react';
import * as VaultService from '../../../bindings/ltools/plugins/vault/vaultservice';
import { Icon } from '../Icon';
import { t } from '@/i18n';

interface ChangePasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

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
  const getPasswordStrength = (password: string): { level: number; text: string; color: string } => {
    if (!password) return { level: 0, text: '', color: '' };

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 2) return { level: 1, text: t('弱'), color: 'bg-red-500' };
    if (score <= 3) return { level: 2, text: t('中等'), color: 'bg-yellow-500' };
    if (score <= 4) return { level: 3, text: t('强'), color: 'bg-green-500' };
    return { level: 4, text: t('非常强'), color: 'bg-green-600' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // 验证
    if (!currentPassword) {
      setError(t('请输入当前主密码'));
      return;
    }

    if (newPassword.length < 8) {
      setError(t('新主密码至少需要 8 个字符'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('两次输入的新密码不一致'));
      return;
    }

    if (strength.level < 2) {
      setError(t('新密码强度太弱，请使用更复杂的密码'));
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
      setError(t('当前主密码错误或修改失败'));
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 glass rounded-2xl mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Icon name="key" className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-white">{t('修改主密码')}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Icon name="x" className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {success ? (
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
              <Icon name="check-circle" className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">{t('修改成功')}</h3>
            <p className="text-sm text-gray-400">{t('主密码已成功更新')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 当前密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('当前主密码')}
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg
                           text-white placeholder-gray-400 focus:outline-none focus:border-primary
                           pr-12"
                  placeholder={t("输入当前主密码")}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <Icon name={showCurrentPassword ? 'eye-off' : 'eye'} className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 新密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('新主密码')}
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg
                           text-white placeholder-gray-400 focus:outline-none focus:border-primary
                           pr-12"
                  placeholder={t("输入新主密码")}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <Icon name={showNewPassword ? 'eye-off' : 'eye'} className="w-5 h-5" />
                </button>
              </div>

              {/* 密码强度 */}
              {newPassword && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          level <= strength.level ? strength.color : 'bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">
                    {t('密码强度:')} <span className="text-white">{strength.text}</span>
                  </p>
                </div>
              )}
            </div>

            {/* 确认新密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('确认新密码')}
              </label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg
                         text-white placeholder-gray-400 focus:outline-none focus:border-primary"
                placeholder={t("再次输入新主密码")}
              />
            </div>

            {/* 错误信息 */}
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
                <Icon name="x-circle" className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 按钮组 */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-lg
                         text-gray-300 transition-colors"
              >
                {t('取消')}
              </button>
              <button
                type="submit"
                disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                className="flex-1 py-3 bg-primary hover:bg-primary/80 disabled:bg-gray-600
                         disabled:cursor-not-allowed rounded-lg text-white font-medium
                         transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>{t('修改中...')}</span>
                  </>
                ) : (
                  <>
                    <Icon name="key" className="w-5 h-5" />
                    <span>{t('确认修改')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChangePasswordDialog;
