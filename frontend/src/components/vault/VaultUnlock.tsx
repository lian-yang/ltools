import React, { useState } from 'react';
import * as VaultService from '../../../bindings/ltools/plugins/vault/vaultservice';
import { Icon } from '../Icon';
import { t } from '@/i18n';

interface VaultUnlockProps {
  onSuccess: () => void;
}

const VaultUnlock: React.FC<VaultUnlockProps> = ({ onSuccess }) => {
  const [masterPassword, setMasterPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await VaultService.Unlock(masterPassword);
      onSuccess();
    } catch (err) {
      setError(t('主密码错误，请重试'));
      setMasterPassword('');
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
            <Icon name="lock" className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{t('解锁保险库')}</h1>
          <p className="text-gray-400">
            {t('输入您的主密码以访问密码保险库')}
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
                autoFocus
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
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
              <Icon name="x-circle" className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading || !masterPassword}
            className="w-full py-3 bg-primary hover:bg-primary/80 disabled:bg-gray-600
                     disabled:cursor-not-allowed rounded-lg text-white font-medium
                     transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>{t('解锁中...')}</span>
              </>
            ) : (
              <>
                <Icon name="unlock" className="w-5 h-5" />
                <span>{t('解锁')}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default VaultUnlock;
