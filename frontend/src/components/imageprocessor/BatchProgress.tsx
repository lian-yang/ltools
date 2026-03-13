import { useEffect, useState } from 'react';
import { BatchProgress as BatchProgressType, ProcessingResult } from './types';
import { Icon } from '../Icon';

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-heavy rounded-2xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#FAF5FF] flex items-center gap-2">
            <Icon name="cog-6-tooth" className={`w-5 h-5 text-[#A78BFA] ${progress.isRunning ? 'animate-spin' : ''}`} />
            批量处理
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Icon name="x-mark" className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* 进度条 */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-white/60 mb-2">
            <span>进度</span>
            <span>{percentage}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/40 mt-2">
            <span>{progress.completed} 成功</span>
            <span>{progress.failed} 失败</span>
            <span>{progress.total} 总计</span>
          </div>
        </div>

        {/* 当前文件 */}
        {progress.isRunning && progress.current && (
          <div className="mb-4 px-3 py-2 bg-white/5 rounded-lg">
            <div className="text-xs text-white/40 mb-1">正在处理</div>
            <div className="text-sm text-white/70 truncate">{progress.current}</div>
          </div>
        )}

        {/* 耗时 */}
        <div className="flex items-center gap-2 mb-4 text-sm text-white/60">
          <Icon name="clock" className="w-4 h-4" />
          <span>已用时: {formatTime(elapsedTime)}</span>
        </div>

        {/* 结果列表 */}
        {progress.results.length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
            {progress.results.slice(-5).map((result, index) => (
              <ResultItem
                key={index}
                result={result}
                formatSize={formatSize}
              />
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-3">
          {progress.isRunning ? (
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Icon name="stop" className="w-4 h-4" />
              取消处理
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg font-medium transition-colors"
            >
              完成
            </button>
          )}
        </div>
      </div>
    </div>
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
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
      result.success ? 'bg-green-500/10' : 'bg-red-500/10'
    }`}>
      <Icon
        name={result.success ? 'check-circle' : 'x-circle'}
        className={`w-4 h-4 flex-shrink-0 ${result.success ? 'text-green-400' : 'text-red-400'}`}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white/70 truncate">{fileName}</div>
        {result.success && sizeChange && (
          <div className="text-xs text-white/40">
            {formatSize(result.sizeBefore)} → {formatSize(result.sizeAfter)} &nbsp;
            <span className={parseFloat(sizeChange) < 0 ? 'text-green-400' : 'text-red-400'}>
              {parseFloat(sizeChange) > 0 ? '+' : ''}{sizeChange}%
            </span>
          </div>
        )}
        {!result.success && result.error && (
          <div className="text-xs text-red-400 truncate">{result.error}</div>
        )}
      </div>
    </div>
  );
}
