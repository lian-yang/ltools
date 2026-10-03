import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { Events } from '@wailsio/runtime';
import { ProcessManagerService, ProcessInfo, ProcessListOptions } from '../../bindings/ltools/plugins/processmanager';
import { Icon } from './Icon';
import { Button, EmptyState, IconButton, Input, Modal, ProgressBar, Skeleton, Toggle } from './ui';

/**
 * 进程管理器 — 等宽数据行 + 可排序表头 + 二次确认
 */

type ProgressTone = 'accent' | 'warning' | 'error';

/** 按阈值映射进度条色调 */
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

/** 行网格:PID / 名称 / CPU / 内存 / 状态 / 线程 / 操作 */
const ROW_GRID =
  'grid grid-cols-[60px_minmax(0,1fr)_92px_104px_48px_44px_92px] items-center gap-x-3';

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

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  return `${days} 天前`;
}

/**
 * 进程状态标签
 */
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  'R': { label: '运行', className: 'text-success-text' },
  'S': { label: '睡眠', className: 'text-text-2' },
  'D': { label: '等待', className: 'text-error-text' },
  'Z': { label: '僵尸', className: 'text-text-3' },
  'T': { label: '停止', className: 'text-warning-text' },
  'W': { label: '等待', className: 'text-text-2' },
};

function ProcessStatus({ status }: { status: string }): JSX.Element {
  const config = STATUS_CONFIG[status] ?? { label: status || '未知', className: 'text-text-2' };
  return <span className={`text-[12px] font-medium ${config.className}`}>{config.label}</span>;
}

/**
 * 可排序表头(克制样式:仅激活列显示箭头)
 */
function SortHeader({
  label,
  column,
  sortBy,
  sortDesc,
  onSort,
  alignRight,
}: {
  label: string;
  column: 'pid' | 'name' | 'cpu' | 'memory';
  sortBy: string;
  sortDesc: boolean;
  onSort: (column: 'pid' | 'name' | 'cpu' | 'memory') => void;
  alignRight?: boolean;
}): JSX.Element {
  const active = sortBy === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`flex select-none items-center gap-1 text-[11px] font-medium transition-colors duration-150 hover:text-text-1 ${
        active ? 'text-text-2' : 'text-text-3'
      } ${alignRight ? 'justify-end' : ''}`}
    >
      {label}
      {active && (
        <Icon name={sortDesc ? 'chevron-down' : 'chevron-up'} size={11} className="text-text-3" />
      )}
    </button>
  );
}

/**
 * 进程行组件
 */
function ProcessRow({
  process,
  onKill,
  onViewDetails,
}: {
  process: ProcessInfo;
  onKill: (force?: boolean) => void;
  onViewDetails: () => void;
}): JSX.Element {
  const cpuTone = toneFor(process.cpuPercent, 50, 20);
  const memTone = toneFor(process.memoryPercent, 50, 20);

  return (
    <div className={`row row-clickable ${ROW_GRID} px-3 py-1.5`} onClick={onViewDetails}>
      <span className="tnum font-mono text-[12px] text-text-3">{process.pid}</span>
      <div className="min-w-0">
        <span className="block truncate text-[12.5px] font-medium text-text-1" title={process.name}>
          {process.name}
        </span>
        {process.isSystem && <span className="block text-[10.5px] leading-tight text-text-4">系统进程</span>}
      </div>
      <div className="flex items-center justify-end gap-2">
        <ProgressBar value={Math.min(process.cpuPercent, 100)} tone={cpuTone} className="w-12" />
        <span className={`tnum w-11 shrink-0 text-right font-mono text-[12px] ${TONE_TEXT[cpuTone]}`}>
          {process.cpuPercent.toFixed(1)}%
        </span>
      </div>
      <div className="flex items-center justify-end gap-2">
        <ProgressBar value={Math.min(process.memoryPercent, 100)} tone={memTone} className="w-12" />
        <span
          className="tnum w-[62px] shrink-0 text-right font-mono text-[12px] text-text-2"
          title={`内存占用 ${process.memoryPercent.toFixed(1)}%`}
        >
          {formatBytes(process.memoryBytes)}
        </span>
      </div>
      <ProcessStatus status={process.status} />
      <span className="tnum text-right font-mono text-[12px] text-text-3" title="线程数">
        {process.numThreads > 0 ? process.numThreads : '—'}
      </span>
      <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
        <IconButton name="document" label="查看详情" size="sm" onClick={onViewDetails} />
        <IconButton name="close" label="正常终止进程" size="sm" onClick={() => onKill(false)} />
        <IconButton name="alert-circle" label="强制终止进程" size="sm" tone="danger" onClick={() => onKill(true)} />
      </div>
    </div>
  );
}

/**
 * 信息块(详情对话框内)
 */
function InfoBlock({
  label,
  value,
  mono,
  small,
  danger,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  small?: boolean;
  danger?: boolean;
}): JSX.Element {
  return (
    <div className="card-inset min-w-0 px-3.5 py-2.5">
      <p className="text-[11px] text-text-4">{label}</p>
      <div
        className={`mt-0.5 break-all font-medium text-text-1 ${
          mono ? 'tnum font-mono' : ''
        } ${small ? 'text-[11.5px] font-normal text-text-2' : 'text-[12.5px]'} ${
          danger ? 'text-error-text' : ''
        }`}
      >
        {value}
      </div>
    </div>
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
  cancelText = '取消',
  type = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element {
  const danger = type === 'danger';
  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      width={400}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant={danger ? 'danger-solid' : 'danger'} onClick={onConfirm}>
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <Icon
          name="alert-circle"
          size={18}
          className={`shrink-0 ${danger ? 'text-error-text' : 'text-warning-text'}`}
        />
        <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-text-2">{message}</p>
      </div>
    </Modal>
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
    <Modal
      open
      onClose={onClose}
      title="进程详情"
      width={680}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            关闭
          </Button>
          <Button variant="danger" icon="close" onClick={() => onKill()}>
            正常终止
          </Button>
          <Button variant="danger-solid" icon="alert-circle" onClick={() => onKill(true)}>
            强制终止
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          <InfoBlock label="进程名称" value={process.name} />
          <InfoBlock label="进程 ID" value={process.pid} mono />
          <InfoBlock
            label="CPU 使用率"
            value={`${process.cpuPercent.toFixed(2)}%`}
            mono
            danger={process.cpuPercent > 50}
          />
          <InfoBlock
            label="内存使用"
            value={`${formatBytes(process.memoryBytes)} (${process.memoryPercent.toFixed(1)}%)`}
            mono
          />
          <InfoBlock label="状态" value={<ProcessStatus status={process.status} />} />
          <InfoBlock label="线程数" value={process.numThreads} mono />
        </div>
        <InfoBlock label="运行用户" value={process.username} />
        {process.executablePath && (
          <InfoBlock label="可执行文件路径" value={process.executablePath} mono small />
        )}
        {process.cmdLine && <InfoBlock label="命令行" value={process.cmdLine} mono small />}
      </div>
    </Modal>
  );
}

/**
 * 进程管理器主组件
 */
export function ProcessManagerWidget(): JSX.Element {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  // 搜索防抖计时器(卸载时清理)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setLoadError(null);
    } catch (err) {
      console.error('Failed to load processes:', err);
      setLoadError(err instanceof Error ? err.message : '加载进程列表失败');
    } finally {
      setLoading(false);
    }
  }, []); // 空依赖数组，函数只创建一次

  // 初始化加载
  useEffect(() => {
    loadProcesses();
    // 卸载时清理搜索防抖计时器
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [loadProcesses]); // 只在挂载时执行一次

  // 监听更新事件 - 移除 loadProcesses 依赖避免重新注册
  useEffect(() => {
    let updateTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubUpdated = Events.On('processmanager:updated', () => {
      // 节流：避免频繁刷新
      if (updateTimer) clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        loadProcesses();
      }, 1000); // 延迟1秒执行，合并多次更新
    });

    const unsubKilled = Events.On('processmanager:killed', () => {
      // 立即刷新，不延迟
      if (updateTimer) clearTimeout(updateTimer);
      updateTimer = null;
      loadProcesses();
    });

    return () => {
      if (updateTimer) clearTimeout(updateTimer);
      unsubUpdated?.();
      unsubKilled?.();
    };
  }, [loadProcesses]); // 空依赖数组，只在挂载时注册一次

  // 处理搜索输入 - 使用防抖
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(0);
    optionsRef.current.searchTerm = value;
    optionsRef.current.currentPage = 0;
    // 防抖：延迟执行搜索
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => loadProcesses(), 300);
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
    const action = force ? '强制终止' : '终止';
    const warning = force
      ? '警告：强制终止可能会导致数据丢失！'
      : '此操作无法撤销。';

    setConfirmDialog({
      show: true,
      title: `${action}进程`,
      message: `确定要${action}进程 ${pid} 吗？\n\n${warning}`,
      confirmText: action,
      type: force ? 'danger' : 'warning',
      onConfirm: async () => {
        try {
          if (force) {
            await ProcessManagerService.ForceKillProcess(pid);
          } else {
            await ProcessManagerService.KillProcess(pid);
          }
          setConfirmDialog({ ...confirmDialog, show: false });
          setDetailProcess(null);
          loadProcesses();
        } catch (err) {
          console.error('Failed to kill process:', err);
          setConfirmDialog({
            show: true,
            title: '操作失败',
            message: `终止进程失败: ${err}`,
            confirmText: '确定',
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
      <div className="space-y-3" aria-busy="true">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 min-w-0 flex-1 rounded-[6px]" />
          <Skeleton className="h-8 w-28 shrink-0 rounded-[6px]" />
          <Skeleton className="h-8 w-16 shrink-0 rounded-[6px]" />
        </div>
        <div className="card p-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="my-1.5 h-6 rounded-[5px]" />
          ))}
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-3">
      {/* 搜索和过滤器 */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-1">
          <Icon
            name="search"
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-4"
          />
          <Input
            type="text"
            className="pl-8"
            placeholder="搜索进程名称、PID 或命令行..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Toggle checked={showSystem} onChange={handleShowSystemChange} label="显示系统进程" />
          <span className="select-none text-[12px] text-text-2">显示系统进程</span>
        </div>
        <Button variant="secondary" icon="refresh" onClick={handleRefresh} className="shrink-0">
          刷新
        </Button>
      </div>

      {/* 进程列表 */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            {/* 表头 */}
            <div className={`${ROW_GRID} hairline-b px-3 py-2.5`}>
              <SortHeader label="PID" column="pid" sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort} />
              <SortHeader label="名称" column="name" sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort} />
              <SortHeader label="CPU" column="cpu" sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort} alignRight />
              <SortHeader label="内存" column="memory" sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort} alignRight />
              <span className="text-[11px] font-medium text-text-3">状态</span>
              <span className="text-right text-[11px] font-medium text-text-3">线程</span>
              <span className="text-right text-[11px] font-medium text-text-3">操作</span>
            </div>

            {/* 表体 */}
            {loadError ? (
              <EmptyState
                icon="exclamation-circle"
                title="进程列表加载失败"
                description={loadError}
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    icon="refresh"
                    onClick={() => {
                      setLoadError(null);
                      loadProcesses();
                    }}
                  >
                    重试
                  </Button>
                }
              />
            ) : processes.length === 0 ? (
              <EmptyState
                icon="search"
                title="没有找到匹配的进程"
                description="尝试修改搜索关键词或调整筛选条件"
              />
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
          </div>
        </div>
      </div>

      {/* 分页控件 */}
      {totalCount > pageSize && (
        <div className="flex items-center justify-between gap-3">
          <p className="tnum truncate text-[12px] text-text-3">
            显示 {currentPage * pageSize + 1} - {Math.min((currentPage + 1) * pageSize, totalCount)} / 共 {totalCount} 个进程
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage === 0}
              onClick={() => handlePageChange(Math.max(0, currentPage - 1))}
            >
              上一页
            </Button>
            <span className="tnum text-[12px] text-text-2">
              第 {currentPage + 1} / {totalPages} 页
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={(currentPage + 1) * pageSize >= totalCount}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      {/* 最后更新时间 */}
      <p className="tnum text-center text-[11px] text-text-4">
        共 {totalCount} 个进程 · 最后更新: {lastUpdate.toLocaleString('zh-CN')} ({formatRelativeTime(lastUpdate.getTime())})
      </p>

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
