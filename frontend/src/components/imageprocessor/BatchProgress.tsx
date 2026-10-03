import { useEffect, useState } from 'react';
import { BatchProgress as BatchProgressType, ProcessingResult } from './types';
import { Icon } from '../Icon';
import { Badge, Button, Modal, ProgressBar } from '../ui';

interface BatchProgressProps {
  progress: BatchProgressType | null;
  onCancel: () => void;
  onClose: () => void;
  visible: boolean;
}

export function BatchProgress({
  progress,
  onCancel,
  onClose,
  visible,
}: BatchProgressProps): JSX.Element | null {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!progress?.isRunning) return;

    const startTime = progress.startTime * 1000;
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [progress?.isRunning, progress?.startTime]);

  if (!visible || !progress) return null;

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const percentage = progress.total > 0
    ? Math.round(((progress.completed + progress.failed) / progress.total) * 100)
    : 0;

  return (
    <Modal
      open={visible}
      onClose={onClose}
      title="批量处理"
      width={460}
      footer={
        progress.isRunning ? (
          <Button variant="danger" icon="stop" onClick={onCancel}>
            取消处理
          </Button>
        ) : (
          <Button variant="primary" onClick={onClose}>
            完成
          </Button>
        )
      }
    >
      {/* 进度条 */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] text-text-3">进度</span>
          <span className="tnum font-mono text-[12px] text-text-1">{percentage}%</span>
        </div>
        <ProgressBar value={percentage} tone="accent" />
        <div className="mt-2.5 flex items-center gap-1.5">
          <Badge tone="success">
            <span className="tnum">{progress.completed}</span> 成功
          </Badge>
          <Badge tone="error">
            <span className="tnum">{progress.failed}</span> 失败
          </Badge>
          <Badge tone="neutral">
            <span className="tnum">{progress.total}</span> 总计
          </Badge>
        </div>
      </div>

      {/* 当前文件 */}
      {progress.isRunning && progress.current && (
        <div className="card-inset mb-4 px-3 py-2.5">
          <div className="mb-0.5 text-[10.5px] text-text-4">正在处理</div>
          <div className="truncate text-[12.5px] text-text-1" title={progress.current}>
            {progress.current}
          </div>
        </div>
      )}

      {/* 耗时 */}
      <div className="mb-4 flex items-center gap-1.5 text-[12px] text-text-3">
        <Icon name="clock" size={13} className="shrink-0 text-text-4" />
        <span>
          已用时: <span className="tnum font-mono text-text-2">{formatTime(elapsedTime)}</span>
        </span>
      </div>

      {/* 结果列表 */}
      {progress.results.length > 0 && (
        <div className="mb-4 max-h-48 space-y-1 overflow-y-auto">
          {progress.results.slice(-5).map((result, index) => (
            <ResultItem
              key={`${result.inputPath}-${index}`}
              result={result}
              formatSize={formatSize}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

interface ResultItemProps {
  result: ProcessingResult;
  formatSize: (bytes: number) => string;
}

function ResultItem({ result, formatSize }: ResultItemProps): JSX.Element {
  const fileName = result.inputPath.split(/[/\\]/).pop() || result.inputPath;
  const sizeChange = result.sizeBefore && result.sizeAfter
    ? ((result.sizeAfter - result.sizeBefore) / result.sizeBefore * 100).toFixed(1)
    : null;

  return (
    <div className="flex items-center gap-2.5 rounded-[6px] bg-surface-1 px-2.5 py-2">
      <Icon
        name={result.success ? 'check-circle' : 'x-circle'}
        size={14}
        className={`shrink-0 ${result.success ? 'text-success-text' : 'text-error-text'}`}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] text-text-1" title={fileName}>
          {fileName}
        </div>
        {result.success && sizeChange && (
          <div className="tnum mt-0.5 text-[10.5px] text-text-4">
            {formatSize(result.sizeBefore)} → {formatSize(result.sizeAfter)}
            <span className={`ml-1.5 ${parseFloat(sizeChange) < 0 ? 'text-success-text' : 'text-error-text'}`}>
              {parseFloat(sizeChange) > 0 ? '+' : ''}{sizeChange}%
            </span>
          </div>
        )}
        {!result.success && result.error && (
          <div className="mt-0.5 truncate text-[10.5px] text-error-text" title={result.error}>
            {result.error}
          </div>
        )}
      </div>
    </div>
  );
}
