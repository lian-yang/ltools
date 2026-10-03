import { useState, useEffect, useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import * as TunnelService from '../../bindings/ltools/plugins/tunnel/tunnelservice';
import {
  Tunnel,
  TunnelRuntimeInfo,
  InstallationStatus,
  CreateTunnelRequest,
  UpdateTunnelRequest,
  ProtocolType,
  ProxyType,
  FRPServerConfig,
  GlobalOptions
} from '../../bindings/ltools/plugins/tunnel/models';
import { Icon } from './Icon';
import { useToast } from '../hooks/useToast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Events } from '@wailsio/runtime';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Segmented,
  Skeleton,
  Toggle,
  type BadgeTone,
} from './ui';

type View = 'tunnels' | 'create' | 'edit' | 'settings';

interface TunnelFormData {
  name: string;
  protocol: ProtocolType;
  localHost: string;
  localPort: string;
  proxyType?: ProxyType;
  subdomain: string;
  frpServerAddress: string;
  frpServerToken: string;
  autoStart: boolean;
  enabled: boolean;
}

interface TunnelWidgetProps {
  onBack: () => void;
}

/**
 * 隧道状态 → 徽章(文案 + 色调)
 */
function getStatusDisplay(status?: TunnelRuntimeInfo): { text: string; tone: BadgeTone } {
  if (!status) return { text: '已停止', tone: 'neutral' };
  switch (status.status) {
    case 'running':
      return { text: '运行中', tone: 'success' };
    case 'starting':
      return { text: '启动中', tone: 'warning' };
    case 'error':
      return { text: '错误', tone: 'error' };
    default:
      return { text: '已停止', tone: 'neutral' };
  }
}

/**
 * 表单字段组(创建 / 编辑共用,仅渲染)
 */
function TunnelFormFields({
  formData,
  setFormData,
  isEdit,
}: {
  formData: TunnelFormData;
  setFormData: Dispatch<SetStateAction<TunnelFormData>>;
  isEdit: boolean;
}): JSX.Element {
  return (
    <div className="space-y-4">
      {/* 基本信息 */}
      <div className="space-y-3.5">
        <Field label={isEdit ? '隧道名称' : '隧道名称 *'}>
          <Input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="例如: 我的 Web 服务"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={isEdit ? '本地地址' : '本地地址 *'}>
            <Input
              type="text"
              value={formData.localHost}
              onChange={(e) => setFormData({ ...formData, localHost: e.target.value })}
              placeholder="127.0.0.1"
              className="font-mono"
            />
          </Field>
          <Field label={isEdit ? '本地端口' : '本地端口 *'}>
            <Input
              type="number"
              value={formData.localPort}
              onChange={(e) => setFormData({ ...formData, localPort: e.target.value })}
              placeholder="3000"
              min="1"
              max="65535"
              className="tnum font-mono"
            />
          </Field>
        </div>
      </div>

      {/* FRP 配置 */}
      <div className="hairline-t space-y-3.5 pt-4">
        <h3 className="text-[12px] font-semibold text-text-2">FRP 配置</h3>

        <Field label="代理类型">
          <Select
            value={formData.proxyType}
            onValueChange={(value) => setFormData({ ...formData, proxyType: value as ProxyType })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择代理类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ProxyType.ProxyTypeHTTP}>HTTP</SelectItem>
              <SelectItem value={ProxyType.ProxyTypeHTTPS}>HTTPS</SelectItem>
              <SelectItem value={ProxyType.ProxyTypeTCP}>TCP</SelectItem>
              <SelectItem value={ProxyType.ProxyTypeSTCP}>STCP (秘密 TCP)</SelectItem>
              <SelectItem value={ProxyType.ProxyTypeXTCP}>XTCP (P2P TCP)</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="子域名 (可选)" hint={isEdit ? undefined : '需要服务端支持自定义域名'}>
          <Input
            type="text"
            value={formData.subdomain}
            onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
            placeholder="例如: myapp"
            className="font-mono"
          />
        </Field>

        <Field label={isEdit ? '服务器地址' : '服务器地址 *'}>
          <Input
            type="text"
            value={formData.frpServerAddress}
            onChange={(e) => setFormData({ ...formData, frpServerAddress: e.target.value })}
            placeholder="例如: frp.example.com:7000"
            className="font-mono"
          />
        </Field>

        <Field label={isEdit ? '认证 Token' : '认证 Token *'}>
          <Input
            type="password"
            value={formData.frpServerToken}
            onChange={(e) => setFormData({ ...formData, frpServerToken: e.target.value })}
            placeholder="输入服务器 Token"
            className="font-mono"
          />
        </Field>
      </div>

      {/* 其他选项 */}
      <div className="hairline-t pt-1">
        <Field horizontal label="自启动" hint="应用启动时自动启动此隧道">
          <Toggle
            checked={formData.autoStart}
            onChange={(v) => setFormData({ ...formData, autoStart: v })}
            label="自启动"
          />
        </Field>
      </div>
    </div>
  );
}

export function TunnelWidget({ onBack }: TunnelWidgetProps): JSX.Element {
  const [view, setView] = useState<View>('tunnels');
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [statuses, setStatuses] = useState<TunnelRuntimeInfo[]>([]);
  const [installStatus, setInstallStatus] = useState<InstallationStatus | null>(null);
  const [globalOptions, setGlobalOptions] = useState<GlobalOptions | null>(null);
  const [editingTunnel, setEditingTunnel] = useState<Tunnel | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [currentLog, setCurrentLog] = useState<string>('');
  const [currentLogTitle, setCurrentLogTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const toast = useToast();
  const { success: notifySuccess, info: notifyInfo, error: notifyError } = toast;

  // 表单状态
  const [formData, setFormData] = useState<TunnelFormData>({
    name: '',
    protocol: ProtocolType.ProtocolFRP,
    localHost: '127.0.0.1',
    localPort: '3000',
    proxyType: ProxyType.ProxyTypeHTTP,
    subdomain: '',
    frpServerAddress: '',
    frpServerToken: '',
    autoStart: false,
    enabled: true
  });

  // 设置表单状态
  const [settingsForm, setSettingsForm] = useState({
    frpServerAddress: '',
    frpServerToken: ''
  });

  // 加载隧道列表
  const loadTunnels = useCallback(async () => {
    try {
      const result = await TunnelService.GetTunnels();
      setTunnels(result || []);
      setLoadError(false);
    } catch (error) {
      console.error('Failed to load tunnels:', error);
      setLoadError(true);
    }
  }, []);

  // 加载状态和安装信息
  const loadStatuses = useCallback(async () => {
    try {
      const [status, install] = await Promise.all([
        TunnelService.GetAllTunnelStatuses(),
        TunnelService.GetInstallationStatus()
      ]);
      setStatuses(status || []);
      setInstallStatus(install || null);
    } catch (error) {
      console.error('Failed to load statuses:', error);
    }
  }, []);

  // 加载全局配置
  const loadGlobalOptions = useCallback(async () => {
    try {
      const opts = await TunnelService.GetGlobalOptions();
      setGlobalOptions(opts);
      if (opts?.frpServer) {
        setSettingsForm({
          frpServerAddress: opts.frpServer.address || '',
          frpServerToken: opts.frpServer.token || ''
        });
      }
    } catch (error) {
      console.error('Failed to load global options:', error);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    Promise.all([loadTunnels(), loadStatuses(), loadGlobalOptions()]).finally(() => {
      setInitialLoading(false);
    });
  }, [loadTunnels, loadStatuses, loadGlobalOptions]);

  // 定时刷新状态
  useEffect(() => {
    const interval = setInterval(() => {
      loadStatuses();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadStatuses]);

  // 监听后端事件
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // 隧道启动成功
    unsubscribers.push(Events.On('tunnel:started', (ev: { data: string }) => {
      notifySuccess(`隧道 "${ev.data}" 已启动`);
      loadStatuses();
    }));

    // 隧道停止
    unsubscribers.push(Events.On('tunnel:stopped', (ev: { data: string }) => {
      notifyInfo(`隧道 "${ev.data}" 已停止`);
      loadStatuses();
    }));

    // 隧道错误
    unsubscribers.push(Events.On('tunnel:error', (ev: { data: { tunnelId: string; error: string } }) => {
      notifyError(`隧道 "${ev.data.tunnelId}" 错误: ${ev.data.error}`);
      loadStatuses();
    }));

    // 隧道 URL 更新
    unsubscribers.push(Events.On('tunnel:url', (ev: { data: { tunnelId: string; url: string } }) => {
      notifySuccess(`隧道 "${ev.data.tunnelId}" 公网地址: ${ev.data.url}`);
      loadStatuses();
    }));

    // 安装进度
    unsubscribers.push(Events.On('tunnel:install:progress', (ev: { data: string }) => {
      console.log('[FRP Install]', ev.data);
    }));

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [loadStatuses, notifySuccess, notifyInfo, notifyError]);

  const handleDeleteTunnel = async (id: string) => {
    if (!confirm('确定要删除此隧道吗？')) return;

    setIsLoading(true);
    try {
      const result = await TunnelService.DeleteTunnel(id);
      if (result?.success) {
        toast.success('隧道删除成功');
        await loadTunnels();
      } else {
        toast.error(result?.error || '删除失败');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTunnel = async (id: string) => {
    setIsLoading(true);
    try {
      const result = await TunnelService.StartTunnel(id);
      if (result?.success) {
        toast.success('隧道启动成功');
        await loadStatuses();
      } else {
        toast.error(result?.error || '启动失败');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopTunnel = async (id: string) => {
    setIsLoading(true);
    try {
      const result = await TunnelService.StopTunnel(id);
      if (result?.success) {
        toast.success('隧道停止成功');
        await loadStatuses();
      } else {
        toast.error(result?.error || '停止失败');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestartTunnel = async (id: string) => {
    setIsLoading(true);
    try {
      const result = await TunnelService.RestartTunnel(id);
      if (result?.success) {
        toast.success('隧道重启成功');
        await loadStatuses();
      } else {
        toast.error(result?.error || '重启失败');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstallFRP = async () => {
    setIsLoading(true);
    try {
      const result = await TunnelService.InstallFRP();
      if (result?.success) {
        toast.success('FRP 安装成功');
        await loadStatuses();
      } else {
        toast.error(result?.error || '安装失败');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      const opts = new GlobalOptions({
        defaultProtocol: ProtocolType.ProtocolFRP,
        frpServer: new FRPServerConfig({
          address: settingsForm.frpServerAddress,
          token: settingsForm.frpServerToken
        })
      });

      const result = await TunnelService.SetGlobalOptions(opts);
      if (result?.success) {
        toast.success('设置保存成功');
        await loadGlobalOptions();
      } else {
        toast.error(result?.error || '保存失败');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 复制到剪贴板
  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label}已复制到剪贴板`);
    } catch {
      toast.error('复制失败');
    }
  };

  // 查看日志
  const [currentLogTunnelId, setCurrentLogTunnelId] = useState<string>('');
  const [autoRefreshLog, setAutoRefreshLog] = useState<boolean>(true);
  const logRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleViewLog = async (tunnel: Tunnel) => {
    const status = getTunnelStatus(tunnel.id);
    if (!status?.logPath) {
      toast.info('暂无日志文件');
      return;
    }

    setCurrentLogTunnelId(tunnel.id);
    setCurrentLogTitle(`隧道 "${tunnel.name}" 日志`);
    setShowLogModal(true);
    setAutoRefreshLog(true);

    // 立即加载日志
    await loadLogContent(tunnel.id);
  };

  const loadLogContent = async (tunnelId: string, lineCount: number = 100) => {
    try {
      const logContent = await TunnelService.GetTunnelLog(tunnelId, lineCount);
      setCurrentLog(logContent || '(暂无日志内容)');
    } catch (error: any) {
      setCurrentLog(`加载日志失败: ${error?.message || '未知错误'}`);
    }
  };

  // 日志自动刷新
  useEffect(() => {
    if (showLogModal && autoRefreshLog && currentLogTunnelId) {
      logRefreshIntervalRef.current = setInterval(() => {
        loadLogContent(currentLogTunnelId, 100);
      }, 2000);
    }

    return () => {
      if (logRefreshIntervalRef.current) {
        clearInterval(logRefreshIntervalRef.current);
        logRefreshIntervalRef.current = null;
      }
    };
  }, [showLogModal, autoRefreshLog, currentLogTunnelId]);

  const handleCloseLogModal = () => {
    setShowLogModal(false);
    setCurrentLogTunnelId('');
    setCurrentLog('');
    if (logRefreshIntervalRef.current) {
      clearInterval(logRefreshIntervalRef.current);
      logRefreshIntervalRef.current = null;
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: '',
      protocol: ProtocolType.ProtocolFRP,
      localHost: '127.0.0.1',
      localPort: '3000',
      proxyType: ProxyType.ProxyTypeHTTP,
      subdomain: '',
      frpServerAddress: globalOptions?.frpServer?.address || '',
      frpServerToken: globalOptions?.frpServer?.token || '',
      autoStart: false,
      enabled: true
    });
  };

  // 初始化编辑表单
  const initEditForm = (tunnel: Tunnel) => {
    setFormData({
      name: tunnel.name,
      protocol: tunnel.protocol,
      localHost: tunnel.localHost,
      localPort: tunnel.localPort.toString(),
      proxyType: tunnel.proxyType || ProxyType.ProxyTypeHTTP,
      subdomain: tunnel.subdomain || '',
      frpServerAddress: tunnel.frpServer?.address || '',
      frpServerToken: tunnel.frpServer?.token || '',
      autoStart: tunnel.autoStart,
      enabled: tunnel.enabled
    });
  };

  // 切换到创建视图时重置表单
  const handleSwitchToCreate = () => {
    resetForm();
    setView('create');
  };

  // 切换到编辑视图时初始化表单
  const handleSwitchToEdit = (tunnel: Tunnel) => {
    setEditingTunnel(tunnel);
    initEditForm(tunnel);
    setView('edit');
  };

  // 验证表单
  const validateForm = (isEdit: boolean = false): { valid: boolean; error?: string } => {
    if (!formData.name.trim()) {
      return { valid: false, error: '请输入隧道名称' };
    }
    if (!formData.localHost.trim()) {
      return { valid: false, error: '请输入本地地址' };
    }
    const port = parseInt(formData.localPort);
    if (isNaN(port) || port < 1 || port > 65535) {
      return { valid: false, error: '端口号必须在 1-65535 之间' };
    }
    if (!isEdit || view === 'edit') {
      if (formData.protocol === ProtocolType.ProtocolFRP) {
        if (!formData.frpServerAddress.trim()) {
          return { valid: false, error: '请输入 FRP 服务器地址' };
        }
      }
    }
    return { valid: true };
  };

  // 处理创建隧道
  const handleCreateTunnel = async () => {
    const validation = validateForm(false);
    if (!validation.valid) {
      toast.error(validation.error || '表单验证失败');
      return;
    }

    setIsLoading(true);
    try {
      const request = new CreateTunnelRequest({
        name: formData.name,
        protocol: formData.protocol,
        localHost: formData.localHost,
        localPort: parseInt(formData.localPort),
        autoStart: formData.autoStart
      });

      const result = await TunnelService.CreateTunnel(request);

      if (result?.success) {
        // 如果是 FRP 协议，创建后需要更新以添加 FRP 配置
        if (formData.protocol === ProtocolType.ProtocolFRP) {
          await loadTunnels();
          const newTunnel = [...tunnels].find(t => t.name === formData.name);
          if (newTunnel) {
            const updateReq = new UpdateTunnelRequest({
              name: formData.name,
              protocol: formData.protocol,
              localHost: formData.localHost,
              localPort: parseInt(formData.localPort),
              enabled: true,
              autoStart: formData.autoStart,
              frpServer: new FRPServerConfig({
                address: formData.frpServerAddress,
                token: formData.frpServerToken
              }),
              proxyType: formData.proxyType,
              subdomain: formData.subdomain
            });

            await TunnelService.UpdateTunnel(newTunnel.id, updateReq);
          }
        }

        toast.success('隧道创建成功');
        await loadTunnels();
        setView('tunnels');
      } else {
        toast.error(result?.error || '创建失败');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 处理更新隧道
  const handleUpdateTunnel = async () => {
    if (!editingTunnel) return;

    const validation = validateForm(true);
    if (!validation.valid) {
      toast.error(validation.error || '表单验证失败');
      return;
    }

    setIsLoading(true);
    try {
      const request = new UpdateTunnelRequest({
        name: formData.name,
        protocol: formData.protocol,
        localHost: formData.localHost,
        localPort: parseInt(formData.localPort),
        enabled: formData.enabled,
        autoStart: formData.autoStart
      });

      // 如果是 FRP 协议，添加 FRP 相关配置
      if (formData.protocol === ProtocolType.ProtocolFRP) {
        request.frpServer = new FRPServerConfig({
          address: formData.frpServerAddress,
          token: formData.frpServerToken
        });
        request.proxyType = formData.proxyType;
        request.subdomain = formData.subdomain;
      }

      const result = await TunnelService.UpdateTunnel(editingTunnel.id, request);

      if (result?.success) {
        toast.success('隧道更新成功');
        await loadTunnels();
        setView('tunnels');
      } else {
        toast.error(result?.error || '更新失败');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getTunnelStatus = (tunnelId: string): TunnelRuntimeInfo | undefined => {
    return statuses.find(s => s.tunnelId === tunnelId);
  };

  const renderTunnelsView = () => {
    if (initialLoading) {
      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[176px] rounded-[9px]" />
          ))}
        </div>
      );
    }

    if (loadError && tunnels.length === 0) {
      return (
        <Card inset>
          <EmptyState
            icon="exclamation-circle"
            title="隧道列表加载失败"
            description="无法获取隧道配置,请重试"
            action={
              <Button variant="primary" icon="refresh" onClick={() => { setInitialLoading(true); Promise.all([loadTunnels(), loadStatuses()]).finally(() => setInitialLoading(false)); }}>
                重新加载
              </Button>
            }
          />
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {/* FRP 安装状态提示 */}
        {installStatus && !installStatus.frpInstalled && (
          <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
            <Icon name="alert-circle" size={16} className="shrink-0 text-warning-text" />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-text-1">FRP 未安装</p>
              <p className="text-[11.5px] text-text-3">请先安装 FRP 或配置 FRP 路径</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setView('settings')}>
              去设置
            </Button>
          </div>
        )}

        {tunnels.length === 0 ? (
          <Card inset>
            <EmptyState
              icon="network"
              title="暂无隧道配置"
              description="创建您的第一个隧道以开始内网穿透"
              action={
                <Button variant="primary" icon="plus" onClick={handleSwitchToCreate} disabled={isLoading}>
                  创建隧道
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {tunnels.map(tunnel => {
              const status = getTunnelStatus(tunnel.id);
              const statusDisplay = getStatusDisplay(status);
              const isRunning = status?.status === 'running';
              const isStarting = status?.status === 'starting';

              return (
                <Card key={tunnel.id} className="flex flex-col p-4">
                  {/* 头部:名称 + 状态徽章 */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-[13px] font-semibold text-text-1" title={tunnel.name}>
                        {tunnel.name}
                      </h3>
                      <p className="mt-0.5 truncate font-mono text-[10.5px] text-text-4" title={tunnel.id}>
                        {tunnel.id}
                      </p>
                    </div>
                    <Badge tone={statusDisplay.tone} className="shrink-0">
                      {statusDisplay.text}
                    </Badge>
                  </div>

                  {/* 信息区 */}
                  <div className="mt-3 space-y-1.5 text-[12px]">
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-[11.5px] text-text-4">类型</span>
                      <Badge tone="neutral">{tunnel.proxyType || 'FRP'}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-[11.5px] text-text-4">本地</span>
                      <code className="truncate select-text font-mono text-[11.5px] text-text-1">
                        {tunnel.localHost}:{tunnel.localPort}
                      </code>
                    </div>
                    {tunnel.subdomain && (
                      <div className="flex items-center gap-2">
                        <span className="w-12 shrink-0 text-[11.5px] text-text-4">子域名</span>
                        <span className="truncate text-text-2">{tunnel.subdomain}</span>
                      </div>
                    )}
                    {status?.publicUrl && (
                      <div className="flex items-center gap-2">
                        <span className="w-12 shrink-0 text-[11.5px] text-text-4">公网</span>
                        <a
                          href={status.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 flex-1 truncate text-accent-text hover:underline"
                          title={status.publicUrl}
                        >
                          {status.publicUrl}
                        </a>
                        <IconButton
                          name="copy"
                          label="复制公网地址"
                          size="sm"
                          onClick={() => handleCopy(status.publicUrl!, '公网地址')}
                        />
                      </div>
                    )}
                    {status?.lastError && (
                      <div className="card-inset mt-2 px-3 py-2 text-[11.5px] leading-relaxed text-error-text">
                        <span className="font-medium">错误: </span>
                        {status.lastError}
                      </div>
                    )}
                  </div>

                  {/* 操作栏 */}
                  <div className="hairline-t mt-3 flex items-center justify-between gap-2 pt-3">
                    <div className="flex items-center gap-0.5">
                      {isRunning ? (
                        <IconButton
                          name="stop"
                          label="停止"
                          tone="danger"
                          onClick={() => handleStopTunnel(tunnel.id)}
                          disabled={isLoading}
                        />
                      ) : (
                        <IconButton
                          name="play"
                          label="启动"
                          onClick={() => handleStartTunnel(tunnel.id)}
                          disabled={isLoading || isStarting}
                        />
                      )}
                      <IconButton
                        name="refresh"
                        label="重启"
                        onClick={() => handleRestartTunnel(tunnel.id)}
                        disabled={isLoading || isStarting}
                      />
                      <IconButton name="log" label="查看日志" onClick={() => handleViewLog(tunnel)} />
                      <IconButton name="pencil" label="编辑" onClick={() => handleSwitchToEdit(tunnel)} />
                      <IconButton
                        name="trash"
                        label="删除"
                        tone="danger"
                        onClick={() => handleDeleteTunnel(tunnel.id)}
                        disabled={isLoading}
                      />
                    </div>
                    {tunnel.autoStart && (
                      <span className="flex shrink-0 items-center gap-1 text-[11px] text-text-3">
                        <Icon name="check" size={12} />
                        自启动
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderSettingsView = () => (
    <div className="max-w-2xl space-y-4">
      {/* 安装状态 */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="card-inset flex h-10 w-10 shrink-0 items-center justify-center">
              <Icon
                name={installStatus?.frpInstalled ? 'check-circle' : 'alert-circle'}
                size={18}
                className={installStatus?.frpInstalled ? 'text-success-text' : 'text-warning-text'}
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold text-text-1">FRP 安装状态</h3>
              <p className="truncate text-[12px] text-text-3">
                {installStatus?.frpInstalled
                  ? `已安装${installStatus.frpVersion ? ` (${installStatus.frpVersion})` : ''}`
                  : '未安装'}
              </p>
            </div>
          </div>
          {!installStatus?.frpInstalled && (
            <Button variant="primary" onClick={handleInstallFRP} loading={isLoading} disabled={isLoading} className="shrink-0">
              安装 FRP
            </Button>
          )}
        </div>

        {!installStatus?.frpInstalled && (
          <div className="card-inset mt-3 px-3.5 py-3 text-[12px] leading-relaxed text-text-2">
            <p>FRP 是一个高性能的反向代理应用，用于内网穿透。</p>
            <p className="mt-1">
              也可以手动从{' '}
              <a
                href="https://github.com/fatedier/frp/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-text hover:underline"
              >
                GitHub Releases
              </a>{' '}
              下载并安装到系统 PATH。
            </p>
          </div>
        )}
      </Card>

      {/* 默认服务器配置 */}
      <Card className="p-4">
        <h3 className="mb-3.5 flex items-center gap-2 text-[13px] font-semibold text-text-1">
          <Icon name="server" size={15} className="text-text-3" />
          默认 FRP 服务器
        </h3>

        <div className="space-y-3.5">
          <Field label="服务器地址" hint="FRP 服务器的地址和端口">
            <Input
              type="text"
              value={settingsForm.frpServerAddress}
              onChange={(e) => setSettingsForm({ ...settingsForm, frpServerAddress: e.target.value })}
              placeholder="例如: frp.example.com:7000"
              className="font-mono"
            />
          </Field>

          <Field label="认证 Token" hint="用于连接 FRP 服务器的认证令牌">
            <Input
              type="password"
              value={settingsForm.frpServerToken}
              onChange={(e) => setSettingsForm({ ...settingsForm, frpServerToken: e.target.value })}
              placeholder="输入服务器 Token"
              className="font-mono"
            />
          </Field>

          <div className="hairline-t pt-3.5">
            <Button variant="primary" icon="save" onClick={handleSaveSettings} loading={isLoading} disabled={isLoading}>
              保存设置
            </Button>
          </div>
        </div>
      </Card>

      {/* 使用说明 */}
      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-text-1">
          <Icon name="information-circle" size={15} className="text-text-3" />
          使用说明
        </h3>
        <div className="space-y-1.5 text-[12px] leading-relaxed text-text-2">
          <p>1. 确保 FRP 服务端 (frps) 已部署并运行</p>
          <p>2. 在设置中配置默认 FRP 服务器地址和 Token</p>
          <p>3. 创建隧道时选择代理类型（HTTP、HTTPS、TCP 等）</p>
          <p>4. 启动隧道后，系统会分配公网访问地址</p>
          <p>5. 支持子域名配置（需要服务端支持）</p>
        </div>
      </Card>
    </div>
  );

  // 渲染创建表单
  const renderCreateForm = () => (
    <Card className="max-w-2xl p-5">
      <h2 className="mb-4 text-[14px] font-semibold text-text-1">创建新隧道</h2>

      <TunnelFormFields formData={formData} setFormData={setFormData} isEdit={false} />

      {/* 按钮组 */}
      <div className="hairline-t mt-5 flex gap-2 pt-4">
        <Button variant="primary" onClick={handleCreateTunnel} loading={isLoading} disabled={isLoading}>
          创建隧道
        </Button>
        <Button variant="secondary" onClick={() => setView('tunnels')} disabled={isLoading}>
          取消
        </Button>
      </div>
    </Card>
  );

  // 渲染编辑表单
  const renderEditForm = () => (
    <Card className="max-w-2xl p-5">
      <h2 className="mb-4 truncate text-[14px] font-semibold text-text-1">
        编辑隧道: {editingTunnel?.name ?? ''}
      </h2>

      <TunnelFormFields formData={formData} setFormData={setFormData} isEdit={true} />

      {/* 按钮组 */}
      <div className="hairline-t mt-5 flex gap-2 pt-4">
        <Button variant="primary" onClick={handleUpdateTunnel} loading={isLoading} disabled={isLoading}>
          保存更改
        </Button>
        <Button variant="secondary" onClick={() => setView('tunnels')} disabled={isLoading}>
          取消
        </Button>
      </div>
    </Card>
  );

  // 日志查看弹窗
  const renderLogModal = () => (
    <Modal
      open={showLogModal}
      onClose={handleCloseLogModal}
      title={
        <span className="flex items-center gap-2">
          <Icon name="terminal" size={15} className="text-text-2" />
          {currentLogTitle}
        </span>
      }
      width={880}
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            icon="refresh"
            onClick={() => loadLogContent(currentLogTunnelId, 100)}
          >
            刷新
          </Button>
          <Button variant="primary" size="sm" onClick={handleCloseLogModal}>
            关闭
          </Button>
        </>
      }
    >
      {/* 工具栏 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-[11.5px] text-text-3">显示最后 100 行</span>
          {autoRefreshLog && (
            <span className="flex items-center gap-1.5 text-[11.5px] text-success-text">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--color-success)' }}
              />
              实时刷新中
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="select-none text-[12px] text-text-2">自动刷新</span>
          <Toggle
            checked={autoRefreshLog}
            onChange={setAutoRefreshLog}
            label="自动刷新日志"
          />
        </div>
      </div>

      {/* 日志内容 */}
      <div className="card-inset max-h-[50vh] overflow-auto p-3.5">
        <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-text-2">
          {currentLog || '(暂无日志)'}
        </pre>
      </div>
    </Modal>
  );

  // 顶部页签(编辑态高亮"创建隧道")
  const tabValue: 'tunnels' | 'create' | 'settings' = view === 'edit' ? 'create' : view;

  return (
    <div className="mx-auto min-w-0 max-w-5xl">
      {renderLogModal()}

      {/* 返回 */}
      <div className="mb-3">
        <IconButton name="arrow-left" label="返回" onClick={onBack} />
      </div>

      {/* 页头 + 页签 */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">隧道管理</h1>
          <p className="page-subtitle">管理 FRP 内网穿透隧道</p>
        </div>
        <Segmented<'tunnels' | 'create' | 'settings'>
          options={[
            { value: 'tunnels', label: '隧道列表' },
            { value: 'create', label: '创建隧道' },
            { value: 'settings', label: '设置' },
          ]}
          value={tabValue}
          onChange={(v) => {
            if (v === 'create') {
              handleSwitchToCreate();
            } else {
              setView(v);
            }
          }}
        />
      </div>

      {view === 'tunnels' && renderTunnelsView()}
      {view === 'create' && renderCreateForm()}
      {view === 'edit' && editingTunnel && renderEditForm()}
      {view === 'settings' && renderSettingsView()}
    </div>
  );
}
