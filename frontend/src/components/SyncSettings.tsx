import { useState, useEffect, useCallback } from 'react';
import * as SyncService from '../../bindings/ltools/internal/sync/syncservice';
import { SyncConfig, SyncStatus } from '../../bindings/ltools/internal/sync/models';
import { useToast } from '../hooks/useToast';
import { Icon } from './Icon';
import { Badge, Button, Field, Input, PageHeader, SectionTitle, Spinner, Toggle } from './ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

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
      SyncService.GetStatus()
        .then(setStatus)
        .catch(() => {
          /* 状态刷新失败时静默,等待下次轮询 */
        });
    }, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  // 检查 Git 是否安装
  const [gitInstalled, setGitInstalled] = useState(true);
  const [sshAvailable, setSshAvailable] = useState(false);

  useEffect(() => {
    SyncService.IsGitInstalled()
      .then(setGitInstalled)
      .catch((err) => console.error('Failed to check git:', err));
    SyncService.CheckSSHCredential()
      .then(setSshAvailable)
      .catch((err) => console.error('Failed to check SSH credential:', err));
  }, []);

  // 保存配置
  const saveConfig = async (newConfig: SyncConfig) => {
    try {
      await SyncService.SetConfig(newConfig);
      setConfig(newConfig);
      success('配置已保存');
    } catch (err: any) {
      error(`保存失败: ${err.message || err}`);
    }
  };

  // 测试连接
  const testConnection = async () => {
    if (!config?.repoUrl) {
      error('请先输入仓库地址');
      return;
    }

    setTesting(true);
    try {
      const result = await SyncService.TestConnection(config.repoUrl);
      if (result?.success) {
        success(`连接成功 (${result.authMethod})`);
      } else {
        error(result?.message || '连接失败');
      }
    } catch (err: any) {
      error(`连接失败: ${err.message || err}`);
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
        success(result.message || '同步成功');
        loadData();
      } else {
        error(result?.error || '同步失败');
      }
    } catch (err: any) {
      error(`同步失败: ${err.message || err}`);
    } finally {
      setSyncing(false);
    }
  };

  // 保存 Token
  const saveToken = async () => {
    if (!token.trim()) {
      error('请输入访问令牌');
      return;
    }
    try {
      await SyncService.StoreToken(token);
      success('令牌已保存');
      setShowTokenInput(false);
      setToken('');
    } catch (err: any) {
      error(`保存失败: ${err.message || err}`);
    }
  };

  // 格式化时间
  const formatTime = (time: any) => {
    if (!time) return '从未';
    try {
      const date = new Date(time);
      return date.toLocaleString('zh-CN');
    } catch {
      return '从未';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={20} />
      </div>
    );
  }

  if (!gitInstalled) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="同步" description="配置数据同步和备份选项" />
        <div className="flex items-center gap-3 rounded-[9px] border border-warning/20 bg-warning/10 p-4">
          <Icon name="exclamation-circle" size={20} className="shrink-0 text-warning-text" />
          <div>
            <h3 className="text-[13px] font-semibold text-warning-text">Git 未安装</h3>
            <p className="mt-0.5 text-[12px] text-text-3">请先安装 Git 以使用同步功能</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="同步" description="配置数据同步和备份选项" />

      {/* 同步状态 */}
      <SectionTitle title="同步状态" className="mb-2" />
      <div className="card-inset p-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
          <div>
            <p className="text-[11.5px] text-text-3">状态</p>
            <p className="mt-1 text-[12.5px] font-medium">
              {status?.enabled ? (
                <Badge tone="success">已启用</Badge>
              ) : (
                <Badge tone="neutral">未启用</Badge>
              )}
            </p>
          </div>
          <div>
            <p className="text-[11.5px] text-text-3">自动同步</p>
            <p className="mt-1 text-[12.5px] font-medium text-text-1">
              {status?.autoSync ? '已开启' : '已关闭'}
            </p>
          </div>
          <div>
            <p className="text-[11.5px] text-text-3">上次同步</p>
            <p className="tnum mt-1 truncate text-[12.5px] font-medium text-text-1" title={formatTime(status?.lastSyncTime)}>
              {formatTime(status?.lastSyncTime)}
            </p>
          </div>
          <div>
            <p className="text-[11.5px] text-text-3">待同步更改</p>
            <p className="mt-1 text-[12.5px] font-medium">
              {status?.hasChanges ? (
                <span className="text-warning-text">有</span>
              ) : (
                <span className="text-success-text">无</span>
              )}
            </p>
          </div>
        </div>
        {status?.error && (
          <div className="mt-4 rounded-[7px] border border-error/20 bg-error/10 px-3 py-2">
            <p className="text-[12px] text-error-text">{status.error}</p>
          </div>
        )}
      </div>

      {/* 仓库配置 */}
      <SectionTitle title="仓库配置" className="mb-2 mt-5" />
      <div className="card-inset px-4">
        <div className="hairline-b py-3">
          <Field
            label="Git 仓库地址"
            hint="支持 SSH (git@...) 或 HTTPS (https://...) 格式"
          >
            <div className="flex gap-2">
              <Input
                type="text"
                className="flex-1"
                placeholder="git@github.com:username/ltools-sync.git"
                value={config?.repoUrl || ''}
                onChange={(e) => {
                  if (config) {
                    setConfig({ ...config, repoUrl: e.target.value });
                  }
                }}
                onBlur={() => config && saveConfig(config)}
              />
              <Button
                variant="secondary"
                onClick={testConnection}
                disabled={testing || !config?.repoUrl}
                loading={testing}
              >
                {testing ? '测试中...' : '测试连接'}
              </Button>
            </div>
          </Field>
        </div>

        {/* 认证信息 */}
        <div className="py-3">
          <Field horizontal label="认证方式" hint={sshAvailable ? 'SSH 密钥已配置' : 'SSH 未配置，可使用 HTTPS + Token'}>
            {sshAvailable ? (
              <Badge tone="success">SSH 密钥已配置</Badge>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowTokenInput(!showTokenInput)}
              >
                {showTokenInput ? '取消' : '设置 Token'}
              </Button>
            )}
          </Field>
          {showTokenInput && !sshAvailable && (
            <div className="mt-3 flex flex-col items-start gap-2">
              <Input
                type="password"
                className="max-w-sm"
                placeholder="输入 Personal Access Token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <Button variant="primary" size="sm" onClick={saveToken}>
                保存令牌
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 同步选项 */}
      <SectionTitle title="同步选项" className="mb-2 mt-5" />
      <div className="card-inset px-4">
        <Field horizontal className="hairline-b" label="启用同步" hint="开启后可将数据同步到 Git 仓库">
          <Toggle
            checked={config?.enabled ?? false}
            onChange={(checked) => {
              if (config) {
                saveConfig({ ...config, enabled: checked });
              }
            }}
            label="启用同步"
          />
        </Field>
        <Field horizontal className="hairline-b" label="自动同步" hint="定时自动同步数据">
          <Toggle
            checked={config?.autoSync ?? false}
            onChange={(checked) => {
              if (config) {
                saveConfig({ ...config, autoSync: checked });
              }
            }}
            label="自动同步"
          />
        </Field>
        <Field horizontal label="同步间隔" hint="自动同步的时间间隔">
          <Select
            value={String(config?.syncInterval || 5)}
            onValueChange={(value) => {
              if (config) {
                saveConfig({ ...config, syncInterval: parseInt(value) });
              }
            }}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 分钟</SelectItem>
              <SelectItem value="5">5 分钟</SelectItem>
              <SelectItem value="10">10 分钟</SelectItem>
              <SelectItem value="30">30 分钟</SelectItem>
              <SelectItem value="60">1 小时</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {/* 手动同步 */}
      <SectionTitle title="手动同步" className="mb-2 mt-5" />
      <div className="card-inset flex items-center gap-3 p-4">
        <Button
          variant="primary"
          onClick={performSync}
          disabled={syncing || !config?.enabled || !config?.repoUrl}
          loading={syncing}
        >
          {syncing ? '同步中...' : '立即同步'}
        </Button>
        {status?.lastSyncHash && (
          <p className="tnum min-w-0 truncate font-mono text-[12px] text-text-3">
            最后提交: {status.lastSyncHash.substring(0, 7)}
          </p>
        )}
      </div>
    </div>
  );
}
