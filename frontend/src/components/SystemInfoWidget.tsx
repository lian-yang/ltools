import { useEffect, useState } from 'react';
import { Events } from '@wailsio/runtime';
import { SysInfoService, SystemInfo } from '../../bindings/ltools/plugins/sysinfo';
import { Icon } from './Icon';
import { t, getLanguage } from '@/i18n';

/**
 * 系统信息卡片组件
 */
interface InfoCardProps {
  icon: string;
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

function InfoCard({ icon, title, value, subtitle, color = '#A78BFA' }: InfoCardProps): JSX.Element {
  return (
    <div className="glass-light rounded-xl p-4 hover:bg-white/5 transition-all duration-200">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
          <Icon name={icon as any} size={18} color={color} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/40 uppercase tracking-wide mb-1">{title}</p>
          <p className="text-base font-semibold text-white tabular-nums truncate">{value}</p>
          {subtitle && (
            <p className="text-xs text-white/30 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * CPU 使用率组件
 */
interface CPUUsageProps {
  usage: number;
  cores: number;
  modelName?: string;
}

function CPUUsage({ usage, cores, modelName }: CPUUsageProps): JSX.Element {
  return (
    <div className="glass-light rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center">
            <Icon name="cpu" size={18} color="#7C3AED" />
          </div>
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wide">{t('CPU 使用率')}</p>
            <p className="text-base font-semibold text-white tabular-nums">{usage.toFixed(1)}%</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-xl font-bold tabular-nums ${
            usage > 80 ? 'text-[#EF4444]' : usage > 60 ? 'text-[#F59E0B]' : 'text-[#7C3AED]'
          }`}>
            {usage.toFixed(0)}%
          </p>
        </div>
      </div>
      {/* 进度条 */}
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            usage > 80 ? 'bg-[#EF4444]' : usage > 60 ? 'bg-[#F59E0B]' : 'bg-[#7C3AED]'
          }`}
          style={{ width: `${Math.min(usage, 100)}%` }}
        />
      </div>
      {modelName && (
        <p className="text-xs text-white/30 truncate">{modelName}</p>
      )}
      <p className="text-xs text-white/20 mt-0.5">{cores} {t('核心')}</p>
    </div>
  );
}

/**
 * 内存信息组件
 */
interface MemoryInfoProps {
  used: string;
  total: string;
  usedPercent: number;
  swapUsed?: string;
  swapTotal?: string;
  swapUsedPercent?: number;
}

function MemoryInfo({ used, total, usedPercent, swapUsed, swapTotal, swapUsedPercent }: MemoryInfoProps): JSX.Element {
  return (
    <div className="glass-light rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#22C55E]/10 flex items-center justify-center">
            <Icon name="memory" size={18} color="#22C55E" />
          </div>
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wide">{t('内存使用')}</p>
            <p className="text-base font-semibold text-white tabular-nums">{used} / {total}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-xl font-bold tabular-nums ${
            usedPercent > 80 ? 'text-[#EF4444]' : usedPercent > 60 ? 'text-[#F59E0B]' : 'text-[#22C55E]'
          }`}>
            {usedPercent.toFixed(0)}%
          </p>
        </div>
      </div>
      {/* 进度条 */}
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            usedPercent > 80 ? 'bg-[#EF4444]' : usedPercent > 60 ? 'bg-[#F59E0B]' : 'bg-[#22C55E]'
          }`}
          style={{ width: `${usedPercent}%` }}
        />
      </div>
      {/* Swap 信息 */}
      {swapTotal && swapUsed && (
        <div className="pt-2 border-t border-white/5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-white/30">{t('Swap 使用')}</p>
            <p className="text-xs text-white/40 tabular-nums">{swapUsed} / {swapTotal}</p>
          </div>
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                swapUsedPercent && swapUsedPercent > 50 ? 'bg-[#F59E0B]' : 'bg-[#3B82F6]'
              }`}
              style={{ width: `${swapUsedPercent || 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 磁盘使用组件
 */
interface DiskUsageProps {
  disks: Array<{
    path: string;
    total: string;
    used: string;
    free: string;
    usedPercent: number;
  }>;
}

function DiskUsage({ disks }: DiskUsageProps): JSX.Element | null {
  if (disks.length === 0) return null;

  return (
    <div className="glass-light rounded-xl p-4 flex flex-col">
      <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2 flex-shrink-0">
        <Icon name="disk" size={14} color="#A78BFA" />
        {t('磁盘使用情况')}
      </h3>
      <div className="space-y-3 overflow-y-auto max-h-40 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20">
        {disks.map((disk, index) => (
          <div key={index} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40 font-medium">{disk.path}</p>
              <p className="text-xs text-white/60 tabular-nums">{disk.used} / {disk.total}</p>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  disk.usedPercent > 90 ? 'bg-[#EF4444]' : disk.usedPercent > 75 ? 'bg-[#F59E0B]' : 'bg-[#3B82F6]'
                }`}
                style={{ width: `${disk.usedPercent}%` }}
              />
            </div>
            <p className="text-xs text-right" style={{
              color: disk.usedPercent > 90 ? '#EF4444' : disk.usedPercent > 75 ? '#F59E0B' : 'rgba(255,255,255,0.3)'
            }}>
              {disk.usedPercent.toFixed(1)}{t('% 已使用 ·')} {disk.free} {t('可用')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 负载平均值组件
 */
interface LoadAvgProps {
  load1: number;
  load5: number;
  load15: number;
  cores: number;
}

function LoadAvg({ load1, load5, load15, cores }: LoadAvgProps): JSX.Element {
  const getLoadColor = (load: number) => {
    const ratio = load / cores;
    if (ratio > 2) return 'text-[#EF4444]';
    if (ratio > 1) return 'text-[#F59E0B]';
    return 'text-[#22C55E]';
  };

  return (
    <div className="glass-light rounded-xl p-4">
      <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
        <Icon name="server" size={14} color="#A78BFA" />
        {t('系统负载 (')}{cores} {t('核心)')}
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-xs text-white/30 mb-1">{t('1 分钟')}</p>
          <p className={`text-base font-semibold tabular-nums ${getLoadColor(load1)}`}>
            {load1.toFixed(2)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-white/30 mb-1">{t('5 分钟')}</p>
          <p className={`text-base font-semibold tabular-nums ${getLoadColor(load5)}`}>
            {load5.toFixed(2)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-white/30 mb-1">{t('15 分钟')}</p>
          <p className={`text-base font-semibold tabular-nums ${getLoadColor(load15)}`}>
            {load15.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 网络接口组件
 */
interface NetworkInfoProps {
  interfaces: Array<{
    name: string;
    addrs: string[];
    bytesSent: number;
    bytesRecv: number;
    packetsSent: number;
    packetsRecv: number;
  }>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function NetworkInfo({ interfaces }: NetworkInfoProps): JSX.Element | null {
  if (interfaces.length === 0) return null;

  return (
    <div className="glass-light rounded-xl p-4 flex flex-col">
      <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2 flex-shrink-0">
        <Icon name="network" size={14} color="#A78BFA" />
        {t('网络接口')}
      </h3>
      <div className="space-y-2 overflow-y-auto max-h-40 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20">
        {interfaces.map((iface, index) => (
          <div key={index} className="p-2.5 rounded-lg bg-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-medium text-white">{iface.name}</p>
              {iface.addrs.length > 0 && (
                <p className="text-xs text-white/40">{iface.addrs[0]}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-white/30">{t('上传:')}</span>{' '}
                <span className="text-white/60 tabular-nums">{formatBytes(iface.bytesSent)}</span>
              </div>
              <div>
                <span className="text-white/30">{t('下载:')}</span>{' '}
                <span className="text-white/60 tabular-nums">{formatBytes(iface.bytesRecv)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 系统信息小部件主组件
 */
export function SystemInfoWidget(): JSX.Element {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [diskInfo, setDiskInfo] = useState<Array<any>>([]);
  const [networkInfo, setNetworkInfo] = useState<Array<any>>([]);
  const [loadAvg, setLoadAvg] = useState<{ load1: number; load5: number; load15: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // 加载初始数据
  const loadSystemInfo = async () => {
    try {
      const [info, disks, network, load] = await Promise.all([
        SysInfoService.GetSystemInfo(),
        SysInfoService.GetDiskInfo().catch(() => []),
        SysInfoService.GetNetworkInfo().catch(() => []),
        SysInfoService.GetLoadAverage().catch(() => null),
      ]);
      setSystemInfo(info);
      setDiskInfo(disks);
      setNetworkInfo(network.filter((n: any) => n.name !== 'total'));
      if (load && 'load1' in load) {
        setLoadAvg(load as { load1: number; load5: number; load15: number });
      }
      setLastUpdate(new Date());
      console.log('[SysInfo] Data updated:', {
        cpu: info?.cpuUsage,
        memory: info?.memoryUsed,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to load system info:', err);
    } finally {
      setLoading(false);
    }
  };

  // 初始化
  useEffect(() => {
    console.log('[SysInfo] Component mounted, loading initial data...');
    loadSystemInfo();
  }, []);

  // 监听系统信息更新事件
  useEffect(() => {
    console.log('[SysInfo] Setting up event listeners...');

    const unsubUpdated = Events.On('sysinfo:updated', (data) => {
      console.log('[SysInfo] Received sysinfo:updated event:', data);
      loadSystemInfo();
    });

    const unsubCpu = Events.On('sysinfo:cpu', (data) => {
      console.log('[SysInfo] Received sysinfo:cpu event:', data);
      loadSystemInfo();
    });

    return () => {
      console.log('[SysInfo] Cleaning up event listeners...');
      unsubUpdated?.();
      unsubCpu?.();
    };
  }, []);

  // 强制垃圾回收
  const handleForceGC = async () => {
    try {
      await SysInfoService.ForceGC();
      loadSystemInfo();
    } catch (err) {
      console.error('Failed to force GC:', err);
    }
  };

  // 获取操作系统图标和名称
  const getOSInfo = () => {
    const os = systemInfo?.os || 'unknown';
    const osMap: Record<string, { name: string; icon: string; color: string }> = {
      'darwin': { name: 'macOS', icon: 'cube', color: '#A78BFA' },
      'windows': { name: 'Windows', icon: 'cube', color: '#3B82F6' },
      'linux': { name: 'Linux', icon: 'cube', color: '#F59E0B' },
      'freebsd': { name: 'FreeBSD', icon: 'cube', color: '#EF4444' },
    };
    return osMap[os] || { name: os.toUpperCase(), icon: 'cube', color: '#6B7280' };
  };

  // 获取架构名称
  const getArchName = (arch: string) => {
    const archMap: Record<string, string> = {
      'amd64': 'x86_64',
      'arm64': 'ARM64',
      '386': 'x86 (32-bit)',
      'arm': 'ARM (32-bit)',
    };
    return archMap[arch] || arch.toUpperCase();
  };

  if (loading) {
    return (
      <div className="glass-light rounded-xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 animate-pulse">
          <Icon name="refresh" size={20} color="rgba(255,255,255,0.3)" />
        </div>
        <p className="text-white/40 mt-4">{t('加载系统信息中...')}</p>
      </div>
    );
  }

  const osInfo = getOSInfo();
  const cores = systemInfo?.cpus || 1;

  return (
    <div className="space-y-4">
      {/* 操作系统和架构信息 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <InfoCard
          icon={osInfo.icon}
          title={t("操作系统")}
          value={systemInfo?.platform || osInfo.name}
          subtitle={`${systemInfo?.platformVersion || ''} · ${getArchName(systemInfo?.arch || '')}`}
          color={osInfo.color}
        />
        <InfoCard
          icon="clock"
          title={t("系统运行时间")}
          value={systemInfo?.hostUptime || 'Unknown'}
          subtitle={t('自 {date} 启动', { date: systemInfo?.bootTime ? new Date(systemInfo.bootTime * 1000).toLocaleDateString(getLanguage() === 'en' ? 'en-US' : 'zh-CN') : '' })}
          color="#F59E0B"
        />
      </div>

      {/* CPU 使用率 */}
      {systemInfo?.cpuUsage !== undefined && (
        <CPUUsage
          usage={systemInfo.cpuUsage}
          cores={cores}
          modelName={systemInfo.cpuModelName}
        />
      )}

      {/* 负载平均值 */}
      {loadAvg && systemInfo && (
        <LoadAvg
          load1={loadAvg.load1}
          load5={loadAvg.load5}
          load15={loadAvg.load15}
          cores={cores}
        />
      )}

      {/* 内存信息 */}
      {systemInfo && (
        <MemoryInfo
          used={systemInfo.memoryUsed}
          total={systemInfo.memoryTotal}
          usedPercent={systemInfo.memoryUsedPercent || 0}
          swapUsed={systemInfo.swapUsed}
          swapTotal={systemInfo.swapTotal}
          swapUsedPercent={systemInfo.swapUsedPercent}
        />
      )}

      {/* 磁盘和网络 - 左右布局 */}
      {(diskInfo.length > 0 || networkInfo.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {diskInfo.length > 0 && <DiskUsage disks={diskInfo} />}
          {networkInfo.length > 0 && <NetworkInfo interfaces={networkInfo} />}
        </div>
      )}

      {/* 进程数 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <InfoCard
          icon="chip"
          title={t("运行进程")}
          value={systemInfo?.procCount || 0}
          subtitle={t("当前活动进程数")}
          color="#3B82F6"
        />
        <InfoCard
          icon="document"
          title={t("Go 版本")}
          value={systemInfo?.goVersion || 'Unknown'}
          subtitle={`GOMAXPROCS: ${systemInfo?.goMaxProcs || 0}`}
          color="#7C3AED"
        />
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          className="flex-1 px-3 py-2 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all duration-200 text-sm font-medium clickable flex items-center justify-center gap-2"
          onClick={loadSystemInfo}
        >
          <Icon name="refresh" size={14} />
          {t('刷新信息')}
        </button>
        <button
          className="flex-1 px-3 py-2 rounded-lg bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 transition-all duration-200 text-sm font-medium clickable border border-[#EF4444]/20 flex items-center justify-center gap-2"
          onClick={handleForceGC}
        >
          <Icon name="refresh" size={14} />
          {t('强制垃圾回收')}
        </button>
      </div>

      {/* 最后更新时间 */}
      <div className="text-center">
        <p className="text-xs text-white/20">
          {t('最后更新:')} {lastUpdate.toLocaleString('zh-CN')}
        </p>
      </div>
    </div>
  );
}

export default SystemInfoWidget;
