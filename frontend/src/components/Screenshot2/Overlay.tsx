import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Events, Dialogs } from '@wailsio/runtime';
import * as Screenshot2Service from '../../../bindings/ltools/plugins/screenshot2/screenshot2service';
import { useAnnotation } from './hooks/useAnnotation';
import Toolbar from './Toolbar';
import './styles.css';
import { t } from '@/i18n';

// 选区类型
interface Selection {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 显示器信息
interface DisplayInfo {
  index: number;
  width: number;
  height: number;
  x: number;
  y: number;
  primary: boolean;
  name: string;
  scaleFactor: number;
}

// 拖拽手柄类型
type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null;

// Toast 组件
const Toast: React.FC<{ message: string; visible: boolean }> = ({ message, visible }) => {
  if (!visible) return null;
  return (
    <div className="screenshot2-toast">
      {message}
    </div>
  );
};

// 主覆盖层组件
const Screenshot2Overlay: React.FC = () => {
  const [_sessionId, setSessionId] = useState<string>('');
  const [_displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [imageData, setImageData] = useState<string>('');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  const [activeHandle, setActiveHandle] = useState<HandleType>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [originalSelection, setOriginalSelection] = useState<Selection | null>(null);
  const [toast, setToast] = useState({ message: '', visible: false });
  const [isAnnotating, setIsAnnotating] = useState(false);

  // 文字输入状态
  const [textInput, setTextInput] = useState<{
    visible: boolean;
    x: number;
    y: number;
    value: string;
  }>({ visible: false, x: 0, y: 0, value: '' });
  const textInputRef = useRef<HTMLInputElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const selectionRef = useRef<Selection | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // 使用标注 Hook
  const {
    annotations,
    currentType,
    currentColor,
    strokeWidth,
    fontSize,
    currentAnnotation,
    setTool,
    setColor,
    setStrokeWidth,
    setFontSize,
    startDrawing,
    updateDrawing,
    finishDrawing,
    undo,
    redo,
    clearAnnotations,
    addTextAnnotation,
    canUndo,
    canRedo,
  } = useAnnotation();

  // 从 URL 获取参数
  const getDisplayIndex = (): number => {
    const params = new URLSearchParams(window.location.search);
    return parseInt(params.get('display') || '0', 10);
  };

  const getScaleFactor = (): number => {
    const params = new URLSearchParams(window.location.search);
    return parseFloat(params.get('scale') || '1.0');
  };

  const currentDisplayIndex = getDisplayIndex();
  const scaleFactor = getScaleFactor();

  // 显示 Toast
  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 2000);
  }, []);

  // 初始化事件监听
  useEffect(() => {
    console.log('[Screenshot2Overlay] Component mounted, registering event listeners...');

    // 重要：先注册所有事件监听器，然后再通知后端前端已就绪
    // 这样可以确保不会错过任何事件（包括图片数据）
    const unsubscribeSessionStart = Events.On('screenshot2:session-start', (ev: any) => {
      console.log('[Screenshot2Overlay] Session started:', ev.data);
      setSessionId(ev.data);
      setSelection(null);
      setIsSelecting(false);
    });

    const unsubscribeDisplaysInfo = Events.On('screenshot2:displays-info', (ev: any) => {
      try {
        const displaysData = JSON.parse(ev.data);
        setDisplays(displaysData);
      } catch (e) {
        console.error('[Screenshot2Overlay] Failed to parse displays info:', e);
      }
    });

    const unsubscribeImageData = Events.On('screenshot2:image-data', (ev: any) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.displayIndex === currentDisplayIndex) {
          setImageData(data.imageData);
          setSessionId(data.sessionId);
        }
      } catch (e) {
        console.error('[Screenshot2Overlay] Failed to parse image data:', e);
      }
    });

    const unsubscribeSessionEnd = Events.On('screenshot2:session-end', () => {
      setSessionId('');
      setImageData('');
      setSelection(null);
    });

    // 监听其他窗口的选区开始事件，清除本窗口选区
    const unsubscribeSelectionStarted = Events.On('screenshot2:selection-started', (ev: any) => {
      const sourceDisplayIndex = ev.data;
      if (sourceDisplayIndex !== currentDisplayIndex) {
        console.log('[Screenshot2Overlay] Clearing selection, selection started on display', sourceDisplayIndex);
        setSelection(null);
        setIsSelecting(false);
        setIsDraggingHandle(false);
        setActiveHandle(null);
      }
    });

    // 所有事件监听器已注册，现在通知后端前端已就绪
    console.log('[Screenshot2Overlay] All event listeners registered, calling FrontendReady for display', currentDisplayIndex);
    Screenshot2Service.FrontendReady(currentDisplayIndex).then(() => {
      console.log('[Screenshot2Overlay] FrontendReady called successfully for display', currentDisplayIndex);
    }).catch((err) => {
      console.error('[Screenshot2Overlay] Failed to notify frontend ready:', err);
    });

    return () => {
      unsubscribeSessionStart();
      unsubscribeDisplaysInfo();
      unsubscribeImageData();
      unsubscribeSessionEnd();
      unsubscribeSelectionStarted();
    };
  }, [currentDisplayIndex]);

  // 加载图片
  useEffect(() => {
    if (imageData && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        setCanvasSize({ width: img.width, height: img.height });
        console.log('[Screenshot2Overlay] Image loaded: ', img.width, 'x', img.height);
      };
      img.src = imageData;
    }
  }, [imageData]);

  // 同步 selection 到 ref（用于双击等事件处理）
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  // 获取手柄位置
  const getHandlePositions = useCallback((sel: Selection): Record<string, { x: number; y: number }> => {
    return {
      nw: { x: sel.x, y: sel.y },
      n: { x: sel.x + sel.width / 2, y: sel.y },
      ne: { x: sel.x + sel.width, y: sel.y },
      e: { x: sel.x + sel.width, y: sel.y + sel.height / 2 },
      se: { x: sel.x + sel.width, y: sel.y + sel.height },
      s: { x: sel.x + sel.width / 2, y: sel.y + sel.height },
      sw: { x: sel.x, y: sel.y + sel.height },
      w: { x: sel.x, y: sel.y + sel.height / 2 },
    };
  }, []);

  // 检测点击的手柄
  const detectHandle = useCallback((x: number, y: number, sel: Selection): HandleType => {
    const handleSize = 12; // 点击检测范围
    const handles = getHandlePositions(sel);

    for (const [type, pos] of Object.entries(handles)) {
      if (type === 'null') continue;
      if (Math.abs(x - pos.x) <= handleSize && Math.abs(y - pos.y) <= handleSize) {
        return type as HandleType;
      }
    }
    return null;
  }, [getHandlePositions]);

  // 获取物理坐标
  const getPhysicalCoords = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const logicalX = e.clientX - rect.left;
    const logicalY = e.clientY - rect.top;
    return {
      x: logicalX * scaleFactor,
      y: logicalY * scaleFactor,
    };
  }, [scaleFactor]);

  // 鼠标按下
  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    // 先聚焦当前窗口
    try {
      await Screenshot2Service.FocusDisplayWindow(currentDisplayIndex);
    } catch (err) {
      console.error('[Screenshot2Overlay] Failed to focus window:', err);
    }

    const { x, y } = getPhysicalCoords(e);

    // 如果有选区且选择了标注工具，检查是否在选区内开始标注
    if (selection && selection.width > 0 && selection.height > 0 && currentType) {
      const inSelection =
        x >= selection.x &&
        x <= selection.x + selection.width &&
        y >= selection.y &&
        y <= selection.y + selection.height;

      if (inSelection) {
        // 文字工具：显示文本输入框
        if (currentType === 'text') {
          setTextInput({
            visible: true,
            x: x / scaleFactor, // 转换为逻辑坐标用于 CSS 定位
            y: y / scaleFactor,
            value: '',
          });
          // 延迟聚焦输入框
          setTimeout(() => textInputRef.current?.focus(), 0);
          return;
        }

        // 其他标注工具：开始绘制
        setIsAnnotating(true);
        startDrawing(x, y);
        return;
      }
    }

    // 广播选区开始事件，通知其他窗口清除选区
    Events.Emit('screenshot2:selection-started', currentDisplayIndex);

    // 如果已有选区，检查是否点击了手柄
    if (selection && selection.width > 0 && selection.height > 0) {
      const handle = detectHandle(x, y, selection);
      if (handle) {
        setIsDraggingHandle(true);
        setActiveHandle(handle);
        setStartPos({ x, y });
        setOriginalSelection({ ...selection });
        return;
      }
    }

    // 开始新的选区
    setIsSelecting(true);
    setStartPos({ x, y });
    setSelection({ x, y, width: 0, height: 0 });
    clearAnnotations(); // 清空之前的标注
  }, [selection, detectHandle, getPhysicalCoords, currentType, startDrawing, currentDisplayIndex, clearAnnotations]);

  // 鼠标移动
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const { x, y } = getPhysicalCoords(e);

    // 如果正在标注绘制
    if (isAnnotating) {
      // 限制画笔坐标在选区范围内
      if (currentType === 'brush' && selection) {
        const clampedX = Math.max(selection.x, Math.min(x, selection.x + selection.width));
        const clampedY = Math.max(selection.y, Math.min(y, selection.y + selection.height));
        updateDrawing(clampedX, clampedY);
      } else {
        updateDrawing(x, y);
      }
      return;
    }

    // 更新鼠标样式
    if (selection && selection.width > 0 && selection.height > 0) {
      // 如果选择了标注工具，在选区内显示对应光标
      if (currentType) {
        const inSelection =
          x >= selection.x &&
          x <= selection.x + selection.width &&
          y >= selection.y &&
          y <= selection.y + selection.height;
        if (inSelection) {
          // 根据工具类型设置不同的光标
          const cursorMap: Record<string, string> = {
            rect: 'crosshair',
            ellipse: 'crosshair',
            arrow: 'crosshair',
            text: 'text',
            brush: 'crosshair',
            mosaic: 'cell',
            blur: 'crosshair',
          };
          canvasRef.current!.style.cursor = cursorMap[currentType] || 'crosshair';
          return;
        }
      }

      const handle = detectHandle(x, y, selection);
      if (handle) {
        const cursorMap: Record<string, string> = {
          nw: 'nwse-resize', se: 'nwse-resize',
          ne: 'nesw-resize', sw: 'nesw-resize',
          n: 'ns-resize', s: 'ns-resize',
          e: 'ew-resize', w: 'ew-resize',
        };
        canvasRef.current!.style.cursor = cursorMap[handle] || 'crosshair';
      } else {
        canvasRef.current!.style.cursor = 'crosshair';
      }
    }

    // 拖拽手柄调整选区
    if (isDraggingHandle && activeHandle && originalSelection) {
      const dx = x - startPos.x;
      const dy = y - startPos.y;

      let newSel = { ...originalSelection };

      switch (activeHandle) {
        case 'nw':
          newSel.x = originalSelection.x + dx;
          newSel.y = originalSelection.y + dy;
          newSel.width = originalSelection.width - dx;
          newSel.height = originalSelection.height - dy;
          break;
        case 'n':
          newSel.y = originalSelection.y + dy;
          newSel.height = originalSelection.height - dy;
          break;
        case 'ne':
          newSel.y = originalSelection.y + dy;
          newSel.width = originalSelection.width + dx;
          newSel.height = originalSelection.height - dy;
          break;
        case 'e':
          newSel.width = originalSelection.width + dx;
          break;
        case 'se':
          newSel.width = originalSelection.width + dx;
          newSel.height = originalSelection.height + dy;
          break;
        case 's':
          newSel.height = originalSelection.height + dy;
          break;
        case 'sw':
          newSel.x = originalSelection.x + dx;
          newSel.width = originalSelection.width - dx;
          newSel.height = originalSelection.height + dy;
          break;
        case 'w':
          newSel.x = originalSelection.x + dx;
          newSel.width = originalSelection.width - dx;
          break;
      }

      // 规范化选区（处理负宽高）
      if (newSel.width < 0) {
        newSel.x += newSel.width;
        newSel.width = -newSel.width;
      }
      if (newSel.height < 0) {
        newSel.y += newSel.height;
        newSel.height = -newSel.height;
      }

      setSelection(newSel);
      return;
    }

    // 创建新选区
    if (!isSelecting) return;

    const selX = Math.min(startPos.x, x);
    const selY = Math.min(startPos.y, y);
    const selWidth = Math.abs(x - startPos.x);
    const selHeight = Math.abs(y - startPos.y);

    setSelection({ x: selX, y: selY, width: selWidth, height: selHeight });
  }, [isSelecting, isDraggingHandle, isAnnotating, activeHandle, startPos, selection, originalSelection, currentType, detectHandle, getPhysicalCoords, updateDrawing]);

  // 鼠标松开
  const handleMouseUp = useCallback(() => {
    if (isAnnotating) {
      finishDrawing();
      setIsAnnotating(false);
      return;
    }
    setIsSelecting(false);
    setIsDraggingHandle(false);
    setActiveHandle(null);
    setOriginalSelection(null);
  }, [isAnnotating, finishDrawing]);

  // 全局鼠标移动（用于跨显示器拖拽）
  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isSelecting && !isDraggingHandle && !isAnnotating) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // 计算相对于 canvas 的坐标
    const logicalX = e.clientX - rect.left;
    const logicalY = e.clientY - rect.top;
    const x = logicalX * scaleFactor;
    const y = logicalY * scaleFactor;

    // 如果正在标注绘制
    if (isAnnotating) {
      // 限制画笔坐标在选区范围内
      if (currentType === 'brush' && selection) {
        const clampedX = Math.max(selection.x, Math.min(x, selection.x + selection.width));
        const clampedY = Math.max(selection.y, Math.min(y, selection.y + selection.height));
        updateDrawing(clampedX, clampedY);
      } else {
        updateDrawing(x, y);
      }
      return;
    }

    // 拖拽手柄调整选区
    if (isDraggingHandle && activeHandle && originalSelection) {
      const dx = x - startPos.x;
      const dy = y - startPos.y;

      let newSel = { ...originalSelection };

      switch (activeHandle) {
        case 'nw':
          newSel.x = originalSelection.x + dx;
          newSel.y = originalSelection.y + dy;
          newSel.width = originalSelection.width - dx;
          newSel.height = originalSelection.height - dy;
          break;
        case 'n':
          newSel.y = originalSelection.y + dy;
          newSel.height = originalSelection.height - dy;
          break;
        case 'ne':
          newSel.y = originalSelection.y + dy;
          newSel.width = originalSelection.width + dx;
          newSel.height = originalSelection.height - dy;
          break;
        case 'e':
          newSel.width = originalSelection.width + dx;
          break;
        case 'se':
          newSel.width = originalSelection.width + dx;
          newSel.height = originalSelection.height + dy;
          break;
        case 's':
          newSel.height = originalSelection.height + dy;
          break;
        case 'sw':
          newSel.x = originalSelection.x + dx;
          newSel.width = originalSelection.width - dx;
          newSel.height = originalSelection.height + dy;
          break;
        case 'w':
          newSel.x = originalSelection.x + dx;
          newSel.width = originalSelection.width - dx;
          break;
      }

      // 规范化选区（处理负宽高）
      if (newSel.width < 0) {
        newSel.x += newSel.width;
        newSel.width = -newSel.width;
      }
      if (newSel.height < 0) {
        newSel.y += newSel.height;
        newSel.height = -newSel.height;
      }

      setSelection(newSel);
      return;
    }

    // 创建新选区
    if (!isSelecting) return;

    const selX = Math.min(startPos.x, x);
    const selY = Math.min(startPos.y, y);
    const selWidth = Math.abs(x - startPos.x);
    const selHeight = Math.abs(y - startPos.y);

    setSelection({ x: selX, y: selY, width: selWidth, height: selHeight });
  }, [isSelecting, isDraggingHandle, isAnnotating, activeHandle, startPos, originalSelection, scaleFactor, currentType, selection, updateDrawing]);

  // 全局鼠标松开
  const handleGlobalMouseUp = useCallback(() => {
    if (isAnnotating) {
      finishDrawing();
      setIsAnnotating(false);
      return;
    }
    setIsSelecting(false);
    setIsDraggingHandle(false);
    setActiveHandle(null);
    setOriginalSelection(null);
  }, [isAnnotating, finishDrawing]);

  // 注册全局鼠标事件（在选区开始时）
  useEffect(() => {
    if (isSelecting || isDraggingHandle || isAnnotating) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isSelecting, isDraggingHandle, isAnnotating, handleGlobalMouseMove, handleGlobalMouseUp]);

  // 鼠标进入窗口时聚焦该窗口
  const handleMouseEnter = useCallback(async () => {
    console.log('[Screenshot2Overlay] Mouse entered, focusing window for display', currentDisplayIndex);
    try {
      await Screenshot2Service.FocusDisplayWindow(currentDisplayIndex);
    } catch (e) {
      console.error('[Screenshot2Overlay] Failed to focus window:', e);
    }
  }, [currentDisplayIndex]);

  // 双击复制 - 使用 ref 获取最新选区状态
  const handleDoubleClick = useCallback(async () => {
    const currentSelection = selectionRef.current;
    const currentImage = imageRef.current;

    console.log('[Screenshot2Overlay] Double click detected, selection:', currentSelection);

    if (!currentSelection || currentSelection.width < 10 || currentSelection.height < 10) {
      console.log('[Screenshot2Overlay] Selection too small or null');
      return;
    }

    if (!currentImage) {
      console.log('[Screenshot2Overlay] No image loaded');
      return;
    }

    try {
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = currentSelection.width;
      cropCanvas.height = currentSelection.height;
      const ctx = cropCanvas.getContext('2d')!;

      // 单屏幕模式：直接从当前屏幕截图裁剪
      ctx.drawImage(
        currentImage,
        currentSelection.x, currentSelection.y, currentSelection.width, currentSelection.height,
        0, 0, currentSelection.width, currentSelection.height
      );

      const base64Data = cropCanvas.toDataURL('image/png');
      console.log('[Screenshot2Overlay] Copying to clipboard...');
      await Screenshot2Service.CopyToClipboard(base64Data);

      showToast(t('已复制到剪贴板'));

      setTimeout(async () => {
        await Screenshot2Service.CancelCapture();
      }, 500);
    } catch (e) {
      console.error('[Screenshot2Overlay] Double-click copy failed:', e);
      showToast(t('复制失败'));
    }
  }, [showToast]);

  // 取消
  const handleCancel = useCallback(async () => {
    try {
      await Screenshot2Service.CancelCapture();
    } catch (e) {
      console.error('[Screenshot2Overlay] Cancel failed:', e);
    }
  }, []);

  // 绘制单个标注的辅助函数（不使用 useCallback，以便在 handleCopy/handleSave 中使用）
  // sourceCanvas: 用于马赛克效果采样像素
  // scale: 缩放因子，用于将逻辑像素转换为物理像素
  const renderAnnotation = (
    ctx: CanvasRenderingContext2D,
    ann: typeof annotations[0],
    offsetX = 0,
    offsetY = 0,
    sourceCanvas?: HTMLCanvasElement | null,
    scale = 1
  ) => {
    ctx.strokeStyle = ann.color || '#ff0000';
    ctx.fillStyle = ann.color || '#ff0000';
    ctx.lineWidth = (ann.strokeWidth || 2) * scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const x = ann.x - offsetX;
    const y = ann.y - offsetY;

    switch (ann.type) {
      case 'rect':
        ctx.strokeRect(x, y, ann.width || 0, ann.height || 0);
        break;

      case 'ellipse':
        ctx.beginPath();
        const rx = (ann.width || 0) / 2;
        const ry = (ann.height || 0) / 2;
        ctx.ellipse(x + rx, y + ry, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'arrow':
        // 箭头支持任意方向（包括负的 width/height）
        const arrowW = ann.width ?? 0;
        const arrowH = ann.height ?? 0;
        const arrowEndX = x + arrowW;
        const arrowEndY = y + arrowH;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(arrowEndX, arrowEndY);
        ctx.stroke();

        // 箭头头部
        const arrowAngle = Math.atan2(arrowH, arrowW);
        const arrowHeadLen = Math.max(15, (ann.strokeWidth || 2) * 4);
        ctx.beginPath();
        ctx.moveTo(arrowEndX, arrowEndY);
        ctx.lineTo(
          arrowEndX - arrowHeadLen * Math.cos(arrowAngle - Math.PI / 6),
          arrowEndY - arrowHeadLen * Math.sin(arrowAngle - Math.PI / 6)
        );
        ctx.moveTo(arrowEndX, arrowEndY);
        ctx.lineTo(
          arrowEndX - arrowHeadLen * Math.cos(arrowAngle + Math.PI / 6),
          arrowEndY - arrowHeadLen * Math.sin(arrowAngle + Math.PI / 6)
        );
        ctx.stroke();
        break;

      case 'brush':
        if (ann.points && ann.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(ann.points[0].x - offsetX, ann.points[0].y - offsetY);
          for (let i = 1; i < ann.points.length; i++) {
            ctx.lineTo(ann.points[i].x - offsetX, ann.points[i].y - offsetY);
          }
          ctx.stroke();
        }
        break;

      case 'mosaic':
        // 真正的马赛克效果：像素化
        const blockSize = 12;
        const mosaicW = Math.abs(ann.width || 0);
        const mosaicH = Math.abs(ann.height || 0);
        const mosaicX = ann.width && ann.width < 0 ? x + ann.width : x;
        const mosaicY = ann.height && ann.height < 0 ? y + ann.height : y;

        if (sourceCanvas && mosaicW > 0 && mosaicH > 0) {
          const sourceCtx = sourceCanvas.getContext('2d');
          if (sourceCtx) {
            for (let py = mosaicY; py < mosaicY + mosaicH; py += blockSize) {
              for (let px = mosaicX; px < mosaicX + mosaicW; px += blockSize) {
                // 采样中心像素
                const sampleX = px + blockSize / 2;
                const sampleY = py + blockSize / 2;
                try {
                  const pixel = sourceCtx.getImageData(
                    sampleX + offsetX, sampleY + offsetY, 1, 1
                  ).data;
                  ctx.fillStyle = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
                  const bw = Math.min(blockSize, mosaicX + mosaicW - px);
                  const bh = Math.min(blockSize, mosaicY + mosaicH - py);
                  ctx.fillRect(px, py, bw, bh);
                } catch {
                  // 如果无法获取像素，使用灰色
                  ctx.fillStyle = '#888';
                  ctx.fillRect(px, py, blockSize, blockSize);
                }
              }
            }
          }
        } else {
          // 没有源图像时使用灰色马赛克
          for (let py = mosaicY; py < mosaicY + mosaicH; py += blockSize) {
            for (let px = mosaicX; px < mosaicX + mosaicW; px += blockSize) {
              const gray = ((Math.floor(px / blockSize) + Math.floor(py / blockSize)) % 2) * 30 + 100;
              ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
              const bw = Math.min(blockSize, mosaicX + mosaicW - px);
              const bh = Math.min(blockSize, mosaicY + mosaicH - py);
              ctx.fillRect(px, py, bw, bh);
            }
          }
        }
        break;

      case 'text':
        if (ann.text) {
          const physicalFontSize = (ann.fontSize || 18) * scale;
          ctx.font = `${physicalFontSize}px sans-serif`;
          ctx.fillText(ann.text, x, y);
        }
        break;

      case 'blur':
        // 模糊效果：简化为半透明覆盖
        ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
        ctx.fillRect(x, y, ann.width || 0, ann.height || 0);
        break;
    }
  };

  // 绘制单个标注（用于 canvas 渲染）
  const drawAnnotation = useCallback((ctx: CanvasRenderingContext2D, ann: typeof annotations[0], sourceCanvas?: HTMLCanvasElement | null) => {
    renderAnnotation(ctx, ann, 0, 0, sourceCanvas, scaleFactor);
  }, [scaleFactor]);

  // 复制到剪贴板
  const handleCopy = useCallback(async () => {
    if (!selection || !imageRef.current || !canvasRef.current) return;

    try {
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = selection.width;
      cropCanvas.height = selection.height;
      const ctx = cropCanvas.getContext('2d')!;

      // 绘制原图
      ctx.drawImage(
        imageRef.current,
        selection.x, selection.y, selection.width, selection.height,
        0, 0, selection.width, selection.height
      );

      // 绘制所有标注（相对于选区偏移）
      // 传递原始 canvasRef 用于马赛克采样（马赛克需要从原始图像采样）
      annotations.forEach(ann => renderAnnotation(ctx, ann, selection.x, selection.y, canvasRef.current, scaleFactor));

      const base64Data = cropCanvas.toDataURL('image/png');
      await Screenshot2Service.CopyToClipboard(base64Data);

      showToast(t('已复制到剪贴板'));

      setTimeout(async () => {
        await Screenshot2Service.CancelCapture();
      }, 500);
    } catch (e) {
      console.error('[Screenshot2Overlay] Copy failed:', e);
      showToast(t('复制失败'));
    }
  }, [selection, annotations, scaleFactor, showToast]);

  // 保存文件
  const handleSave = useCallback(async () => {
    if (!selection || !imageRef.current || !canvasRef.current) return;

    try {
      // 使用 Wails SaveFile 对话框
      const filePath = await Dialogs.SaveFile({
        Title: t('保存截图'),
        Filename: `screenshot_${Date.now()}.png`,
        Filters: [
          { DisplayName: t('PNG 图片'), Pattern: '*.png' },
          { DisplayName: t('JPEG 图片'), Pattern: '*.jpg' },
        ],
      });

      // 用户取消保存
      if (!filePath) {
        return;
      }

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = selection.width;
      cropCanvas.height = selection.height;
      const ctx = cropCanvas.getContext('2d')!;

      // 绘制原图
      ctx.drawImage(
        imageRef.current,
        selection.x, selection.y, selection.width, selection.height,
        0, 0, selection.width, selection.height
      );

      // 绘制所有标注（相对于选区偏移）
      // 传递原始 canvasRef 用于马赛克采样
      annotations.forEach(ann => renderAnnotation(ctx, ann, selection.x, selection.y, canvasRef.current, scaleFactor));

      // 根据文件扩展名选择格式
      const isJpeg = filePath.toLowerCase().endsWith('.jpg') || filePath.toLowerCase().endsWith('.jpeg');
      const mimeType = isJpeg ? 'image/jpeg' : 'image/png';
      const base64Data = cropCanvas.toDataURL(mimeType, 0.95);

      // 调用后端保存文件
      await Screenshot2Service.SaveImage(base64Data, filePath);
      showToast(t('已保存'));

      setTimeout(async () => {
        await Screenshot2Service.CancelCapture();
      }, 500);
    } catch (e) {
      console.error('[Screenshot2Overlay] Save failed:', e);
      showToast(t('保存失败'));
    }
  }, [selection, annotations, scaleFactor, showToast]);

  // 贴图
  const handlePin = useCallback(async () => {
    if (!selection || !imageRef.current || !canvasRef.current) return;

    try {
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = selection.width;
      cropCanvas.height = selection.height;
      const ctx = cropCanvas.getContext('2d')!;

      // 绘制原图
      ctx.drawImage(
        imageRef.current,
        selection.x, selection.y, selection.width, selection.height,
        0, 0, selection.width, selection.height
      );

      // 绘制所有标注
      annotations.forEach(ann => renderAnnotation(ctx, ann, selection.x, selection.y, canvasRef.current, scaleFactor));

      const base64Data = cropCanvas.toDataURL('image/png');

      // 计算窗口位置（屏幕中心偏上）
      const windowX = Math.round(selection.x / scaleFactor);
      const windowY = Math.round(selection.y / scaleFactor);
      const windowWidth = Math.round(selection.width / scaleFactor);
      const windowHeight = Math.round(selection.height / scaleFactor);

      await Screenshot2Service.PinImage(base64Data, windowX, windowY, windowWidth, windowHeight);

      showToast(t('已创建贴图'));

      // 关闭截图窗口
      setTimeout(async () => {
        await Screenshot2Service.CancelCapture();
      }, 300);
    } catch (e) {
      console.error('[Screenshot2Overlay] Pin failed:', e);
      showToast(t('贴图失败'));
    }
  }, [selection, annotations, scaleFactor, showToast]);

  // 绘制遮罩和选区
  useEffect(() => {
    if (!canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const img = imageRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (selection && selection.width > 0 && selection.height > 0) {
      ctx.clearRect(selection.x, selection.y, selection.width, selection.height);
      ctx.drawImage(
        img,
        selection.x, selection.y, selection.width, selection.height,
        selection.x, selection.y, selection.width, selection.height
      );

      // 绘制已完成的标注，传递 canvas 用于马赛克采样
      annotations.forEach(ann => drawAnnotation(ctx, ann, canvas));

      // 绘制当前正在绘制的标注
      if (currentAnnotation) {
        drawAnnotation(ctx, currentAnnotation, canvas);
      }

      // 选区边框
      ctx.strokeStyle = '#00a8ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(selection.x, selection.y, selection.width, selection.height);

      // 8个调整手柄
      const handleSize = 8;
      ctx.fillStyle = '#00a8ff';
      const handles = getHandlePositions(selection);
      Object.entries(handles).forEach(([, pos]) => {
        ctx.fillRect(pos.x - handleSize / 2, pos.y - handleSize / 2, handleSize, handleSize);
      });

      // 尺寸标签
      ctx.fillStyle = '#00a8ff';
      ctx.font = '12px sans-serif';
      const sizeText = `${Math.round(selection.width)} × ${Math.round(selection.height)}`;
      ctx.fillText(sizeText, selection.x + selection.width / 2 - ctx.measureText(sizeText).width / 2, selection.y - 5);
    }
  }, [selection, imageData, getHandlePositions, annotations, currentAnnotation, drawAnnotation]);

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果在文本输入框中，不处理快捷键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // ESC - 取消或退出工具
      if (e.key === 'Escape') {
        if (currentType) {
          // 如果有选中的工具，先退出工具
          setTool(null);
        } else {
          // 否则取消截图
          handleCancel();
        }
        return;
      }

      // Enter - 复制
      if (e.key === 'Enter' && selection && selection.width > 0 && selection.height > 0) {
        handleCopy();
        return;
      }

      // Delete - 清除标注
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (annotations.length > 0) {
          clearAnnotations();
        }
        return;
      }

      // Ctrl+Z - 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Shift+Z - 重做
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }

      // 工具快捷键（仅在选区存在时生效）
      if (selection && selection.width > 0 && selection.height > 0) {
        switch (e.key.toLowerCase()) {
          case 'r':
            setTool(currentType === 'rect' ? null : 'rect');
            break;
          case 'o':
            setTool(currentType === 'ellipse' ? null : 'ellipse');
            break;
          case 'a':
            setTool(currentType === 'arrow' ? null : 'arrow');
            break;
          case 't':
            setTool(currentType === 'text' ? null : 'text');
            break;
          case 'b':
            setTool(currentType === 'brush' ? null : 'brush');
            break;
          case 'm':
            setTool(currentType === 'mosaic' ? null : 'mosaic');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCancel, handleCopy, selection, currentType, annotations.length, clearAnnotations, undo, redo, setTool]);

  if (!imageData) {
    return null;
  }

  return (
    <div className="screenshot2-overlay">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseEnter={handleMouseEnter}
        onDoubleClick={handleDoubleClick}
      />
      {selection && (
        <Toolbar
          selection={selection}
          canvasWidth={canvasSize.width}
          canvasHeight={canvasSize.height}
          scaleFactor={scaleFactor}
          currentTool={currentType}
          currentColor={currentColor}
          strokeWidth={strokeWidth}
          fontSize={fontSize}
          canUndo={canUndo}
          canRedo={canRedo}
          onToolChange={setTool}
          onColorChange={setColor}
          onStrokeWidthChange={setStrokeWidth}
          onFontSizeChange={setFontSize}
          onUndo={undo}
          onRedo={redo}
          onClear={clearAnnotations}
          onCopy={handleCopy}
          onSave={handleSave}
          onPin={handlePin}
          onCancel={handleCancel}
        />
      )}
      {/* 文字输入框 */}
      {textInput.visible && (
        <input
          ref={textInputRef}
          type="text"
          className="screenshot2-text-input"
          style={{
            position: 'absolute',
            left: textInput.x,
            top: textInput.y,
            transform: 'translateY(-50%)',
            background: 'rgba(0, 0, 0, 0.85)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: currentColor,
            fontSize: `${fontSize}px`,
            padding: '2px 6px',
            borderRadius: '3px',
            outline: 'none',
            minWidth: '60px',
            maxWidth: '300px',
            height: 'auto',
            lineHeight: '1.2',
            zIndex: 10001,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
          value={textInput.value}
          onChange={(e) => setTextInput(prev => ({ ...prev, value: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && textInput.value.trim()) {
              // 创建文字标注
              addTextAnnotation(
                textInput.x * scaleFactor,
                textInput.y * scaleFactor,
                textInput.value.trim()
              );
              setTextInput({ visible: false, x: 0, y: 0, value: '' });
            } else if (e.key === 'Escape') {
              setTextInput({ visible: false, x: 0, y: 0, value: '' });
            }
            e.stopPropagation();
          }}
          onBlur={() => {
            if (textInput.value.trim()) {
              addTextAnnotation(
                textInput.x * scaleFactor,
                textInput.y * scaleFactor,
                textInput.value.trim()
              );
            }
            setTextInput({ visible: false, x: 0, y: 0, value: '' });
          }}
        />
      )}
      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};

export default Screenshot2Overlay;
