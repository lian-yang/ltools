import { useEffect, useState, type ReactNode } from 'react';
import { Events } from '@wailsio/runtime';
import { SysInfoService, SystemInfo } from '../../bindings/ltools/plugins/sysinfo';
import { Icon, type IconName } from './Icon';
import { Button, EmptyState, ProgressBar, Skeleton } from './ui';

/**
 * 系统信息小部件 — 紧凑指标网格 + 语义色进度条
 */

type ProgressTone = 'accent' | 'warning' | 'error';

/** 按阈值映射进度条色调(>errorAt 红,>warningAt 橙,其余蓝) */
function toneFor(v: number, errorAt: number, warningAt: number): ProgressTone {
  if (v > errorAt) return 'error';
  if (v > warningAt) return 'warning';
  return 'accent';
}

const TONE_TEXT: Record<ProgressTone, string> = {
  accent: 'text-text-1',
  warning: 'text-warning-text',
  error: 'text-error-text',
};

interface DiskInfo {
  path: string;
  total: string;
  used: string;
  free: string;
  usedPercent: number;
}

interface NetIfaceInfo {
  name: string;
  addrs: string[];
  bytesSent: number;
  bytesRecv: number;
  packetsSent: number;
  packetsRecv: number;
}

/**
 * 卡片内区块标题
 */
function CardHead({ icon, title }: { icon: IconName; title: string }): JSX.Element {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <div className="card-inset flex h-7 w-7 shrink-0 items-center justify-center">
        <Icon name={icon} size={14} className="text-text-2" />
      </div>
      <span className="truncate text-[12px] font-medium text-text-2">{title}</span>
    </div>
  );
}

/**
 * 紧凑指标卡:11px 标签 + 20px 等宽数值
 */
function MetricCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  sub?: string;
}): JSX.Element {
  return (
    <div className="card p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] text-text-3">
        <Icon name={icon} size={12} className="shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <p
        className="tnum mt-1.5 truncate font-mono text-[20px] font-semibold leading-tight text-text-1"
        title={String(value)}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 truncate text-[11px] text-text-4" title={sub}>
          {sub}
        </p>
      )}
    </div>
  );
}

/**
 * 使用率卡(CPU / 内存通用):大数值 + ProgressBar + 元信息
 */
function UsageCard({
  icon,
  label,
  percent,
  valueText,
  footer,
  errorAt = 80,
  warningAt = 60,
  children,
}: {
  icon: IconName;
  label: string;
  percent: number;
  valueText?: string;
  footer?: string;
  errorAt?: number;
  warningAt?: number;
  children?: ReactNode;
}): JSX.Element {
  const tone = toneFor(percent, errorAt, warningAt);
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="card-inset flex h-7 w-7 shrink-0 items-center justify-center">
            <Icon name={icon} size={14} className="text-text-2" />
          </div>
          <span className="truncate text-[12px] font-medium text-text-2">{label}</span>
        </div>
        <span className={`tnum shrink-0 font-mono text-[20px] font-semibold leading-none ${TONE_TEXT[tone]}`}>
          {percent.toFixed(1)}%
        </span>
      </div>
      <ProgressBar value={percent} tone={tone} className="mt-2.5" />
      {valueText && (
        <p className="tnum mt-2 truncate font-mono text-[12px] text-text-1" title={valueText}>
          {valueText}
        </p>
      )}
      {footer && (
        <p className="mt-0.5 truncate text-[11px] text-text-3" title={footer}>
          {footer}
        </p>
      )}
      {children}
    </div>
  );
}

/**
 * 负载平均值卡
 */
function LoadCard({
  load1,
  load5,
  load15,
  cores,
}: {
  load1: number;
  load5: number;
  load15: number;
  cores: number;
}): JSX.Element {
  const loadTextClass = (load: number) => {
    const ratio = load / cores;
    if (ratio > 2) return 'text-error-text';
    if (ratio > 1) return 'text-warning-text';
    return 'text-success-text';
  };

  const items: Array<[string, number]> = [
    ['1 分钟', load1],
    ['5 分钟', load5],
    ['15 分钟', load15],
  ];

  return (
    <div className="card p-4">
      <CardHead icon="server" title={`系统负载 (${cores} 核心)`} />
      <div className="grid grid-cols-3 gap-3">
        {items.map(([label, value]) => (
          <div key={label}>
            <p className="text-[11px] text-text-3">{label}</p>
            <p className={`tnum mt-0.5 font-mono text-[16px] font-semibold leading-tight ${loadTextClass(value)}`}>
              {value.toFixed(2)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 磁盘使用卡
 */
function DiskCard({ disks }: { disks: DiskInfo[] }): JSX.Element | null {
  if (disks.length === 0) return null;

  return (
    <div className="card p-4">
      <CardHead icon="disk" title="磁盘使用情况" />
      <div className="max-h-44 space-y-3 overflow-y-auto pr-1">
        {disks.map((disk) => {
          const tone = toneFor(disk.usedPercent, 90, 75);
          return (
            <div key={disk.path} className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-[12px] text-text-1" title={disk.path}>
                  {disk.path}
                </span>
                <span className="tnum shrink-0 font-mono text-[11.5px] text-text-2">
                  {disk.used} / {disk.total}
                </span>
              </div>
              <ProgressBar value={disk.usedPercent} tone={tone} className="mt-1.5" />
              <p className="tnum mt-1 text-right text-[11px] text-text-3">
                <span className={TONE_TEXT[tone]}>{disk.usedPercent.toFixed(1)}%</span> 已使用 · {disk.free} 可用
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * 网络接口卡
 */
function NetworkCard({ interfaces }: { interfaces: NetIfaceInfo[] }): JSX.Element | null {
  if (interfaces.length === 0) return null;

  return (
    <div className="card p-4">
      <CardHead icon="network" title="网络接口" />
      <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
        {interfaces.map((iface) => (
          <div key={iface.name} className="card-inset px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[12.5px] font-medium text-text-1" title={iface.name}>
                {iface.name}
              </span>
              {iface.addrs.length > 0 && (
                <span className="shrink-0 font-mono text-[11px] text-text-3">{iface.addrs[0]}</span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-4 text-[11px] text-text-3">
              <span>
                上传 <span className="tnum font-mono text-text-2">{formatBytes(iface.bytesSent)}</span>
              </span>
              <span>
                下载 <span className="tnum font-mono text-text-2">{formatBytes(iface.bytesRecv)}</span>
              </span>
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
  const [diskInfo, setDiskInfo] = useState<DiskInfo[]>([]);
  const [networkInfo, setNetworkInfo] = useState<NetIfaceInfo[]>([]);
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
      setDiskInfo(disks as DiskInfo[]);
      setNetworkInfo(network.filter((n: any) => n.name !== 'total') as NetIfaceInfo[]);
      if (load && 'load1' in load) {
        setLoadAvg(load as { load1: number; load5: number; load15: number });
      }
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to load system info:', err);
    } finally {
      setLoading(false);
    }
  };

  // 初始化
  useEffect(() => {
    loadSystemInfo();
  }, []);

  // 监听系统信息更新事件
  useEffect(() => {
    const unsubUpdated = Events.On('sysinfo:updated', () => {
      loadSystemInfo();
    });

    const unsubCpu = Events.On('sysinfo:cpu', () => {
      loadSystemInfo();
    });

    return () => {
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

  // 获取操作系统名称
  const getOSName = (os: string) => {
    const osMap: Record<string, string> = {
      'darwin': 'macOS',
      'windows': 'Windows',
      'linux': 'Linux',
      'freebsd': 'FreeBSD',
    };
    return osMap[os] || os.toUpperCase();
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
      <div className="space-y-3" aria-busy="true">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[86px] rounded-[9px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Skeleton className="h-[128px] rounded-[9px]" />
          <Skeleton className="h-[128px] rounded-[9px]" />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Skeleton className="h-[96px] rounded-[9px]" />
          <Skeleton className="h-[96px] rounded-[9px]" />
          <Skeleton className="h-[96px] rounded-[9px]" />
        </div>
      </div>
    );
  }

  // 主数据加载失败的错误态
  if (!systemInfo) {
    return (
      <EmptyState
        icon="exclamation-circle"
        title="系统信息加载失败"
        description="无法获取系统信息,请重试"
        action={
          <Button variant="primary" icon="refresh" onClick={loadSystemInfo}>
            重新加载
          </Button>
        }
      />
    );
  }

  const cores = systemInfo.cpus || 1;
  const osName = getOSName(systemInfo.os || 'unknown');
  const osSub = [systemInfo.platformVersion, getArchName(systemInfo.arch || '')]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-3">
      {/* 指标卡:操作系统 / 运行时间 / 进程数 / Go 版本 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard icon="cube" label="操作系统" value={systemInfo.platform || osName} sub={osSub || undefined} />
        <MetricCard
          icon="clock"
          label="系统运行时间"
          value={systemInfo.hostUptime || 'Unknown'}
          sub={systemInfo.bootTime ? `自 ${new Date(systemInfo.bootTime * 1000).toLocaleDateString('zh-CN')} 启动` : undefined}
        />
        <MetricCard icon="chip" label="运行进程" value={systemInfo.procCount || 0} sub="当前活动进程数" />
        <MetricCard
          icon="document"
          label="Go 版本"
          value={systemInfo.goVersion || 'Unknown'}
          sub={`GOMAXPROCS: ${systemInfo.goMaxProcs || 0}`}
        />
      </div>

      {/* CPU / 内存 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {systemInfo.cpuUsage !== undefined && (
          <UsageCard
            icon="cpu"
            label="CPU 使用率"
            percent={systemInfo.cpuUsage}
            valueText={systemInfo.cpuModelName || undefined}
            footer={`${cores} 核心`}
          />
        )}
        <UsageCard
          icon="memory"
          label="内存使用"
          percent={systemInfo.memoryUsedPercent || 0}
          valueText={`${systemInfo.memoryUsed} / ${systemInfo.memoryTotal}`}
          errorAt={80}
          warningAt={60}
        >
          {systemInfo.swapTotal && systemInfo.swapUsed && (
            <div className="hairline-t mt-3 pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-text-3">Swap 使用</span>
                <span className="tnum shrink-0 font-mono text-[11.5px] text-text-2">
                  {systemInfo.swapUsed} / {systemInfo.swapTotal}
                </span>
              </div>
              <ProgressBar
                value={systemInfo.swapUsedPercent || 0}
                tone={(systemInfo.swapUsedPercent || 0) > 50 ? 'warning' : 'accent'}
                className="mt-1.5"
              />
            </div>
          )}
        </UsageCard>
      </div>

      {/* 负载 / 磁盘 / 网络 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {loadAvg && (
          <LoadCard load1={loadAvg.load1} load5={loadAvg.load5} load15={loadAvg.load15} cores={cores} />
        )}
        <DiskCard disks={diskInfo} />
        <NetworkCard interfaces={networkInfo} />
      </div>

      {/* 操作按钮 + 最后更新时间 */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button variant="secondary" icon="refresh" onClick={loadSystemInfo}>
          刷新信息
        </Button>
        <Button variant="danger" icon="trash" onClick={handleForceGC}>
          强制垃圾回收
        </Button>
        <span className="tnum ml-auto text-[11px] text-text-4">
          最后更新: {lastUpdate.toLocaleString('zh-CN')}
        </span>
      </div>
    </div>
  );
}

export default SystemInfoWidget;
