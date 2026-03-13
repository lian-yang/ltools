import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialogs, Events } from '@wailsio/runtime';
import { ImageProcessorService } from '../../bindings/ltools/plugins/imageprocessor';
import {
  ProcessingMode,
  ImageFile,
  CompressOptions,
  CropOptions,
  WatermarkOptions,
  WatermarkPosition,
  SteganographyOptions,
  FaviconOptions,
  BatchProgress,
  PreviewResult,
  ProcessingRequest,
} from '../../bindings/ltools/plugins/imageprocessor/models';
import type { Crop } from 'react-image-crop';
import { FunctionPanel } from './imageprocessor/FunctionPanel';
import { PreviewArea } from './imageprocessor/PreviewArea';
import { SettingsPanel } from './imageprocessor/SettingsPanel';
import { BatchProgress as BatchProgressDialog } from './imageprocessor/BatchProgress';
import { FaviconResultDialog } from './imageprocessor/FaviconResultDialog';
import { Icon } from './Icon';
import { useToast } from '../hooks/useToast';
import {
  applyWatermark,
  hasValidWatermarkContent,
} from './imageprocessor/watermarkPreview';

export function ImageProcessorWidget(): JSX.Element {
  const [files, setFiles] = useState<ImageFile[]>([]);
  const [currentMode, setCurrentMode] = useState<ProcessingMode>(ProcessingMode.ModeCompress);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [originalPreviews, setOriginalPreviews] = useState<Record<string, PreviewResult>>({});
  const [compareMode, setCompareMode] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [showFaviconResult, setShowFaviconResult] = useState(false);
  // 裁剪前的原始预览（用于撤销）
  const [preCropPreview, setPreCropPreview] = useState<PreviewResult | null>(null);
  // 是否处于已裁剪状态（用于显示撤销按钮）
  const [isCropped, setIsCropped] = useState(false);

  // 水印预览防抖 timer
  const watermarkPreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 撤销操作标志（避免撤销后立即显示成功提示）
  const isUndoingRef = useRef(false);

  // 加载文件标志（避免选择文件后立即显示裁剪完成提示）
  const isLoadingFileRef = useRef(false);

  // 处理中标志（用于水印预览防抖，避免 isProcessing 状态变化触发 effect）
  const isProcessingRef = useRef(false);

  // 处理选项
  const [compressOptions, setCompressOptions] = useState<CompressOptions>({
    quality: 80,
    maxWidth: 0,
    maxHeight: 0,
    outputFormat: '',
  });

  const [cropOptions, setCropOptions] = useState<CropOptions>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    aspectRatio: '',
  });

  const [watermarkOptions, setWatermarkOptions] = useState<WatermarkOptions>({
    type: 'text',
    text: '',
    fontPath: '',
    fontFamily: '',  // 添加字体族名
    fontSize: 36,
    fontColor: '#FFFFFF',
    imagePath: '',
    position: WatermarkPosition.PositionSingle,
    offsetX: 0,
    offsetY: 0,
    rotation: 0, // 默认不旋转
    opacity: 0.5,
    margin: 50,
    scale: 0.5,
    tileSpacingX: 150,
    tileSpacingY: 100,
  });


  // 水印选项版本号 - 用于触发预览更新，避免直接依赖 watermarkOptions 对象
  const [watermarkVersion, setWatermarkVersion] = useState(0);

  // 当水印选项变化时，更新版本号（触发预览 effect）
  // 注意：文件切换通过 prevFilePathRef 在预览 effect 中直接处理，不需要版本号
  useEffect(() => {
    // 只在水印模式下更新版本号
    if (currentMode === ProcessingMode.ModeWatermark) {
      console.log('[Watermark Version] Options changed:', {
        text: watermarkOptions.text?.substring(0, 20),
        imagePath: watermarkOptions.imagePath,
        fontPath: watermarkOptions.fontPath,
      });
      setWatermarkVersion(v => v + 1);
    }
  }, [
    watermarkOptions.type,
    watermarkOptions.text,
    watermarkOptions.imagePath,
    watermarkOptions.fontPath,  // 添加字体路径
    watermarkOptions.fontFamily,  // 添加字体族名
    watermarkOptions.fontSize,
    watermarkOptions.fontColor,
    watermarkOptions.opacity,
    watermarkOptions.position,
    watermarkOptions.offsetX,
    watermarkOptions.offsetY,
    watermarkOptions.rotation,
    watermarkOptions.scale,
    watermarkOptions.tileSpacingX,
    watermarkOptions.tileSpacingY,
    // 移除 selectedIndex - 文件切换通过 prevFilePathRef 处理
    currentMode,
  ]);

  const [steganographyOptions, setSteganographyOptions] = useState<SteganographyOptions>({
    message: '',
    mode: 'encode',
    type: 'text',
    imagePath: '',
    password1: 12345,  // Default password1 - must match backend default
    password2: 67890,  // Default password2 - must match backend default
  });

  const [faviconOptions, setFaviconOptions] = useState<FaviconOptions>({
    sizes: [16, 32, 48, 128],
    outputICO: false,
    outputPNG: true,
    prefix: 'favicon',
    background: '',
  });

  const { success, error: showError } = useToast();

  // 当前端裁剪完成时，更新预览数据
  const handleCropComplete = useCallback((croppedPreview: PreviewResult) => {
    if (!croppedPreview || !croppedPreview.dataURL) return;

    // 如果是撤销操作触发的，跳过提示
    if (isUndoingRef.current) {
      return;
    }

    // 如果是加载文件后初始化裁剪框触发的，跳过提示
    if (isLoadingFileRef.current) {
      return;
    }

    // 保存裁剪前的预览数据（用于撤销）
    if (previewData && !isCropped) {
      setPreCropPreview(previewData);
    }

    // 更新预览数据为裁剪后的图片
    setPreviewData(croppedPreview);
    setIsCropped(true);
    success('裁剪完成，点击"处理"按钮保存，或点击"撤销"重新选择');
  }, [previewData, isCropped, success]);

  // 撤销裁剪操作
  const handleUndoCrop = useCallback(() => {
    if (!preCropPreview) return;

    // 设置撤销标志，避免触发裁剪完成的提示
    isUndoingRef.current = true;

    // 恢复到裁剪前的预览
    setPreviewData(preCropPreview);
    setPreCropPreview(null);
    setIsCropped(false);
    // 重置裁剪框，让 useEffect 来初始化新的裁剪框
    setCrop(undefined);

    // 在下一个事件循环中重置撤销标志
    // 确保所有状态更新都已完成
    setTimeout(() => {
      isUndoingRef.current = false;
    }, 0);
  }, [preCropPreview]);

  // 当 aspect ratio 改变时，调整裁剪框以匹配新比例
  useEffect(() => {
    if (currentMode !== ProcessingMode.ModeCrop || !previewData || !crop) return;

    // 解析新的 aspect ratio
    const parseAspectRatio = (ratio: string): number | undefined => {
      if (!ratio) return undefined;
      const parts = ratio.split(':');
      if (parts.length === 2) {
        const w = parseFloat(parts[0]);
        const h = parseFloat(parts[1]);
        if (w > 0 && h > 0) return w / h;
      }
      return undefined;
    };

    // 获取当前选择的 aspectRatio（从 DOM 或其他方式）
    // 由于我们在依赖数组中不包含 cropOptions.aspectRatio，需要通过 ref 或其他方式获取
    // 这里简化处理：直接读取 cropOptions.aspectRatio
    const aspect = parseAspectRatio(cropOptions.aspectRatio);
    if (!aspect) {
      // 自由模式，不调整
      return;
    }

    // 计算新的裁剪框：保持居中，调整宽高比
    const imgAspect = previewData.width / previewData.height;

    let newWidth: number;
    let newHeight: number;

    if (imgAspect > aspect) {
      // 图片比目标比例更宽，以高度为准
      newHeight = 100;
      newWidth = (aspect / imgAspect) * 100;
    } else {
      // 图片比目标比例更高，以宽度为准
      newWidth = 100;
      newHeight = (imgAspect / aspect) * 100;
    }

    // 创建居中的新裁剪框
    const newCrop: Crop = {
      unit: '%',
      x: (100 - newWidth) / 2,
      y: (100 - newHeight) / 2,
      width: newWidth,
      height: newHeight,
    };

    setCrop(newCrop);

    // 更新 cropOptions
    setCropOptions(prev => ({
      ...prev,
      x: Math.round((newCrop.x / 100) * previewData.width),
      y: Math.round((newCrop.y / 100) * previewData.height),
      width: Math.round((newCrop.width / 100) * previewData.width),
      height: Math.round((newCrop.height / 100) * previewData.height),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropOptions.aspectRatio, currentMode, previewData]);

  // 当切换到裁剪模式且有预览时，自动初始化全图裁剪框
  useEffect(() => {
    if (currentMode === ProcessingMode.ModeCrop && previewData && !crop) {
      // 解析 aspect ratio
      const parseAspectRatio = (ratio: string | undefined): number | undefined => {
        if (!ratio) return undefined;
        const parts = ratio.split(':');
        if (parts.length === 2) {
          const w = parseFloat(parts[0]);
          const h = parseFloat(parts[1]);
          if (w > 0 && h > 0) return w / h;
        }
        return undefined;
      };

      const aspect = parseAspectRatio(cropOptions.aspectRatio);
      const imgAspect = previewData.width / previewData.height;

      let cropWidth: number;
      let cropHeight: number;

      if (!aspect) {
        // 自由模式，全图裁剪
        cropWidth = 100;
        cropHeight = 100;
      } else if (imgAspect > aspect) {
        // 图片比目标比例更宽，以高度为准
        cropHeight = 100;
        cropWidth = (aspect / imgAspect) * 100;
      } else {
        // 图片比目标比例更高，以宽度为准
        cropWidth = 100;
        cropHeight = (imgAspect / aspect) * 100;
      }

      // 初始化一个居中的裁剪框
      const initialCrop: Crop = {
        unit: '%',
        x: (100 - cropWidth) / 2,
        y: (100 - cropHeight) / 2,
        width: cropWidth,
        height: cropHeight,
      };

      setCrop(initialCrop);
      // 更新 cropOptions
      setCropOptions(prev => ({
        ...prev,
        x: Math.round((initialCrop.x / 100) * previewData.width),
        y: Math.round((initialCrop.y / 100) * previewData.height),
        width: Math.round((initialCrop.width / 100) * previewData.width),
        height: Math.round((initialCrop.height / 100) * previewData.height),
      }));

      // 在下一个事件循环中重置加载文件标志
      setTimeout(() => {
        isLoadingFileRef.current = false;
      }, 100);
    }
  }, [currentMode, previewData, crop]);

  // 当切换模式时，自动关闭对比功能（如果不是压缩模式）
  useEffect(() => {
    if (currentMode !== ProcessingMode.ModeCompress && compareMode) {
      setCompareMode(false);
    }
  }, [currentMode, compareMode]);

  // 当切换到裁剪模式或选择文件时，自动生成预览（使用原图）
  useEffect(() => {
    if (currentMode === ProcessingMode.ModeCrop && files.length > 0) {
      // 获取当前文件的原图预览
      const currentFile = files[selectedIndex];
      if (currentFile) {
        const originalPreview = originalPreviews[currentFile.path];
        if (originalPreview) {
          // 设置预览为原图
          setPreviewData(originalPreview);
          // 重置裁剪框，让 useEffect 初始化新的裁剪框
          setCrop(undefined);
        } else if (!previewData) {
          // 如果原图预览还没加载，调用 handlePreview
          handlePreview();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMode, files, selectedIndex, originalPreviews]);

  // 计算当前文件的原图预览是否已加载（用于触发水印预览 effect）
  const currentOriginalPreviewLoaded = files[selectedIndex]?.path && originalPreviews[files[selectedIndex].path]
    ? 'loaded'
    : 'not-loaded';

  // 水印模式自动预览 - 当水印参数变化时自动更新预览
  // 使用 ref 跟踪上一次的水印选项，避免不必要的重新渲染
  const prevWatermarkOptionsRef = useRef<string>('');
  const prevFilePathRef = useRef<string>('');  // 改用文件路径而不是 dataURL 前缀
  const prevModeRef = useRef<ProcessingMode>(currentMode);  // 跟踪上一次的模式

  useEffect(() => {
    // 只在 watermark 模式下触发
    if (currentMode !== ProcessingMode.ModeWatermark) return;
    // 需要有文件
    if (files.length === 0 || selectedIndex >= files.length) return;
    // 需要有有效的水印内容
    if (!hasValidWatermarkContent(watermarkOptions)) return;

    const currentFile = files[selectedIndex];
    if (!currentFile) return;

    const currentOriginal = originalPreviews[currentFile.path];
    const dataURL = currentOriginal?.dataURL;

    // 检测文件是否变化（用于日志和跳过判断）
    const fileChanged = prevFilePathRef.current !== currentFile.path;
    const modeChanged = prevModeRef.current !== currentMode;

    console.log('[Watermark Preview] Effect triggered', {
      file: currentFile.name,
      path: currentFile.path,
      hasData: !!dataURL,
      dataLength: dataURL?.length || 0,
      watermarkVersion,
      currentOriginalPreviewLoaded,
      fileChanged,
      modeChanged,
      prevFile: prevFilePathRef.current,
    });

    // 检查 dataURL 是否有效（非空字符串）
    if (!dataURL || dataURL.length === 0) {
      console.log('[Watermark Preview] No dataURL, waiting for original preview');
      // 即使没有 dataURL，也更新模式 ref，避免模式切换后误判
      prevModeRef.current = currentMode;
      return;
    }

    // 序列化当前选项用于比较
    const currentOptionsStr = JSON.stringify({
      type: watermarkOptions.type,
      text: watermarkOptions.text,
      imagePath: watermarkOptions.imagePath,
      fontPath: watermarkOptions.fontPath,  // 添加字体路径
      fontFamily: watermarkOptions.fontFamily,  // 添加字体族名
      fontSize: watermarkOptions.fontSize,
      fontColor: watermarkOptions.fontColor,
      opacity: watermarkOptions.opacity,
      position: watermarkOptions.position,
      offsetX: watermarkOptions.offsetX,
      offsetY: watermarkOptions.offsetY,
      rotation: watermarkOptions.rotation,
      scale: watermarkOptions.scale,
      tileSpacingX: watermarkOptions.tileSpacingX,
      tileSpacingY: watermarkOptions.tileSpacingY,
    });

    // 使用文件路径和模式变化来检测是否需要重新预览
    // 模式变化或文件变化时，跳过选项比较，直接触发预览
    const optionsChanged = prevWatermarkOptionsRef.current !== currentOptionsStr;

    if (!modeChanged && !fileChanged && !optionsChanged) {
      console.log('[Watermark Preview] Nothing changed, skipping');
      return;
    }

    // 更新 ref
    prevWatermarkOptionsRef.current = currentOptionsStr;
    prevFilePathRef.current = currentFile.path;
    prevModeRef.current = currentMode;

    console.log('[Watermark Preview] Triggering preview', {
      modeChanged,
      fileChanged,
      optionsChanged,
    });

    // 清除之前的定时器
    if (watermarkPreviewTimer.current) {
      clearTimeout(watermarkPreviewTimer.current);
    }

    // 防抖 500ms（增加防抖时间）
    watermarkPreviewTimer.current = setTimeout(async () => {
      // 使用 ref 检查处理状态，避免 isProcessing 状态变化触发 effect 重新运行
      if (isProcessingRef.current) {
        console.log('[Watermark Preview] Already processing, skip');
        return;
      }

      console.log('[Watermark Preview] Starting watermark application');
      isProcessingRef.current = true;
      setIsProcessing(true);
      try {
        const result = await applyWatermark(dataURL, watermarkOptions);
        console.log('[Watermark Preview] Watermark applied successfully');
        setPreviewData({
          dataURL: result,
          width: currentOriginal.width,
          height: currentOriginal.height,
        });
      } catch (err) {
        console.error('[Watermark Preview] Failed:', err);
      } finally {
        setIsProcessing(false);
        isProcessingRef.current = false;
      }
    }, 500);

    return () => {
      if (watermarkPreviewTimer.current) {
        clearTimeout(watermarkPreviewTimer.current);
      }
    };
    // 使用 watermarkVersion 代替 watermarkOptions，避免对象引用变化导致无限循环
    // 使用 currentOriginalPreviewLoaded 在原图预览加载后触发水印预览
    // 内部使用 ref 比较进一步防止重复处理
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentMode,
    files,
    selectedIndex,
    watermarkVersion,
    currentOriginalPreviewLoaded,  // 原图预览加载状态变化时触发
  ]);

  // 监听进度事件和文件拖放事件
  useEffect(() => {
    const unsubscribeProgress = Events.On('imageprocessor:progress', (ev) => {
      if (ev.data) {
        setProgress(ev.data);
      }
    });

    const unsubscribeComplete = Events.On('imageprocessor:complete', (ev) => {
      if (ev.data) {
        setProgress(ev.data);
        setIsProcessing(false);
        const successCount = ev.data.completed;
        const failCount = ev.data.failed;
        if (failCount > 0) {
          showError(`处理完成: ${successCount} 成功, ${failCount} 失败`);
        } else {
          success(`成功处理 ${successCount} 个文件`);
          // 如果是 favicon 模式，显示结果对话框
          if (currentMode === ProcessingMode.ModeFavicon) {
            setShowFaviconResult(true);
          }
        }
      }
    });

    // 监听文件拖放事件
    const unsubscribeFileDrop = Events.On('imageprocessor:files-dropped', (ev) => {
      if (ev.data && ev.data.files && Array.isArray(ev.data.files)) {
        const files = ev.data.files as string[];
        if (files.length > 0) {
          addFiles(files);
        }
      }
    });

    return () => {
      unsubscribeProgress?.();
      unsubscribeComplete?.();
      unsubscribeFileDrop?.();
    };
  }, []);

  const addFiles = useCallback(async (filePaths: string[]) => {
    try {
      // 设置加载文件标志（避免触发裁剪完成的提示）
      isLoadingFileRef.current = true;

      const fileInfos = await ImageProcessorService.GetMultipleImageInfo(filePaths);

      // 在裁剪模式下，清空旧文件，只保留新选择的文件
      if (currentMode === ProcessingMode.ModeCrop) {
        setFiles(fileInfos);
        setSelectedIndex(0);
        // 清空预览状态
        setPreviewData(null);
        setOriginalPreviews({});
        setCrop(undefined);
        setIsCropped(false);
        setPreCropPreview(null);

        // 立即加载新文件的预览（不等待 useEffect）
        if (fileInfos.length > 0) {
          try {
            const options = JSON.stringify({
              quality: 100,
              maxWidth: 0,
              maxHeight: 0,
              outputFormat: '',
            });
            const result = await ImageProcessorService.PreviewImage(
              fileInfos[0].path,
              ProcessingMode.ModeCompress,
              options
            );
            if (result) {
              setPreviewData(result);
              setOriginalPreviews({ [fileInfos[0].path]: result });
            }
          } catch (err) {
            console.error('Failed to load preview:', err);
            showError('加载预览失败');
          } finally {
            // 在下一个事件循环中重置加载文件标志
            setTimeout(() => {
              isLoadingFileRef.current = false;
            }, 100);
          }
        }
      } else {
        // 其他模式：追加文件（保持原有逻辑）
        setFiles(prev => {
          const existingPaths = new Set(prev.map(f => f.path));
          const newFiles = fileInfos.filter(f => !existingPaths.has(f.path));
          return [...prev, ...newFiles];
        });
        if (fileInfos.length > 0) {
          setSelectedIndex(0);
        }
        // 重置加载文件标志
        setTimeout(() => {
          isLoadingFileRef.current = false;
        }, 100);
      }
    } catch (err) {
      console.error('Failed to get file info:', err);
      showError('获取图片信息失败');
      isLoadingFileRef.current = false;
    }
  }, [showError, currentMode]);

  // 切换图片时重新生成预览（仅当已经有过预览时，或者在对比模式下）
  useEffect(() => {
    if (files.length === 0 || selectedIndex < 0 || selectedIndex >= files.length || isProcessing) return;

    // 在裁剪模式下，切换图片时需要重置为原图并重置裁剪框
    if (currentMode === ProcessingMode.ModeCrop) {
      const currentFile = files[selectedIndex];
      if (currentFile) {
        const originalPreview = originalPreviews[currentFile.path];
        if (originalPreview) {
          // 设置预览为原图
          setPreviewData(originalPreview);
          // 重置裁剪框，让另一个 useEffect 来初始化新的裁剪框
          setCrop(undefined);
          // 重置裁剪状态（撤销相关）
          setIsCropped(false);
          setPreCropPreview(null);
        } else if (previewData !== null) {
          // 如果原图还没加载，先触发预览
          handlePreview();
        }
      }
      return;
    }

    // 其他模式：只有在已经有预览数据时，切换图片才自动重新生成预览
    // 或者在对比模式下，自动生成预览以便对比
    if (previewData !== null || compareMode) {
      handlePreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, currentMode]);

  const handleFileSelect = useCallback(async () => {
    try {
      // Favicon 模式只允许选择单个文件
      const isFaviconMode = currentMode === ProcessingMode.ModeFavicon;

      const result = await Dialogs.OpenFile({
        Title: isFaviconMode ? '选择 Logo 图片' : '选择图片或文件夹',
        CanChooseFiles: true,
        CanChooseDirectories: !isFaviconMode,
        AllowsMultipleSelection: !isFaviconMode,
        Filters: [
          { DisplayName: '图片文件', Pattern: '*.jpg;*.jpeg;*.png;*.gif;*.bmp;*.tif;*.tiff;*.webp;*.ico' },
          { DisplayName: '所有文件', Pattern: '*.*' },
        ],
      });

      const selectedPaths = Array.isArray(result) ? result : result ? [result] : [];
      if (selectedPaths.length > 0) {
        await addFiles(selectedPaths);
      }
    } catch (err) {
      showError('选择文件失败');
    }
  }, [addFiles, showError, currentMode]);

  const clearFiles = () => {
    setFiles([]);
    setSelectedIndex(0);
    setPreviewData(null);
    setOriginalPreviews({});
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (selectedIndex >= index && selectedIndex > 0) {
      setSelectedIndex(prev => prev - 1);
    }
    const removed = files[index];
    if (removed) {
      setOriginalPreviews(prev => {
        if (!prev[removed.path]) return prev;
        const next = { ...prev };
        delete next[removed.path];
        return next;
      });
    }
  };

  const getCurrentOptions = (): object => {
    switch (currentMode) {
      case 'compress':
        return compressOptions;
      case 'crop':
        return cropOptions;
      case 'watermark':
        return watermarkOptions;
      case 'steganography':
        return steganographyOptions;
      case 'favicon':
        return faviconOptions;
      default:
        return {};
    }
  };

  const handlePreview = async () => {
    if (files.length === 0 || selectedIndex >= files.length) return;

    // 在裁剪模式下，先保存当前预览状态（用于撤销）
    if (currentMode === ProcessingMode.ModeCrop && previewData && !isCropped) {
      setPreCropPreview(previewData);
    }

    setIsProcessing(true);
    try {
      // 在裁剪模式下，如果裁剪参数无效（宽或高为 0），使用压缩模式加载原图
      // 这避免了后端报错"裁剪尺寸无效"
      let mode = currentMode;
      let options = JSON.stringify(getCurrentOptions());

      if (currentMode === ProcessingMode.ModeCrop) {
        const cropOpts = JSON.parse(options);
        if (cropOpts.width === 0 || cropOpts.height === 0) {
          console.log('[Preview] Crop dimensions invalid, loading original image instead');
          mode = ProcessingMode.ModeCompress;
          options = JSON.stringify({
            quality: 100,
            maxWidth: 0,
            maxHeight: 0,
            outputFormat: '',
          });
        }
      }

      const result = await ImageProcessorService.PreviewImage(
        files[selectedIndex].path,
        mode,
        options
      );

      if (!result) {
        return;
      }

      setPreviewData(result);

      // 在裁剪模式下，标记为已裁剪状态（允许撤销）
      if (currentMode === ProcessingMode.ModeCrop) {
        setIsCropped(true);
      }

      // 在裁剪模式下，不应该更新 originalPreviews
      // originalPreviews 应该只保存原始图片，用于撤销和对比
      // 预览按钮只是查看裁剪效果，不应该覆盖原图缓存
    } catch (err) {
      console.error('Preview failed:', err);
      showError('预览生成失败');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcess = async () => {
    if (files.length === 0) return;

    // Favicon 模式：生成 favicon 并保存为 zip
    if (currentMode === ProcessingMode.ModeFavicon) {
      const target = files[selectedIndex];
      if (!target) return;

      setIsProcessing(true);
      try {
        const options = JSON.stringify(faviconOptions);
        const result = await ImageProcessorService.GenerateFavicon(target.path, options);

        if (!result || !result.success) {
          showError(result?.error || '生成 favicon 失败');
          return;
        }

        // 获取 zip 文件路径
        const zipPath = result.files['favicon.zip'];
        if (!zipPath) {
          showError('未找到生成的 zip 文件');
          return;
        }

        // 使用 SaveFile 对话框让用户选择保存位置
        const savePath = await Dialogs.SaveFile({
          Title: '保存 Favicon 套件',
          Filename: 'favicon.zip',
        });

        if (savePath) {
          // 使用后端服务复制文件
          await ImageProcessorService.CopyFile(zipPath, savePath);
          success(`Favicon 套件已保存到: ${savePath}`);

          // 显示 HTML 代码对话框
          setShowFaviconResult(true);
        }
      } catch (err) {
        console.error('Generate favicon failed:', err);
        showError('生成 favicon 失败');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // 裁剪模式：如果前端已经完成裁剪，使用文件对话框保存
    if (currentMode === ProcessingMode.ModeCrop && previewData?.dataURL) {
      try {
        const current = files[selectedIndex];
        const originalName = current?.name || 'image';
        const defaultName = originalName.replace(/\.[^.]+$/, '_cropped.png');

        // 使用 SaveFile 对话框让用户选择保存位置
        const savePath = await Dialogs.SaveFile({
          Title: '保存裁剪后的图片',
          Filename: defaultName,
        });

        if (savePath) {
          // 使用后端服务保存 dataURL
          await ImageProcessorService.SaveDataURL(previewData.dataURL, savePath);
          success(`裁剪后的图片已保存到: ${savePath}`);
        }
        return;
      } catch (err) {
        console.error('Save cropped image failed:', err);
        showError('保存裁剪图片失败');
        return;
      }
    }

    // 水印模式：前端处理，支持批量
    if (currentMode === ProcessingMode.ModeWatermark) {
      // 检查是否有有效的水印内容
      if (!hasValidWatermarkContent(watermarkOptions)) {
        showError('请输入水印文字或选择水印图片');
        return;
      }

      // 检查是否有待处理的文件
      if (files.length === 0) {
        showError('请先选择图片');
        return;
      }

      // 选择输出目录
      const outputDir = await Dialogs.OpenFile({
        Title: '选择输出目录',
        CanChooseDirectories: true,
        CanChooseFiles: false,
      });

      if (!outputDir) {
        return;
      }

      const outputDirPath = Array.isArray(outputDir) ? outputDir[0] : outputDir;

      setIsProcessing(true);
      setShowProgress(true);
      setProgress({
        total: files.length,
        completed: 0,
        failed: 0,
        current: '',
        results: [],
        startTime: Date.now(),
        isRunning: true,
      });

      let completed = 0;
      let failed = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(prev => prev ? { ...prev, current: file.name } : null);

        try {
          // 获取原始预览
          const currentOriginal = originalPreviews[file.path];
          if (!currentOriginal?.dataURL) {
            console.warn(`Original preview not loaded for ${file.name}, skipping`);
            failed++;
            continue;
          }

          // 应用水印
          const resultDataURL = await applyWatermark(currentOriginal.dataURL, watermarkOptions);

          // 生成输出文件名
          const outputName = file.name.replace(/\.[^.]+$/, '_watermarked.png');
          const outputPath = `${outputDirPath}/${outputName}`;

          // 使用后端服务保存 dataURL
          await ImageProcessorService.SaveDataURL(resultDataURL, outputPath);
          completed++;
        } catch (err) {
          console.error(`Failed to process ${file.name}:`, err);
          failed++;
        }

        setProgress(prev => prev ? {
          ...prev,
          completed,
          failed,
        } : null);
      }

      setShowProgress(false);
      setIsProcessing(false);

      if (failed > 0) {
        showError(`处理完成: ${completed} 成功, ${failed} 失败`);
      } else {
        success(`成功处理 ${completed} 个图片，已保存到: ${outputDirPath}`);
      }
      return;
    }

    if (currentMode === ProcessingMode.ModeSteganography && steganographyOptions.mode === 'decode') {
      const target = files[selectedIndex];
      if (!target) return;

      setIsProcessing(true);
      try {
        const optionsJson = JSON.stringify(steganographyOptions);
        const result = await ImageProcessorService.DecodeSteganography(target.path, optionsJson);
        if (!result) {
          showError('解码失败');
          return;
        }
        if (result.success) {
          const message = result.message || '';
          // Update the message in steganographyOptions so it shows in the text input
          setSteganographyOptions(prev => ({ ...prev, message }));
          const preview = message.length > 120 ? `${message.slice(0, 120)}...` : message;
          success(`提取成功: ${preview || '空消息'}`);
        } else {
          showError(result.error || '提取失败');
        }
      } catch (err) {
        console.error('Decode failed:', err);
        showError('提取失败');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    setIsProcessing(true);
    setShowProgress(true);
    setPreviewData(null);

    try {
      const request: ProcessingRequest = {
        files: files.map(f => f.path),
        mode: currentMode,
        compress: currentMode === ProcessingMode.ModeCompress ? compressOptions : undefined,
        crop: currentMode === ProcessingMode.ModeCrop ? cropOptions : undefined,
        // watermark 模式已在前端处理，此处不需要
        steganography: currentMode === ProcessingMode.ModeSteganography ? steganographyOptions : undefined,
      };

      await ImageProcessorService.ProcessBatch(request);
    } catch (err) {
      console.error('Process failed:', err);
      showError('处理失败');
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    try {
      await ImageProcessorService.CancelBatch();
    } catch (err) {
      console.error('Cancel failed:', err);
    }
  };

  const handleProgressClose = () => {
    setShowProgress(false);
    setIsProcessing(false);
  };

  // 当尺寸参数改变时，清空原图预览缓存（需要重新加载）
  useEffect(() => {
    setOriginalPreviews({});
  }, [compressOptions.maxWidth, compressOptions.maxHeight]);

  // 在任何处理模式下,自动加载原始图片预览（用于对比和裁剪）
  // 使用与处理后图片相同的尺寸限制,确保对比效果一致
  useEffect(() => {
    const current = files[selectedIndex];
    if (!current || originalPreviews[current.path]) return;

    let cancelled = false;
    (async () => {
      try {
        // 使用与处理后图片相同的 maxWidth/maxHeight
        const options = JSON.stringify({
          quality: 100,
          maxWidth: compressOptions.maxWidth,
          maxHeight: compressOptions.maxHeight,
          outputFormat: '',
        });
        const result = await ImageProcessorService.PreviewImage(
          current.path,
          ProcessingMode.ModeCompress,
          options
        );
        if (!result || cancelled) return;
        setOriginalPreviews(prev => ({ ...prev, [current.path]: result }));
      } catch (err) {
        console.error('Load original preview failed:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [files, selectedIndex, originalPreviews, compressOptions.maxWidth, compressOptions.maxHeight]);

  // 在水印模式下，预加载所有文件的原图预览（用于批量处理）
  useEffect(() => {
    // 只在水印模式下预加载所有文件
    if (currentMode !== ProcessingMode.ModeWatermark || files.length === 0) return;

    let cancelled = false;

    // 找出需要加载的文件（尚未加载预览的）
    const filesToLoad = files.filter(f => !originalPreviews[f.path]);
    console.log('[Watermark Preload] Files to load:', filesToLoad.length, 'of', files.length);
    if (filesToLoad.length === 0) return;

    // 异步加载所有未加载的原图预览
    (async () => {
      for (const file of filesToLoad) {
        if (cancelled) break;
        try {
          const options = JSON.stringify({
            quality: 100,
            maxWidth: compressOptions.maxWidth,
            maxHeight: compressOptions.maxHeight,
            outputFormat: '',
          });
          const result = await ImageProcessorService.PreviewImage(
            file.path,
            ProcessingMode.ModeCompress,
            options
          );
          if (!result || cancelled) continue;
          setOriginalPreviews(prev => ({ ...prev, [file.path]: result }));
        } catch (err) {
          console.error(`Load original preview failed for ${file.name}:`, err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentMode, files, originalPreviews, compressOptions.maxWidth, compressOptions.maxHeight]);

  return (
    <div className="h-full flex flex-col p-6">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
            <Icon name="photo" className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#FAF5FF]">图片处理</h1>
            <p className="text-sm text-white/50">本地批量图片处理工具</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {files.length > 0 && (
            <>
              {currentMode === ProcessingMode.ModeCompress && (
                <button
                  onClick={() => setCompareMode(!compareMode)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    compareMode
                      ? 'bg-[#7C3AED] text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  <Icon name="folder" className="w-4 h-4" />
                  对比
                </button>
              )}
              {currentMode === ProcessingMode.ModeCrop && isCropped && (
                <button
                  onClick={handleUndoCrop}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-[#F59E0B]/20 text-[#FBBF24] hover:bg-[#F59E0B]/30 transition-colors flex items-center gap-2"
                >
                  <Icon name="undo" className="w-4 h-4" />
                  撤销裁剪
                </button>
              )}
              <button
                onClick={clearFiles}
                className="px-3 py-2 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 transition-colors"
              >
                清空
              </button>
              <span className="px-3 py-1.5 bg-white/10 rounded-lg text-sm text-white/70">
                {files.length} 个文件
              </span>
            </>
          )}
          <button
            onClick={handleFileSelect}
            className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg text-white font-medium transition-colors flex items-center gap-2"
          >
            <Icon name="plus" className="w-4 h-4" />
            选择文件
          </button>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* 左侧功能面板 */}
        <div className="w-56 flex-shrink-0">
          <FunctionPanel
            currentMode={currentMode}
            onModeChange={setCurrentMode}
            disabled={isProcessing}
          />
        </div>

        {/* 中间预览区域 */}
        <div className="flex-1 min-w-0" data-file-drop-target>
          <PreviewArea
            files={files}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            previewData={previewData}
            originalPreviewData={files[selectedIndex] ? originalPreviews[files[selectedIndex].path] : null}
            isProcessing={isProcessing}
            compareMode={compareMode}
            cropMode={currentMode === ProcessingMode.ModeCrop}
            aspectRatio={cropOptions.aspectRatio}
            crop={crop}
            onCropChange={setCrop}
            onCropComplete={handleCropComplete}
          />
        </div>

        {/* 右侧设置面板 */}
        <div className="w-80 flex-shrink-0">
          <SettingsPanel
            mode={currentMode}
            compressOptions={compressOptions}
            cropOptions={cropOptions}
            watermarkOptions={watermarkOptions}
            steganographyOptions={steganographyOptions}
            faviconOptions={faviconOptions}
            onCompressChange={setCompressOptions}
            onCropChange={setCropOptions}
            onWatermarkChange={setWatermarkOptions}
            onSteganographyChange={setSteganographyOptions}
            onFaviconChange={setFaviconOptions}
            onProcess={handleProcess}
            onPreview={handlePreview}
            isProcessing={isProcessing}
            filesCount={files.length}
          />
        </div>
      </div>

      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="mt-4 glass rounded-xl p-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            {files.map((file, index) => (
              <div
                key={file.path}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  selectedIndex === index
                    ? 'bg-[#7C3AED]/30 border border-[#A78BFA]/30'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
                onClick={() => setSelectedIndex(index)}
              >
                <Icon name="photo" className="w-4 h-4 text-white/40" />
                <span className="text-sm text-white/70 truncate max-w-[150px]">{file.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="p-0.5 hover:bg-white/20 rounded transition-colors"
                >
                  <Icon name="x-mark" className="w-3 h-3 text-white/40" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 进度对话框 */}
      <BatchProgressDialog
        progress={progress}
        onCancel={handleCancel}
        onClose={handleProgressClose}
        visible={showProgress}
      />

      {/* Favicon 结果对话框 */}
      <FaviconResultDialog
        visible={showFaviconResult}
        onClose={() => setShowFaviconResult(false)}
      />
    </div>
  );
}
