/**
 * 前端水印预览工具
 * 使用 Canvas 实现水印叠加，支持实时预览
 * 支持：拖拽定位、旋转角度、平铺模式、自定义字体
 */

import type { WatermarkOptions } from '../../../bindings/ltools/plugins/imageprocessor/models';
import { WatermarkPosition } from '../../../bindings/ltools/plugins/imageprocessor/models';
import { LoadImageAsDataURL } from '../../../bindings/ltools/plugins/imageprocessor/imageprocessorservice';

// 缓存已加载的水印图片，避免重复加载
const watermarkImageCache = new Map<string, string>();
// 缓存已加载的字体
const loadedFontFamilies = new Set<string>();
// 默认字体列表
const defaultFonts = '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';

/**
 * 加载字体文件并注册到浏览器
 */
async function loadFont(fontPath: string, fontFamily: string): Promise<boolean> {
  if (loadedFontFamilies.has(fontFamily)) {
    return true;
  }

  try {
    // 通过后端加载字体文件
    const dataURL = await LoadImageAsDataURL(fontPath);
    const font = new FontFace(fontFamily, `url(${dataURL})`);
    await font.load();
    document.fonts.add(font);
    loadedFontFamilies.add(fontFamily);
    return true;
  } catch (err) {
    console.error('[Watermark] Failed to load font:', err);
    return false;
  }
}

/**
 * 从字体路径提取字体名称（仅作为备用）
 */
function extractFontName(fontPath: string): string {
  if (!fontPath) return '';
  const filename = fontPath.split(/[/\\]/).pop() || '';
  // 移除扩展名
  const name = filename.replace(/\.(ttf|otf|ttc)$/i, '');
  // 将文件名转换为可用的字体名称（替换连字符和下划线为空格）
  return name.replace(/[-_]/g, ' ');
}

// 保留 extractFontName 用于备用场景
void extractFontName;

/**
 * 加载图片
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * 绘制单个水印
 */
function drawSingleWatermark(
  ctx: CanvasRenderingContext2D,
  options: WatermarkOptions,
  watermarkImg: HTMLImageElement | null,
  x: number,
  y: number
): void {
  ctx.save();
  ctx.globalAlpha = options.opacity;

  const centerX = x + (options.type === 'text' ? 0 : (watermarkImg ? watermarkImg.width / 2 : 0));
  const centerY = y + (options.type === 'text' ? 0 : (watermarkImg ? watermarkImg.height / 2 : 0));

  // 应用旋转
  if (options.rotation && options.rotation !== 0) {
    ctx.translate(centerX, centerY);
    ctx.rotate((options.rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
  }

  if (options.type === 'text' && options.text) {
    // 文字水印 - 使用 fontFamily 字段
    const fontFamily = options.fontFamily || '';
    const fontString = fontFamily
      ? `${options.fontSize}px "${fontFamily}", ${defaultFonts}`
      : `${options.fontSize}px ${defaultFonts}`;
    ctx.font = fontString;
    ctx.fillStyle = options.fontColor || '#FFFFFF';
    ctx.textBaseline = 'top';
    ctx.fillText(options.text, x, y);
  } else if (watermarkImg) {
    // 图片水印
    ctx.drawImage(watermarkImg, x, y);
  }

  ctx.restore();
}

/**
 * 获取水印尺寸
 */
function getWatermarkSize(
  ctx: CanvasRenderingContext2D,
  options: WatermarkOptions,
  watermarkImg: HTMLImageElement | null
): { width: number; height: number } {
  if (options.type === 'text' && options.text) {
    // 使用 fontFamily 字段
    const fontFamily = options.fontFamily || '';
    const fontString = fontFamily
      ? `${options.fontSize}px "${fontFamily}", ${defaultFonts}`
      : `${options.fontSize}px ${defaultFonts}`;
    ctx.font = fontString;
    const metrics = ctx.measureText(options.text);
    return { width: metrics.width, height: options.fontSize * 1.2 };
  } else if (watermarkImg) {
    return { width: watermarkImg.width, height: watermarkImg.height };
  }
  return { width: 0, height: 0 };
}

/**
 * 应用水印到图片
 * @param imageDataURL 原图的 data URL
 * @param options 水印选项
 * @returns 带水印的图片 data URL
 */
export async function applyWatermark(
  imageDataURL: string,
  options: WatermarkOptions
): Promise<string> {
  // 加载原图
  const img = await loadImage(imageDataURL);

  // 创建 canvas
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas 2d context');
  }

  // 如果是文字水印且有自定义字体，加载字体
  if (options.type === 'text' && options.fontPath && options.fontFamily) {
    const fontFamily = options.fontFamily;
    if (!loadedFontFamilies.has(fontFamily)) {
      console.log('[Watermark] Loading font:', fontFamily, 'from:', options.fontPath);
      await loadFont(options.fontPath, fontFamily);
    }
  }

  // 绘制原图
  ctx.drawImage(img, 0, 0);

  // 加载水印图片（如果是图片类型）
  let watermarkImg: HTMLImageElement | null = null;
  if (options.type === 'image' && options.imagePath) {
    try {
      let watermarkSrc: string;

      if (options.imagePath.startsWith('data:')) {
        // 已经是 data URL
        watermarkSrc = options.imagePath;
      } else {
        // 本地文件路径 - 检查缓存
        if (watermarkImageCache.has(options.imagePath)) {
          watermarkSrc = watermarkImageCache.get(options.imagePath)!;
          console.log('[Watermark] Using cached watermark image');
        } else {
          // 通过后端加载
          console.log('[Watermark] Loading local watermark image:', options.imagePath);
          try {
            const { ImageProcessorService } = await import('../../../bindings/ltools/plugins/imageprocessor');
            watermarkSrc = await ImageProcessorService.LoadImageAsDataURL(options.imagePath);
            // 缓存结果
            watermarkImageCache.set(options.imagePath, watermarkSrc);
            console.log('[Watermark] Watermark image loaded and cached');
          } catch (loadErr) {
            console.error('[Watermark] Failed to load watermark image:', loadErr);
            return imageDataURL;
          }
        }
      }

      watermarkImg = await loadImage(watermarkSrc);
      console.log('[Watermark] Watermark image element created:', {
        width: watermarkImg.width,
        height: watermarkImg.height
      });
    } catch (err) {
      console.error('Failed to load watermark image:', err);
      return imageDataURL;
    }
  }

  // 检查是否有有效的水印内容
  if (options.type === 'text' && !options.text) {
    return imageDataURL;
  }
  if (options.type === 'image' && !watermarkImg) {
    return imageDataURL;
  }

  // 获取水印尺寸
  const wmSize = getWatermarkSize(ctx, options, watermarkImg);

  // 平铺模式
  if (options.position === WatermarkPosition.PositionTile) {
    const margin = options.margin || 50;
    const spacingX = wmSize.width + (options.tileSpacingX || margin * 2);
    const spacingY = wmSize.height + (options.tileSpacingY || margin * 2);

    // 旋转水印（-45度）
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    const tileRotation = options.rotation !== 0 ? options.rotation : -45;
    ctx.rotate((tileRotation * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // 平铺绘制
    const cols = Math.ceil((canvas.width * 2) / spacingX) + 2;
    const rows = Math.ceil((canvas.height * 2) / spacingY) + 2;
    const startX = -canvas.width / 2;
    const startY = -canvas.height / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * spacingX;
        const y = startY + row * spacingY;
        drawSingleWatermark(ctx, options, watermarkImg, x, y);
      }
    }

    ctx.restore();
  } else {
    // 单个水印 - 使用偏移量定位
    // 计算中心位置
    const centerX = (canvas.width - wmSize.width) / 2;
    const centerY = (canvas.height - wmSize.height) / 2;

    // 应用偏移
    let x = centerX + (options.offsetX || 0);
    let y = centerY + (options.offsetY || 0);

    // 确保水印在图片范围内
    x = Math.max(0, Math.min(x, canvas.width - wmSize.width));
    y = Math.max(0, Math.min(y, canvas.height - wmSize.height));

    drawSingleWatermark(ctx, options, watermarkImg, x, y);
  }

  // 返回 data URL
  return canvas.toDataURL('image/png');
}

/**
 * 检查水印选项是否有效（是否有内容可预览）
 */
export function hasValidWatermarkContent(options: WatermarkOptions): boolean {
  if (options.type === 'text') {
    return !!options.text && options.text.trim().length > 0;
  }
  if (options.type === 'image') {
    return !!options.imagePath && options.imagePath.length > 0;
  }
  return false;
}

/**
 * 计算水印在画布中的位置（用于拖拽）
 * @param canvasWidth 画布宽度
 * @param canvasHeight 画布高度
 * @param wmWidth 水印宽度
 * @param wmHeight 水印高度
 * @param mouseX 鼠标 X 坐标
 * @param mouseY 鼠标 Y 坐标
 * @returns 偏移量 { offsetX, offsetY }
 */
export function calculateWatermarkOffset(
  canvasWidth: number,
  canvasHeight: number,
  wmWidth: number,
  wmHeight: number,
  mouseX: number,
  mouseY: number
): { offsetX: number; offsetY: number } {
  // 鼠标位置对应水印中心
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  // 计算偏移量（鼠标位置 - 中心位置 - 水印尺寸的一半）
  const offsetX = mouseX - centerX;
  const offsetY = mouseY - centerY;

  return { offsetX: Math.round(offsetX), offsetY: Math.round(offsetY) };
}
