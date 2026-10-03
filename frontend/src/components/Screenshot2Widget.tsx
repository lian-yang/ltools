import React, { useState } from 'react';
import { Icon } from './Icon';
import * as Screenshot2Service from '../../bindings/ltools/plugins/screenshot2/screenshot2service';

const features = [
  '多显示器同时覆盖',
  '拖拽选择截图区域',
  '8 个调整手柄',
  '标注工具(矩形、椭圆、箭头等)',
  '一键复制到剪贴板',
];

const Screenshot2Widget: React.FC = () => {
  const [isCapturing, setIsCapturing] = useState(false);

  const handleStartCapture = async () => {
    if (isCapturing) return;

    setIsCapturing(true);
    try {
      await Screenshot2Service.StartCapture();
    } catch (error) {
      console.error('[Screenshot2Widget] Failed to start capture:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-accent-subtle">
          <Icon name="camera" size={16} color="var(--color-accent-text)" />
        </div>
        <h3 className="text-[14px] font-semibold text-text-1">截图</h3>
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-text-2">
        按下按钮或使用快捷键开始截屏,拖拽选择区域后进行标注与保存。
      </p>

      <ul className="mt-3 space-y-1.5 text-[12px] text-text-3">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <Icon name="check" size={12} color="var(--color-text-4)" />
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={handleStartCapture}
        disabled={isCapturing}
        className="btn btn-primary btn-lg mt-4 w-full"
      >
        <Icon name="camera" size={15} />
        {isCapturing ? '正在截图…' : '开始截图'}
      </button>
      <p className="mt-2 text-center text-[11px] text-text-4">
        快捷键 <span className="shortcut-key">Ctrl+Shift+S</span>
      </p>
    </div>
  );
};

export default Screenshot2Widget;
