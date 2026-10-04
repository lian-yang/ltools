import React, { useState, useEffect, useCallback } from 'react';
import { Window } from '@wailsio/runtime';
import { Icon } from '../Icon';
import * as Screenshot2Service from '../../../bindings/ltools/plugins/screenshot2/screenshot2service';
import './PinWindow.css';
import { t } from '@/i18n';

interface PinWindowProps {
  windowId: number;
}

// 最大窗口尺寸（超过此尺寸自动缩放）
const MAX_SIZE = 400;
// 最小窗口尺寸
const MIN_SIZE = 200;

/**
 * 贴图窗口组件
 * - 无边框窗口显示图片
 * - 可拖动、缩放
 * - 双击还原原始尺寸
 * - 始终置顶
 */
const PinWindow: React.FC<PinWindowProps> = ({ windowId }) => {
  const [imageData, setImageData] = useState<string>('');
  const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [savedSize, setSavedSize] = useState<{ width: number; height: number } | null>(null);
  const [isOriginalSize, setIsOriginalSize] = useState(false);

  // 从后端获取图片数据
  useEffect(() => {
    const fetchImageData = async () => {
      try {
        const data = await Screenshot2Service.GetPinImageData(windowId);
        if (data) {
          setImageData(data);
        }
      } catch (e) {
        console.error('[PinWindow] Failed to get image data:', e);
      }
    };
    fetchImageData();
  }, [windowId]);

  // 加载图片并设置窗口大小
  useEffect(() => {
    if (!imageData) return;
    const img = new Image();
    img.onload = async () => {
      const origW = img.width;
      const origH = img.height;
      setOriginalSize({ width: origW, height: origH });

      // 计算初始窗口大小（如果图片太大则缩放窗口）
      let displayW = origW;
      let displayH = origH;

      if (origW > MAX_SIZE || origH > MAX_SIZE) {
        const scale = Math.min(MAX_SIZE / origW, MAX_SIZE / origH);
        displayW = Math.round(origW * scale);
        displayH = Math.round(origH * scale);
      }

      setWindowSize({ width: displayW, height: displayH });
      await Window.SetSize(displayW, displayH);
    };
    img.src = imageData;
  }, [imageData]);

  // 关闭窗口
  const handleClose = useCallback(() => {
    Screenshot2Service.ClosePinWindow(windowId);
  }, [windowId]);

  // 双击切换：原图大小 ↔ 之前的大小
  const handleDoubleClick = useCallback(async () => {
    if (originalSize.width <= 0 || originalSize.height <= 0) return;

    if (isOriginalSize && savedSize) {
      // 当前是原图大小，还原到之前保存的大小
      setWindowSize(savedSize);
      await Window.SetSize(savedSize.width, savedSize.height);
      setIsOriginalSize(false);
    } else {
      // 当前不是原图大小，保存当前大小并切换到原图
      setSavedSize(windowSize);
      setWindowSize({ width: originalSize.width, height: originalSize.height });
      await Window.SetSize(originalSize.width, originalSize.height);
      setIsOriginalSize(true);
    }
  }, [originalSize, windowSize, savedSize, isOriginalSize]);

  // 开始缩放
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setDragStart({ x: e.screenX, y: e.screenY });
  }, []);

  // 缩放中
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = async (e: MouseEvent) => {
      const dx = e.screenX - dragStart.x;
      const dy = e.screenY - dragStart.y;

      // 最小窗口尺寸 200x200
      const newWindowW = Math.max(MIN_SIZE, windowSize.width + dx);
      const newWindowH = Math.max(MIN_SIZE, windowSize.height + dy);

      setWindowSize({ width: newWindowW, height: newWindowH });
      setIsOriginalSize(false); // 手动缩放后标记为非原图大小
      setDragStart({ x: e.screenX, y: e.screenY });

      await Window.SetSize(newWindowW, newWindowH);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, dragStart, windowSize]);

  return (
    <div className="pin-window" style={{ '--wails-draggable': 'drag' } as React.CSSProperties}>
      {/* 关闭按钮 - 绝对定位右上角 */}
      <button
        className="pin-close-btn"
        onClick={handleClose}
        title={t("关闭")}
        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
      >
        <Icon name="x-mark" size={14} />
      </button>

      {/* 图片区域 */}
      <div
        className="pin-image-container"
        onDoubleClick={handleDoubleClick}
      >
        {imageData && (
          <img
            src={imageData}
            alt="pinned"
            draggable={false}
          />
        )}
      </div>

      {/* 缩放手柄 */}
      <div
        className="pin-resize-handle"
        onMouseDown={handleResizeStart}
        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
      />
    </div>
  );
};

export default PinWindow;
