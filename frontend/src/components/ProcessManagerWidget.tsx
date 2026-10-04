import { useEffect, useState, useCallback, useRef } from 'react';
import { Events } from '@wailsio/runtime';
import { ProcessManagerService, ProcessInfo, ProcessListOptions } from '../../bindings/ltools/plugins/processmanager';
import { Icon } from './Icon';
import { t } from '@/i18n';

/**
 * 格式化字节大小
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * 格式化时间戳为相对时间
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t('刚刚');
  if (minutes < 60) return t('{n} 分钟前', { n: minutes });
  if (hours < 24) return t('{n} 小时前', { n: hours });
  return t('{n} 天前', { n: days });
}

/**
 * 进程状态标签组件
 */
interface ProcessStatusProps {
  status: string;
}

function ProcessStatus({ status }: ProcessStatusProps): JSX.Element {
  const statusConfig: Record<string, { color: string; label: string }> = {
    'R': { color: 'text-[#22C55E]', label: t('运行') },
    'S': { color: 'text-[#F59E0B]', label: t('睡眠') },
    'D': { color: 'text-[#EF4444]', label: t('等待') },
    'Z': { color: 'text-[#6B7280]', label: t('僵尸') },
    'T': { color: 'text-[#7C3AED]', label: t('停止') },
    'W': { color: 'text-[#3B82F6]', label: t('等待') },
  };

  const config = statusConfig[status] || { color: 'text-white/60', label: status };

  return (
    <span className={`text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

/**
 * 进程行组件
 */
interface ProcessRowProps {
  process: ProcessInfo;
  onKill: (force?: boolean) => void;
  onViewDetails: () => void;
}

function ProcessRow({ process, onKill, onViewDetails }: ProcessRowProps): JSX.Element {
  const getCpuColor = (usage: number) => {
    if (usage > 50) return 'text-[#EF4444]';
    if (usage > 20) return 'text-[#F59E0B]';
    return 'text-[#22C55E]';
  };

  const getMemoryColor = (percent: number) => {
    if (percent > 50) return 'bg-[#EF4444]';
    if (percent > 20) return 'bg-[#F59E0B]';
    return 'bg-[#22C55E]';
  };

  return (
    <tr
      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
      onClick={onViewDetails}
    >
      <td className="px-3 py-2 text-xs text-white/60 tabular-nums">{process.pid}</td>
      <td className="px-3 py-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white truncate max-w-[200px]" title={process.name}>
            {process.name}
          </span>
          {process.isSystem && (
            <span className="text-xs text-white/30">{t('系统进程')}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold tabular-nums ${getCpuColor(process.cpuPercent)}`}>
            {process.cpuPercent.toFixed(1)}%
          </span>
          <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[#7C3AED]"
              style={{ width: `${Math.min(process.cpuPercent, 100)}%` }}
            />
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/60 tabular-nums">
            {formatBytes(process.memoryBytes)}
          </span>
          <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${getMemoryColor(process.memoryPercent)}`}
              style={{ width: `${Math.min(process.memoryPercent, 100)}%` }}
            />
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        <ProcessStatus status={process.status} />
      </td>
      <td className="px-3 py-2 text-xs text-white/40 tabular-nums">
        {process.numThreads > 0 && t('{n} 线程', { n: process.numThreads })}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
            title={t("查看详情")}
          >
            <Icon name="document" size={14} />
          </button>
          <button
            className="p-1.5 rounded hover:bg-[#F59E0B]/20 text-white/40 hover:text-[#F59E0B] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onKill(false);
            }}
            title={t("正常终止进程")}
          >
            <Icon name="close" size={14} />
          </button>
          <button
            className="p-1.5 rounded hover:bg-[#EF4444]/20 text-white/40 hover:text-[#EF4444] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onKill(true);
            }}
            title={t("强制终止进程")}
          >
            <Icon name="alert-circle" size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

/**
 * 确认对话框
 */
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  type?: 'warning' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  title,
  message,
  confirmText,
  cancelText = t('取消'),
  type = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element {
  const typeStyles = {
    warning: {
      confirmBtn: 'bg-[#F59E0B] hover:bg-[#D97706]',
      icon: 'alert-circle',
      iconColor: '#F59E0B',
    },
    danger: {
      confirmBtn: 'bg-[#EF4444] hover:bg-[#DC2626]',
      icon: 'alert-circle',
      iconColor: '#EF4444',
    },
  };

  const styles = typeStyles[type];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className="glass-light rounded-2xl p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <Icon name={styles.icon as any} size={24} color={styles.iconColor} />
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        <p className="text-white/80 mb-6 whitespace-pre-line">{message}</p>
        <div className="flex gap-3">
          <button
            className={`flex-1 px-4 py-2.5 rounded-lg text-white transition-all duration-200 text-sm font-medium clickable ${styles.confirmBtn}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
          <button
            className="px-4 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all duration-200 text-sm font-medium clickable"
            onClick={onCancel}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 进程详情对话框
 */
interface ProcessDetailDialogProps {
  process: ProcessInfo | null;
  onClose: () => void;
  onKill: (force?: boolean) => void;
}

function ProcessDetailDialog({ process, onClose, onKill }: ProcessDetailDialogProps): JSX.Element | null {
  if (!process) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="glass-light rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Icon name="process" size={20} color="#A78BFA" />
            {t('进程详情')}
          </h2>
          <button
            className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-white/5">
              <p className="text-xs text-white/40 mb-1">{t('进程名称')}</p>
              <p className="text-sm font-medium text-white">{process.name}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5">
              <p className="text-xs text-white/40 mb-1">{t('进程 ID')}</p>
              <p className="text-sm font-medium text-white tabular-nums">{process.pid}</p>
            </div>
          </div>

          {/* 资源使用 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-white/5">
              <p className="text-xs text-white/40 mb-1">{t('CPU 使用率')}</p>
              <p className={`text-lg font-bold ${process.cpuPercent > 50 ? 'text-[#EF4444]' : 'text-white'}`}>
                {process.cpuPercent.toFixed(2)}%
              </p>
            </div>
            <div className="p-3 rounded-lg bg-white/5">
              <p className="text-xs text-white/40 mb-1">{t('内存使用')}</p>
              <p className="text-lg font-bold text-white">
                {formatBytes(process.memoryBytes)}
                <span className="text-sm text-white/60 ml-2">({process.memoryPercent.toFixed(1)}%)</span>
              </p>
            </div>
          </div>

          {/* 状态和线程 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-white/5">
              <p className="text-xs text-white/40 mb-1">{t('状态')}</p>
              <ProcessStatus status={process.status} />
            </div>
            <div className="p-3 rounded-lg bg-white/5">
              <p className="text-xs text-white/40 mb-1">{t('线程数')}</p>
              <p className="text-sm font-medium text-white tabular-nums">{process.numThreads}</p>
            </div>
          </div>

          {/* 用户和路径 */}
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-white/5">
              <p className="text-xs text-white/40 mb-1">{t('运行用户')}</p>
              <p className="text-sm font-medium text-white">{process.username}</p>
            </div>
            {process.executablePath && (
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xs text-white/40 mb-1">{t('可执行文件路径')}</p>
                <p className="text-xs text-white/60 break-all">{process.executablePath}</p>
              </div>
            )}
            {process.cmdLine && (
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xs text-white/40 mb-1">{t('命令行')}</p>
                <p className="text-xs text-white/60 break-all font-mono">{process.cmdLine}</p>
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              className="flex-1 px-4 py-2.5 rounded-lg bg-[#F59E0B] text-white hover:bg-[#D97706] transition-all duration-200 text-sm font-medium clickable flex items-center justify-center gap-2"
              onClick={() => onKill()}
            >
              <Icon name="close" size={16} />
              {t('正常终止')}
            </button>
            <button
              className="flex-1 px-4 py-2.5 rounded-lg bg-[#EF4444] text-white hover:bg-[#DC2626] transition-all duration-200 text-sm font-medium clickable flex items-center justify-center gap-2"
              onClick={() => onKill(true)}
            >
              <Icon name="alert-circle" size={16} />
              {t('强制终止')}
            </button>
            <button
              className="px-4 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all duration-200 text-sm font-medium clickable"
              onClick={onClose}
            >
              {t('关闭')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 进程管理器主组件
 */
export function ProcessManagerWidget(): JSX.Element {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailProcess, setDetailProcess] = useState<ProcessInfo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'pid' | 'name' | 'cpu' | 'memory'>('memory');
  const [sortDesc, setSortDesc] = useState(true);
  const [showSystem, setShowSystem] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 50;

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    confirmText: string;
    type?: 'warning' | 'danger';
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: () => {},
  });

  // 使用 ref 来存储最新的状态值，避免依赖导致的重新渲染
  const optionsRef = useRef({
    searchTerm,
    sortBy,
    sortDesc,
    showSystem,
    currentPage,
    pageSize
  });

  // 加载进程列表 - 移除依赖避免无限循环
  const loadProcesses = useCallback(async () => {
    try {
      const opts = optionsRef.current;
      const options: ProcessListOptions = {
        searchTerm: opts.searchTerm,
        sortBy: opts.sortBy,
        sortDesc: opts.sortDesc,
        showSystem: opts.showSystem,
        limit: opts.pageSize,
        offset: opts.currentPage * opts.pageSize,
      };

      const [procs, total] = await ProcessManagerService.GetProcesses(options);
      setProcesses(procs.filter((p): p is ProcessInfo => p !== null));
      setTotalCount(total);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to load processes:', err);
    } finally {
      setLoading(false);
    }
  }, []); // 空依赖数组，函数只创建一次

  // 初始化加载
  useEffect(() => {
    console.log('[ProcessManager] Component mounted, loading initial data...');
    loadProcesses();
  }, []); // 只在挂载时执行一次

  // 监听更新事件 - 移除 loadProcesses 依赖避免重新注册
  useEffect(() => {
    console.log('[ProcessManager] Setting up event listeners...');

    let updateTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubUpdated = Events.On('processmanager:updated', (data) => {
      console.log('[ProcessManager] Received update event:', data);
      // 节流：避免频繁刷新
      if (updateTimer) clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        loadProcesses();
      }, 1000); // 延迟1秒执行，合并多次更新
    });

    const unsubKilled = Events.On('processmanager:killed', (data) => {
      console.log('[ProcessManager] Process killed:', data);
      // 立即刷新，不延迟
      if (updateTimer) clearTimeout(updateTimer);
      updateTimer = null;
      loadProcesses();
    });

    return () => {
      console.log('[ProcessManager] Cleaning up event listeners...');
      if (updateTimer) clearTimeout(updateTimer);
      unsubUpdated?.();
      unsubKilled?.();
    };
  }, []); // 空依赖数组，只在挂载时注册一次

  // 处理搜索输入 - 使用防抖
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(0);
    optionsRef.current.searchTerm = value;
    optionsRef.current.currentPage = 0;
    // 防抖：延迟执行搜索
    setTimeout(() => loadProcesses(), 300);
  };

  // 处理排序
  const handleSort = (column: 'pid' | 'name' | 'cpu' | 'memory') => {
    const newSortDesc = sortBy === column ? !sortDesc : true;
    setSortDesc(newSortDesc);
    setSortBy(column);
    // 更新 ref 并刷新
    optionsRef.current.sortBy = column;
    optionsRef.current.sortDesc = newSortDesc;
    setTimeout(() => loadProcesses(), 0);
  };

  // 处理分页
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    optionsRef.current.currentPage = newPage;
    loadProcesses();
  };

  // 处理系统进程显示切换
  const handleShowSystemChange = (value: boolean) => {
    setShowSystem(value);
    optionsRef.current.showSystem = value;
    setCurrentPage(0);
    loadProcesses();
  };

  // 处理终止进程
  const handleKillProcess = (pid: number, force = false) => {
    const action = force ? t('强制终止') : t('终止');
    const warning = force
      ? t('警告：强制终止可能会导致数据丢失！')
      : t('此操作无法撤销。');

    setConfirmDialog({
      show: true,
      title: t('{action}进程', { action }),
      message: t('确定要{action}进程 {pid} 吗？\n\n{warning}', { action, pid, warning }),
      confirmText: action,
      type: force ? 'danger' : 'warning',
      onConfirm: async () => {
        try {
          if (force) {
            await ProcessManagerService.ForceKillProcess(pid);
            console.log('[ProcessManager] Process force killed:', pid);
          } else {
            await ProcessManagerService.KillProcess(pid);
            console.log('[ProcessManager] Process killed:', pid);
          }
          setConfirmDialog({ ...confirmDialog, show: false });
          setDetailProcess(null);
          loadProcesses();
        } catch (err) {
          console.error('Failed to kill process:', err);
          setConfirmDialog({
            show: true,
            title: t('操作失败'),
            message: t('终止进程失败: {err}', { err: String(err) }),
            confirmText: t('确定'),
            type: 'warning',
            onConfirm: () => setConfirmDialog({ ...confirmDialog, show: false }),
          });
        }
      },
    });
  };

  // 处理刷新
  const handleRefresh = () => {
    setLoading(true);
    ProcessManagerService.ForceRefresh();
    loadProcesses();
  };

  if (loading) {
    return (
      <div className="glass-light rounded-xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 animate-pulse">
          <Icon name="refresh" size={20} color="rgba(255,255,255,0.3)" />
        </div>
        <p className="text-white/40 mt-4">{t('加载进程列表中...')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 标题和控制栏 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Icon name="process" size={18} color="#A78BFA" />
          {t('进程管理器')}
          <span className="text-sm text-white/40 font-normal">
            ({totalCount} {t('个进程)')}
          </span>
        </h2>
        <button
          className="px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all duration-200 text-sm font-medium clickable flex items-center gap-2"
          onClick={handleRefresh}
        >
          <Icon name="refresh" size={14} />
          {t('刷新')}
        </button>
      </div>

      {/* 搜索和过滤器 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Icon
            name="search"
            size={16}
            color="rgba(255,255,255,0.3)"
            className="absolute left-3 top-1/2 -translate-y-1/2"
          />
          <input
            type="text"
            placeholder={t("搜索进程名称、PID 或命令行...")}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-white/20 text-sm"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
          <input
            type="checkbox"
            checked={showSystem}
            onChange={(e) => handleShowSystemChange(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm text-white/60">{t('显示系统进程')}</span>
        </label>
      </div>

      {/* 进程列表表格 */}
      <div className="glass-light rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th
                  className="px-3 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60 select-none"
                  onClick={() => handleSort('pid')}
                >
                  PID {sortBy === 'pid' && (sortDesc ? '↓' : '↑')}
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60 select-none"
                  onClick={() => handleSort('name')}
                >
                  {t('名称')} {sortBy === 'name' && (sortDesc ? '↓' : '↑')}
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60 select-none"
                  onClick={() => handleSort('cpu')}
                >
                  CPU {sortBy === 'cpu' && (sortDesc ? '↓' : '↑')}
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60 select-none"
                  onClick={() => handleSort('memory')}
                >
                  {t('内存')} {sortBy === 'memory' && (sortDesc ? '↓' : '↑')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide">
                  {t('状态')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide">
                  {t('线程')}
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-white/40 uppercase tracking-wide">
                  {t('操作')}
                </th>
              </tr>
            </thead>
            <tbody>
              {processes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-white/40">
                    {t('没有找到匹配的进程')}
                  </td>
                </tr>
              ) : (
                processes.map((proc) => (
                  <ProcessRow
                    key={proc.pid}
                    process={proc}
                    onKill={(force) => handleKillProcess(proc.pid, force)}
                    onViewDetails={() => setDetailProcess(proc)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分页控件 */}
      {totalCount > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/30">
            {t('显示')} {currentPage * pageSize + 1} - {Math.min((currentPage + 1) * pageSize, totalCount)} {t('/ 共')} {totalCount} {t('个进程')}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-sm clickable"
              disabled={currentPage === 0}
              onClick={() => handlePageChange(Math.max(0, currentPage - 1))}
            >
              {t('上一页')}
            </button>
            <span className="text-sm text-white/60">
              {t('第')} {currentPage + 1} / {Math.ceil(totalCount / pageSize)} {t('页')}
            </span>
            <button
              className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-sm clickable"
              disabled={(currentPage + 1) * pageSize >= totalCount}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              {t('下一页')}
            </button>
          </div>
        </div>
      )}

      {/* 最后更新时间 */}
      <div className="text-center">
        <p className="text-xs text-white/20">
          {t('最后更新:')} {lastUpdate.toLocaleString('zh-CN')} ({formatRelativeTime(lastUpdate.getTime())})
        </p>
      </div>

      {/* 进程详情对话框 */}
      {detailProcess && (
        <ProcessDetailDialog
          process={detailProcess}
          onClose={() => setDetailProcess(null)}
          onKill={(force) => handleKillProcess(detailProcess.pid, force)}
        />
      )}

      {/* 确认对话框 */}
      {confirmDialog.show && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          type={confirmDialog.type}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog({ ...confirmDialog, show: false })}
        />
      )}
    </div>
  );
}

export default ProcessManagerWidget;
