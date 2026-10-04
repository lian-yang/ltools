import React, { useState } from 'react';
import * as VaultService from '../../../bindings/ltools/plugins/vault/vaultservice';
import { Icon } from '../Icon';
import { t } from '@/i18n';

interface VaultSetupProps {
  onComplete: () => void;
}

const VaultSetup: React.FC<VaultSetupProps> = ({ onComplete }) => {
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const strength = getPasswordStrength(masterPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 验证
    if (masterPassword.length < 8) {
      setError(t('主密码至少需要 8 个字符'));
      return;
    }

    if (masterPassword !== confirmPassword) {
      setError(t('两次输入的密码不一致'));
      return;
    }

    if (strength.level < 2) {
      setError(t('密码强度太弱，请使用更复杂的密码'));
      return;
    }

    setLoading(true);
    try {
      await VaultService.Setup(masterPassword);
      onComplete();
    } catch (err) {
      setError(t('设置失败，请重试'));
      console.error('Setup failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-md p-8 glass rounded-2xl">
        {/* 头部 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-4">
            <Icon name="shield" className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{t('创建密码保险库')}</h1>
          <p className="text-gray-400">
            {t('设置一个主密码来保护您的所有密码')}
          </p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 主密码 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('主密码')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg
                         text-white placeholder-gray-400 focus:outline-none focus:border-primary
                         pr-12"
                placeholder={t("输入主密码")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} className="w-5 h-5" />
              </button>
            </div>

            {/* 密码强度指示器 */}
            {masterPassword && (
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

          {/* 确认密码 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('确认密码')}
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg
                       text-white placeholder-gray-400 focus:outline-none focus:border-primary"
              placeholder={t("再次输入主密码")}
            />
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* 提示 */}
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex gap-3">
              <Icon name="warning" className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-300">
                <p className="font-medium text-yellow-500 mb-1">{t('重要提示')}</p>
                <p>
                  {t('主密码是访问您所有密码的唯一方式。如果忘记主密码，将无法恢复您的数据。 请务必牢记您的主密码。')}
                </p>
              </div>
            </div>
          </div>

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading || !masterPassword || !confirmPassword}
            className="w-full py-3 bg-primary hover:bg-primary/80 disabled:bg-gray-600
                     disabled:cursor-not-allowed rounded-lg text-white font-medium
                     transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>{t('创建中...')}</span>
              </>
            ) : (
              <>
                <Icon name="shield" className="w-5 h-5" />
                <span>{t('创建保险库')}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default VaultSetup;
