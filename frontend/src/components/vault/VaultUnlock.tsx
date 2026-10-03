import React, { useState } from 'react';
import * as VaultService from '../../../bindings/ltools/plugins/vault/vaultservice';
import { Icon } from '../Icon';
import { Button, Input } from '../ui';

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
      setError('主密码错误，请重试');
      setMasterPassword('');
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
            <Icon name="lock" size={22} color="var(--color-accent-text)" />
          </div>
          <h1 className="text-[17px] font-semibold text-text-1">解锁保险库</h1>
          <p className="mt-1 text-[12px] text-text-3">输入您的主密码以访问密码保险库</p>
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
                autoFocus
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
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="flex items-center gap-2 rounded-[6px] px-3 py-2 text-[12px]" style={{ background: 'rgba(255,69,58,0.12)', color: 'var(--color-error-text)' }}>
              <Icon name="x-circle" size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* 提交按钮 */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={loading}
            disabled={!masterPassword}
            icon="unlock"
          >
            {loading ? '解锁中…' : '解锁'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default VaultUnlock;
