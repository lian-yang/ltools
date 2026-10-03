import { useCallback, useEffect, useRef, useState, PointerEvent } from 'react';
import ReactCrop, { Crop, PixelCrop, PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { ImageFile, PreviewResult } from './types';
import { Icon } from '../Icon';
import { EmptyState, Spinner } from '../ui';
import { DragAction, DragState, initialDragState, reduceDragState } from './compareSlider';

interface PreviewAreaProps {
  files: ImageFile[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  previewData: PreviewResult | null;
  originalPreviewData?: PreviewResult | null;
  isProcessing: boolean;
  compareMode?: boolean;
  cropMode?: boolean;
  aspectRatio?: string;
  crop?: Crop;
  onCropChange?: (crop: Crop) => void;
  // 当用户完成裁剪操作时调用（双击或拖拽完成）
  // 传递裁剪后的图片预览结果
  onCropComplete?: (result: PreviewResult) => void;
}

// 裁剪相关常量
const MIN_CROP_SIZE = 10; // 最小裁剪区域（像素）
const ZOOM_MIN = 0.5;  // 最小缩放比例
const ZOOM_MAX = 3;    // 最大缩放比例
const ZOOM_STEP = 0.1; // 缩放步长

export function PreviewArea({
  files,
  selectedIndex,
  onSelect,
  previewData,
  originalPreviewData = null,
  isProcessing,
  compareMode = false,
  cropMode = false,
  aspectRatio,
  crop,
  onCropChange,
  onCropComplete,
}: PreviewAreaProps): JSX.Element {
  const [dragState, setDragState] = useState<DragState>(initialDragState);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, mouseX: 0, mouseY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const sliderPosition = dragState.position;

  // 计算滑动条相对于容器的实际像素位置
  const [sliderPixelPosition, setSliderPixelPosition] = useState(0);

  // 当滑动条位置或图片尺寸改变时，更新像素位置
  useEffect(() => {
    if (!compareMode || !imgRef.current || !containerRef.current) return;

    const imgRect = imgRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    // 计算图片在容器中的起始位置和宽度
    const imgLeft = imgRect.left - containerRect.left;
    const imgWidth = imgRect.width;

    // 根据百分比计算滑动条的像素位置
    const pixelPos = imgLeft + (sliderPosition / 100) * imgWidth;
    setSliderPixelPosition(pixelPos);
  }, [sliderPosition, compareMode, previewData, originalPreviewData]);

  // 计算原图裁剪的右边距（用于左原图、右新图的布局）
  const [originalImageRightClip, setOriginalImageRightClip] = useState(0);

  useEffect(() => {
    if (!compareMode || !imgRef.current || !containerRef.current) return;

    const imgRect = imgRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    // 图片在容器中的起始位置和宽度
    const imgLeft = imgRect.left - containerRect.left;
    const imgWidth = imgRect.width;

    // 计算原图的右裁剪距离：容器宽度 - (图片起始位置 + 滑动条在图片中的位置)
    const rightClip = containerRect.width - (imgLeft + (sliderPosition / 100) * imgWidth);
    setOriginalImageRightClip(rightClip);
  }, [sliderPosition, compareMode, previewData, originalPreviewData]);

  // 解析 aspect ratio 字符串为数字
  const parseAspectRatio = (ratio: string | undefined): number | undefined => {
    if (!ratio) return undefined;
    const parts = ratio.split(':');
    if (parts.length === 2) {
      const w = parseFloat(parts[0]);
      const h = parseFloat(parts[1]);
      if (w > 0 && h > 0) {
        return w / h;
      }
    }
    return undefined;
  };

  // 处理裁剪完成 - 在前端使用 Canvas 裁剪图片
  // ReactCrop 的 onComplete 传递两个参数：(pixelCrop: PixelCrop, percentCrop: PercentCrop)
  const handleCropComplete = useCallback((pixelCrop: PixelCrop, percentCrop: PercentCrop) => {
    if (!imgRef.current || !previewData) return;

    // 检查是否有有效的裁剪区域（宽高都大于 10 像素才算有效操作）
    if (pixelCrop.width < MIN_CROP_SIZE || pixelCrop.height < MIN_CROP_SIZE) {
      console.log('[Crop] Crop area too small, ignoring:', pixelCrop);
      return;
    }

    const renderedWidth = imgRef.current.offsetWidth;
    const renderedHeight = imgRef.current.offsetHeight;

    // 计算缩放比例（渲染尺寸 -> 原始尺寸）
    const scaleX = previewData.width / renderedWidth;
    const scaleY = previewData.height / renderedHeight;

    // 使用像素裁剪数据转换为原始图片坐标
    const cropX = Math.round(pixelCrop.x * scaleX);
    const cropY = Math.round(pixelCrop.y * scaleY);
    const cropWidth = Math.round(pixelCrop.width * scaleX);
    const cropHeight = Math.round(pixelCrop.height * scaleY);

    // 开发环境调试信息
    if (import.meta.env.DEV) {
      console.log('[Crop Debug]', {
        rendered: { width: renderedWidth, height: renderedHeight },
        original: { width: previewData.width, height: previewData.height },
        scale: { x: scaleX, y: scaleY },
        pixelCrop,
        percentCrop,
        converted: { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
      });
    }

    if (cropWidth <= 0 || cropHeight <= 0) {
      console.error('Invalid crop dimensions:', { cropWidth, cropHeight });
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error('Failed to get canvas context');
      return;
    }

    const img = new Image();

    // 添加错误处理
    img.onerror = () => {
      console.error('Failed to load image for cropping');
    };

    img.onload = () => {
      try {
        ctx.drawImage(
          img,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          cropWidth,
          cropHeight
        );

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              console.error('Failed to create blob');
              return;
            }

            const reader = new FileReader();
            reader.onload = () => {
              const croppedPreview: PreviewResult = {
                dataURL: reader.result as string,
                width: cropWidth,
                height: cropHeight,
              };

              if (onCropComplete) {
                onCropComplete(croppedPreview);
              }
            };
            reader.onerror = () => {
              console.error('Failed to read blob');
            };
            reader.readAsDataURL(blob);
          },
          'image/png',
          1.0
        );
      } catch (err) {
        console.error('Failed to process cropped image:', err);
      }
    };

    img.src = previewData.dataURL;
  }, [previewData, onCropComplete]);

  // 鼠标滚轮缩放（通过原生非 passive 监听挂载，见下方 useEffect）
  const handleWheelZoom = useCallback((deltaY: number) => {
    const delta = deltaY > 0 ? 1 - ZOOM_STEP : 1 + ZOOM_STEP;
    setZoom((prevZoom) => Math.min(Math.max(prevZoom * delta, ZOOM_MIN), ZOOM_MAX));
  }, []);

  // 挂载原生 wheel 监听(passive: false),使 preventDefault 生效,
  // 避免缩放时页面跟随滚动与控制台报错
  useEffect(() => {
    if (!cropMode || compareMode) return;
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      handleWheelZoom(e.deltaY);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, [cropMode, compareMode, handleWheelZoom]);

  // 双击完成裁剪
  const handleDoubleClick = useCallback(() => {
    if (!cropMode || compareMode || !crop || !previewData) return;

    // 根据 crop 单位计算 pixelCrop 和 percentCrop
    let pixelCrop: PixelCrop;
    let percentCrop: PercentCrop;

    if (crop.unit === '%') {
      if (!imgRef.current) return;
      const renderedWidth = imgRef.current.offsetWidth;
      const renderedHeight = imgRef.current.offsetHeight;

      percentCrop = crop as PercentCrop;
      pixelCrop = {
        x: (crop.x / 100) * renderedWidth,
        y: (crop.y / 100) * renderedHeight,
        width: (crop.width / 100) * renderedWidth,
        height: (crop.height / 100) * renderedHeight,
        unit: 'px',
      };
    } else {
      if (!imgRef.current) return;
      const renderedWidth = imgRef.current.offsetWidth;
      const renderedHeight = imgRef.current.offsetHeight;

      pixelCrop = crop as PixelCrop;
      percentCrop = {
        x: (crop.x / renderedWidth) * 100,
        y: (crop.y / renderedHeight) * 100,
        width: (crop.width / renderedWidth) * 100,
        height: (crop.height / renderedHeight) * 100,
        unit: '%',
      };
    }

    handleCropComplete(pixelCrop, percentCrop);
    console.log('[Crop] Double-click to confirm crop');
  }, [cropMode, compareMode, crop, previewData, handleCropComplete]);

  // 重置缩放
  useEffect(() => {
    if (!cropMode) {
      setZoom(1);
      setSpacePressed(false);
      setIsPanning(false);
    }
  }, [cropMode]);

  // 监听空格键
  useEffect(() => {
    if (!cropMode || compareMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [cropMode, compareMode]);

  // 对比模式的拖拽处理
  const updateDragState = useCallback((action: DragAction) => {
    setDragState(prev => reduceDragState(prev, action));
  }, []);

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!compareMode || !imgRef.current) return;
    e.preventDefault();
    const rect = imgRef.current.getBoundingClientRect();
    updateDragState({
      type: 'pointerDown',
      clientX: e.clientX,
      rectLeft: rect.left,
      rectWidth: rect.width,
    });
    if (e.currentTarget.setPointerCapture) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }, [compareMode, updateDragState]);

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!compareMode || !dragState.isDragging || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    updateDragState({
      type: 'pointerMove',
      clientX: e.clientX,
      rectLeft: rect.left,
      rectWidth: rect.width,
    });
  }, [compareMode, dragState.isDragging, updateDragState]);

  const handlePointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!compareMode) return;
    updateDragState({ type: 'pointerUp' });
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, [compareMode, updateDragState]);

  useEffect(() => {
    if (!compareMode && dragState.isDragging) {
      setDragState(prev => ({ ...prev, isDragging: false }));
    }
  }, [compareMode, dragState.isDragging]);

  // 平移拖拽处理（空格键+鼠标）- 使用 transform
  const handlePanStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!spacePressed || !cropMode || compareMode) return;

    e.preventDefault();
    e.stopPropagation();

    setIsPanning(true);
    setPanStart({
      x: pan.x,
      y: pan.y,
      mouseX: e.clientX,
      mouseY: e.clientY,
    });

    if (e.currentTarget.setPointerCapture) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }, [spacePressed, cropMode, compareMode, pan]);

  const handlePanMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning || !spacePressed) return;

    const deltaX = e.clientX - panStart.mouseX;
    const deltaY = e.clientY - panStart.mouseY;

    setPan({
      x: panStart.x + deltaX,
      y: panStart.y + deltaY,
    });
  }, [isPanning, spacePressed, panStart]);

  const handlePanEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;

    setIsPanning(false);

    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, [isPanning]);

  if (files.length === 0) {
    if (previewData?.dataURL) {
      return (
        <div className="card flex h-full flex-col p-3">
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[9px] border border-hairline-faint bg-surface-1">
            <img
              src={previewData.dataURL}
              alt="Preview"
              className="max-h-full max-w-full object-contain"
            />
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Spinner size={22} />
              </div>
            )}
            <div className="absolute bottom-3 left-3 rounded-[6px] bg-black/60 px-2.5 py-1.5">
              <span className="tnum font-mono text-[11px] text-text-2">
                {previewData.width} × {previewData.height}
              </span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="card flex h-full items-center justify-center p-6">
        <EmptyState
          icon="photo"
          title="暂无图片"
          description="拖拽图片到此处，或点击选择文件按钮开始处理"
        />
      </div>
    );
  }

  return (
    <div className="card flex h-full flex-col p-3">
      {/* 文件列表 */}
      {files.length > 1 && (
        <div className="scrollbar-hide mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {files.map((file, index) => {
            const active = selectedIndex === index;
            return (
              <button
                key={file.path}
                onClick={() => onSelect(index)}
                className={`min-w-[120px] shrink-0 rounded-[6px] border px-3 py-1.5 text-left transition-colors duration-150 ${
                  active
                    ? 'border-accent/40 bg-accent-subtle'
                    : 'border-hairline bg-surface-1 hover:bg-surface-2'
                }`}
              >
                <span className={`block truncate text-[11.5px] ${active ? 'text-accent-text' : 'text-text-2'}`}>
                  {file.name}
                </span>
                <span className="tnum mt-0.5 block font-mono text-[10.5px] text-text-4">
                  {file.width} × {file.height}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 预览区域(画布,凹陷面板) */}
      <div
        ref={containerRef}
        className={`relative min-h-0 flex-1 overflow-hidden rounded-[9px] border border-hairline-faint bg-surface-1 ${
          compareMode
            ? 'group cursor-ew-resize select-none'
            : spacePressed && cropMode
            ? isPanning ? 'cursor-grabbing' : 'cursor-grab'
            : cropMode
            ? 'cursor-crosshair'
            : 'cursor-default'
        }`}
        style={compareMode ? { touchAction: 'none' } : undefined}
        onPointerDown={(e) => {
          handlePointerDown(e);
          handlePanStart(e);
        }}
        onPointerMove={(e) => {
          handlePointerMove(e);
          handlePanMove(e);
        }}
        onPointerUp={(e) => {
          handlePointerUp(e);
          handlePanEnd(e);
        }}
        onPointerCancel={(e) => {
          handlePointerUp(e);
          handlePanEnd(e);
        }}
        onDoubleClick={handleDoubleClick}
      >
        {previewData?.dataURL ? (
          <>
            {/* 裁剪模式 */}
            {cropMode && !compareMode ? (
              <div
                className="absolute inset-0 flex items-center justify-center overflow-hidden"
                style={{
                  position: 'relative',
                }}
              >
                <ReactCrop
                  crop={crop}
                  onChange={(c) => onCropChange?.(c)}
                  aspect={parseAspectRatio(aspectRatio)}
                >
                  <img
                    ref={imgRef}
                    src={previewData.dataURL}
                    alt="Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transformOrigin: 'center center',
                      transition: isPanning ? 'none' : 'transform 120ms var(--ease-out)',
                    }}
                  />
                </ReactCrop>
              </div>
            ) : (
              <>
                {/* 处理后图片 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <img
                    ref={imgRef}
                    src={previewData.dataURL}
                    alt="Preview"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                {/* 对比模式下的原始图片（左侧显示） */}
                {compareMode && files[selectedIndex] && originalPreviewData?.dataURL && (
                  <div
                    className="absolute inset-0 flex items-center justify-center overflow-hidden"
                    style={{
                      clipPath: `inset(0 ${originalImageRightClip}px 0 0)`,
                      WebkitClipPath: `inset(0 ${originalImageRightClip}px 0 0)`,
                    }}
                  >
                    <img
                      src={originalPreviewData.dataURL}
                      alt="Original"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}

                {compareMode && files[selectedIndex] && !originalPreviewData?.dataURL && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="flex flex-col items-center gap-2 text-[12px] text-text-2">
                      <Spinner size={18} />
                      正在加载原图...
                    </div>
                  </div>
                )}

                {/* 对比滑块 */}
                {compareMode && (
                  <div
                    className="absolute bottom-0 top-0 w-0.5 bg-text-1/80 transition-colors duration-150 group-hover:bg-text-1"
                    style={{ left: `${sliderPixelPosition}px` }}
                  >
                    <div
                      className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-hairline-strong bg-text-1 transition-transform duration-150 ${
                        dragState.isDragging ? 'h-9 w-9 scale-105' : 'h-8 w-8 group-hover:h-9 group-hover:w-9'
                      }`}
                    >
                      <Icon name="chevron-left" size={13} className="text-surface-0" />
                      <Icon name="chevron-right" size={13} className="text-surface-0" />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 加载中 */}
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Spinner size={22} />
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {isProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <Spinner size={22} />
                <span className="text-[12px] text-text-3">处理中...</span>
              </div>
            ) : (
              <span className="text-[12px] text-text-3">点击处理查看预览</span>
            )}
          </div>
        )}

        {/* 图片信息 */}
        {files[selectedIndex] && (
          <div className="absolute bottom-3 left-3 rounded-[6px] bg-black/60 px-2.5 py-1.5">
            <span className="tnum font-mono text-[11px] text-text-2">
              {files[selectedIndex].width} × {files[selectedIndex].height} · {files[selectedIndex].format.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* 当前选中的文件名 */}
      {files.length > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-[6px] bg-surface-1 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Icon name="document" size={14} className="shrink-0 text-text-4" />
            <span className="truncate text-[12px] text-text-2">
              {files[selectedIndex]?.name || '未选择'}
            </span>
          </div>
          <span className="tnum shrink-0 text-[11px] text-text-4">
            {selectedIndex + 1} / {files.length}
          </span>
        </div>
      )}
    </div>
  );
}
