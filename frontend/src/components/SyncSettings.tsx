import { useState, useEffect, useCallback } from 'react';
import { Icon } from './Icon';
import { useToast } from '../hooks/useToast';
import * as SyncService from '../../bindings/ltools/internal/sync/syncservice';
import { SyncConfig, SyncStatus } from '../../bindings/ltools/internal/sync/models';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { t } from '@/i18n';

/**
 * 同步设置组件
 */
export function SyncSettings() {
  const { success, error } = useToast();
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [token, setToken] = useState('');

  // 加载配置和状态
  const loadData = useCallback(async () => {
    try {
      const [cfg, st] = await Promise.all([
        SyncService.GetConfig(),
        SyncService.GetStatus(),
      ]);
      setConfig(cfg);
      setStatus(st);
    } catch (err: any) {
      console.error('Failed to load sync config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // 定时刷新状态
    const interval = setInterval(() => {
      SyncService.GetStatus().then(setStatus);
    }, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  // 检查 Git 是否安装
  const [gitInstalled, setGitInstalled] = useState(true);
  const [sshAvailable, setSshAvailable] = useState(false);

  useEffect(() => {
    SyncService.IsGitInstalled().then(setGitInstalled);
    SyncService.CheckSSHCredential().then(setSshAvailable);
  }, []);

  // 保存配置
  const saveConfig = async (newConfig: SyncConfig) => {
    try {
      await SyncService.SetConfig(newConfig);
      setConfig(newConfig);
      success(t('配置已保存'));
    } catch (err: any) {
      error(t('保存失败: {msg}', { msg: err.message || err }));
    }
  };

  // 测试连接
  const testConnection = async () => {
    if (!config?.repoUrl) {
      error(t('请先输入仓库地址'));
      return;
    }

    setTesting(true);
    try {
      const result = await SyncService.TestConnection(config.repoUrl);
      if (result?.success) {
        success(t('连接成功 ({method})', { method: result.authMethod }));
      } else {
        error(result?.message || t('连接失败'));
      }
    } catch (err: any) {
      error(t('连接失败: {msg}', { msg: err.message || err }));
    } finally {
      setTesting(false);
    }
  };

  // 执行同步
  const performSync = async () => {
    setSyncing(true);
    try {
      const result = await SyncService.Sync();
      if (result?.success) {
        success(result.message || t('同步成功'));
        loadData();
      } else {
        error(result?.error || t('同步失败'));
      }
    } catch (err: any) {
      error(t('同步失败: {msg}', { msg: err.message || err }));
    } finally {
      setSyncing(false);
    }
  };

  // 保存 Token
  const saveToken = async () => {
    if (!token.trim()) {
      error(t('请输入访问令牌'));
      return;
    }
    try {
      await SyncService.StoreToken(token);
      success(t('令牌已保存'));
      setShowTokenInput(false);
      setToken('');
    } catch (err: any) {
      error(t('保存失败: {msg}', { msg: err.message || err }));
    }
  };

  // 格式化时间
  const formatTime = (time: any) => {
    if (!time) return t('从未');
    try {
      const date = new Date(time);
      return date.toLocaleString('zh-CN');
    } catch {
      return t('从未');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C3AED]"></div>
      </div>
    );
  }

  if (!gitInstalled) {
    return (
      <div className="glass-light rounded-xl p-6">
        <div className="flex items-center gap-3 text-[#F59E0B]">
          <Icon name="exclamation-circle" size={24} />
          <div>
            <h3 className="font-semibold">{t('Git 未安装')}</h3>
            <p className="text-sm text-white/50">{t('请先安装 Git 以使用同步功能')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 状态卡片 */}
      <div className="glass-light rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Icon name="server" size={20} color="#A78BFA" />
          {t('同步状态')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#0D0F1A]/50 rounded-lg p-4">
            <p className="text-white/50 text-sm">{t('状态')}</p>
            <p className="text-white font-medium mt-1">
              {status?.enabled ? (
                <span className="text-[#22C55E]">{t('已启用')}</span>
              ) : (
                <span className="text-white/50">{t('未启用')}</span>
              )}
            </p>
          </div>
          <div className="bg-[#0D0F1A]/50 rounded-lg p-4">
            <p className="text-white/50 text-sm">{t('自动同步')}</p>
            <p className="text-white font-medium mt-1">
              {status?.autoSync ? t('已开启') : t('已关闭')}
            </p>
          </div>
          <div className="bg-[#0D0F1A]/50 rounded-lg p-4">
            <p className="text-white/50 text-sm">{t('上次同步')}</p>
            <p className="text-white font-medium mt-1 text-sm">
              {formatTime(status?.lastSyncTime)}
            </p>
          </div>
          <div className="bg-[#0D0F1A]/50 rounded-lg p-4">
            <p className="text-white/50 text-sm">{t('待同步更改')}</p>
            <p className="text-white font-medium mt-1">
              {status?.hasChanges ? (
                <span className="text-[#F59E0B]">{t('有')}</span>
              ) : (
                <span className="text-[#22C55E]">{t('无')}</span>
              )}
            </p>
          </div>
        </div>
        {status?.error && (
          <div className="mt-4 p-3 bg-[#EF4444]/10 rounded-lg border border-[#EF4444]/20">
            <p className="text-[#EF4444] text-sm">{status.error}</p>
          </div>
        )}
      </div>

      {/* 仓库配置 */}
      <div className="glass-light rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Icon name="code" size={20} color="#A78BFA" />
          {t('仓库配置')}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-white/70 text-sm mb-2">{t('Git 仓库地址')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 bg-[#0D0F1A]/50 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 focus:border-[#7C3AED] focus:outline-none"
                placeholder="git@github.com:username/ltools-sync.git"
                value={config?.repoUrl || ''}
                onChange={(e) => {
                  if (config) {
                    setConfig({ ...config, repoUrl: e.target.value });
                  }
                }}
                onBlur={() => config && saveConfig(config)}
              />
              <button
                className="px-4 py-2 bg-[#7C3AED]/20 hover:bg-[#7C3AED]/30 text-[#A78BFA] rounded-lg transition-all duration-200 clickable"
                onClick={testConnection}
                disabled={testing || !config?.repoUrl}
              >
                {testing ? t('测试中...') : t('测试连接')}
              </button>
            </div>
            <p className="text-white/40 text-xs mt-2">
              {t('支持 SSH (git@...) 或 HTTPS (https://...) 格式')}
            </p>
          </div>

          {/* 认证信息 */}
          <div className="bg-[#0D0F1A]/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">{t('认证方式')}</p>
                <p className="text-white mt-1">
                  {sshAvailable ? (
                    <span className="flex items-center gap-2">
                      <Icon name="check-circle" size={16} color="#22C55E" />
                      {t('SSH 密钥已配置')}
                    </span>
                  ) : (
                    <span className="text-white/50">{t('SSH 未配置，可使用 HTTPS + Token')}</span>
                  )}
                </p>
              </div>
              {!sshAvailable && (
                <button
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg transition-all duration-200 clickable text-sm"
                  onClick={() => setShowTokenInput(!showTokenInput)}
                >
                  {showTokenInput ? t('取消') : t('设置 Token')}
                </button>
              )}
            </div>
            {showTokenInput && (
              <div className="mt-4 space-y-3">
                <input
                  type="password"
                  className="w-full bg-[#0D0F1A] border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 focus:border-[#7C3AED] focus:outline-none"
                  placeholder={t("输入 Personal Access Token")}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <button
                  className="px-4 py-2 bg-[#7C3AED] hover:bg-[#7C3AED]/80 text-white rounded-lg transition-all duration-200 clickable"
                  onClick={saveToken}
                >
                  {t('保存令牌')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 同步设置 */}
      <div className="glass-light rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Icon name="cog" size={20} color="#A78BFA" />
          {t('同步设置')}
        </h3>
        <div className="space-y-4">
          {/* 启用同步 */}
          <div className="flex items-center justify-between p-4 bg-[#0D0F1A]/50 rounded-lg">
            <div>
              <p className="text-white font-medium">{t('启用同步')}</p>
              <p className="text-white/50 text-sm">{t('开启后可将数据同步到 Git 仓库')}</p>
            </div>
            <button
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                config?.enabled ? 'bg-[#7C3AED]' : 'bg-white/20'
              }`}
              onClick={() => {
                if (config) {
                  const newEnabled = !config.enabled;
                  saveConfig({ ...config, enabled: newEnabled });
                }
              }}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                  config?.enabled ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* 自动同步 */}
          <div className="flex items-center justify-between p-4 bg-[#0D0F1A]/50 rounded-lg">
            <div>
              <p className="text-white font-medium">{t('自动同步')}</p>
              <p className="text-white/50 text-sm">{t('定时自动同步数据')}</p>
            </div>
            <button
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                config?.autoSync ? 'bg-[#7C3AED]' : 'bg-white/20'
              }`}
              onClick={() => {
                if (config) {
                  saveConfig({ ...config, autoSync: !config.autoSync });
                }
              }}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                  config?.autoSync ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* 同步间隔 */}
          <div className="p-4 bg-[#0D0F1A]/50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white font-medium">{t('同步间隔')}</p>
                <p className="text-white/50 text-sm">{t('自动同步的时间间隔')}</p>
              </div>
              <Select
                value={String(config?.syncInterval || 5)}
                onValueChange={(value) => {
                  if (config) {
                    saveConfig({ ...config, syncInterval: parseInt(value) });
                  }
                }}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t('1 分钟')}</SelectItem>
                  <SelectItem value="5">{t('5 分钟')}</SelectItem>
                  <SelectItem value="10">{t('10 分钟')}</SelectItem>
                  <SelectItem value="30">{t('30 分钟')}</SelectItem>
                  <SelectItem value="60">{t('1 小时')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* 手动同步 */}
      <div className="glass-light rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Icon name="refresh" size={20} color="#A78BFA" />
          {t('手动同步')}
        </h3>
        <div className="flex items-center gap-4">
          <button
            className={`px-6 py-3 rounded-lg transition-all duration-200 clickable font-medium ${
              syncing || !config?.enabled || !config?.repoUrl
                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                : 'bg-[#7C3AED] hover:bg-[#7C3AED]/80 text-white'
            }`}
            onClick={performSync}
            disabled={syncing || !config?.enabled || !config?.repoUrl}
          >
            {syncing ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {t('同步中...')}
              </span>
            ) : (
              t('立即同步')
            )}
          </button>
          {status?.lastSyncHash && (
            <p className="text-white/50 text-sm">
              {t('最后提交:')} {status.lastSyncHash.substring(0, 7)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
