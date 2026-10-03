import { useCallback, useState, useEffect } from 'react';
import { Dialogs } from '@wailsio/runtime';
import type {
  ProcessingMode,
  CompressOptions,
  CropOptions,
  WatermarkOptions,
  SteganographyOptions,
  FaviconOptions,
  FontInfo,
} from '../../../bindings/ltools/plugins/imageprocessor/models';
import { WatermarkPosition } from '../../../bindings/ltools/plugins/imageprocessor/models';
import { GetSystemFonts } from '../../../bindings/ltools/plugins/imageprocessor/imageprocessorservice';
import { Icon } from '../Icon';
import { useToast } from '../../hooks/useToast';
import { Button, Field, Input, Segmented, Textarea } from '../ui';
import { FontSelector } from './FontSelector';

interface SettingsPanelProps {
  mode: ProcessingMode;
  compressOptions: CompressOptions;
  cropOptions: CropOptions;
  watermarkOptions: WatermarkOptions;
  steganographyOptions: SteganographyOptions;
  faviconOptions: FaviconOptions;
  onCompressChange: (options: CompressOptions) => void;
  onCropChange: (options: CropOptions) => void;
  onWatermarkChange: (options: WatermarkOptions) => void;
  onSteganographyChange: (options: SteganographyOptions) => void;
  onFaviconChange: (options: FaviconOptions) => void;
  onProcess: () => void;
  onPreview: () => void;
  isProcessing: boolean;
  filesCount: number;
}

const aspectRatios = [
  { label: '自由', value: '' },
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '16:9', value: '16:9' },
  { label: '3:4', value: '3:4' },
  { label: '9:16', value: '9:16' },
];

/** 滑块行:左标签右数值,下方满宽滑块(与设计系统一致) */
function SliderRow({
  label,
  display,
  min,
  max,
  value,
  onChange,
  minLabel,
  centerLabel,
  maxLabel,
}: {
  label: string;
  display: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  minLabel?: string;
  centerLabel?: string;
  maxLabel?: string;
}): JSX.Element {
  return (
    <div className="hairline-b py-2">
      <Field horizontal label={label}>
        <span className="tnum rounded-[5px] bg-surface-1 px-2 py-0.5 font-mono text-[12px] text-text-1">
          {display}
        </span>
      </Field>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        aria-label={label}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-4 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:transition-colors"
      />
      {(minLabel || maxLabel) && (
        <div className="tnum mt-1 flex justify-between text-[10.5px] text-text-4">
          <span>{minLabel}</span>
          {centerLabel && <span>{centerLabel}</span>}
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}

export function SettingsPanel({
  mode,
  compressOptions,
  cropOptions,
  watermarkOptions,
  steganographyOptions,
  faviconOptions,
  onCompressChange,
  onCropChange,
  onWatermarkChange,
  onSteganographyChange,
  onFaviconChange,
  onProcess,
  onPreview,
  isProcessing,
  filesCount,
}: SettingsPanelProps): JSX.Element {
  const { error: showError } = useToast();
  const [fonts, setFonts] = useState<FontInfo[]>([]);
  const [fontsLoading, setFontsLoading] = useState(false);

  // Load system fonts on mount
  useEffect(() => {
    let cancelled = false;
    const loadFonts = async () => {
      setFontsLoading(true);
      try {
        const fontList = await GetSystemFonts();
        if (!cancelled) {
          setFonts(fontList || []);
        }
      } catch (err) {
        console.error('Failed to load system fonts:', err);
      } finally {
        if (!cancelled) {
          setFontsLoading(false);
        }
      }
    };
    loadFonts();
    return () => { cancelled = true; };
  }, []);

  const getFileName = (path: string): string => {
    if (!path || path.startsWith('data:')) return '';
    return path.split(/[/\\]/).pop() || '';
  };

  const handleWatermarkSelect = useCallback(async () => {
    try {
      const result = await Dialogs.OpenFile({
        Title: '选择水印图片',
        CanChooseFiles: true,
        CanChooseDirectories: false,
        AllowsMultipleSelection: false,
        Filters: [
          { DisplayName: '图片文件', Pattern: '*.jpg;*.jpeg;*.png;*.gif;*.bmp;*.tif;*.tiff;*.webp;*.ico' },
          { DisplayName: '所有文件', Pattern: '*.*' },
        ],
      });

      const selected = Array.isArray(result) ? result[0] : result;
      if (selected) {
        onWatermarkChange({
          ...watermarkOptions,
          type: 'image',
          imagePath: selected,
        });
      }
    } catch (err) {
      showError('选择文件失败');
    }
  }, [watermarkOptions, onWatermarkChange, showError]);

  const renderCompressSettings = () => (
    <div>
      <SliderRow
        label="压缩质量"
        display={`${compressOptions.quality}%`}
        min={1}
        max={100}
        value={compressOptions.quality}
        onChange={(value) => onCompressChange({ ...compressOptions, quality: value })}
        minLabel="低质量"
        maxLabel="高质量"
      />

      <div className="hairline-b grid grid-cols-2 gap-3 py-3">
        <Field label="最大宽度 (px)">
          <Input
            type="number"
            placeholder="不限制"
            value={compressOptions.maxWidth || ''}
            onChange={(e) => onCompressChange({ ...compressOptions, maxWidth: parseInt(e.target.value) || 0 })}
            className="tnum"
          />
        </Field>
        <Field label="最大高度 (px)">
          <Input
            type="number"
            placeholder="不限制"
            value={compressOptions.maxHeight || ''}
            onChange={(e) => onCompressChange({ ...compressOptions, maxHeight: parseInt(e.target.value) || 0 })}
            className="tnum"
          />
        </Field>
      </div>

      <div className="py-3">
        <Field horizontal label="输出格式">
          <Segmented
            options={[
              { value: '', label: '原格式' },
              { value: 'jpeg', label: 'JPEG' },
              { value: 'png', label: 'PNG' },
            ]}
            value={compressOptions.outputFormat}
            onChange={(value) => onCompressChange({ ...compressOptions, outputFormat: value })}
          />
        </Field>
      </div>
    </div>
  );

  const renderCropSettings = () => (
    <div>
      <div className="hairline-b py-3">
        <label className="field-label">裁剪模式</label>
        <div className="grid grid-cols-3 gap-1.5">
          {aspectRatios.map((ratio) => {
            const active = cropOptions.aspectRatio === ratio.value;
            return (
              <button
                key={ratio.value}
                onClick={() => onCropChange({ ...cropOptions, aspectRatio: ratio.value })}
                aria-pressed={active}
                className={`h-7 rounded-[6px] border text-[12px] font-medium transition-colors duration-150 ${
                  active
                    ? 'border-accent/40 bg-accent-subtle text-accent-text'
                    : 'border-hairline-strong bg-surface-1 text-text-2 hover:bg-surface-2'
                }`}
              >
                {ratio.label}
              </button>
            );
          })}
        </div>
      </div>

      {!cropOptions.aspectRatio && (
        <div className="hairline-b grid grid-cols-2 gap-3 py-3">
          <Field label="X 坐标 (px)">
            <Input
              type="number"
              value={cropOptions.x}
              onChange={(e) => onCropChange({ ...cropOptions, x: parseInt(e.target.value) || 0 })}
              className="tnum"
            />
          </Field>
          <Field label="Y 坐标 (px)">
            <Input
              type="number"
              value={cropOptions.y}
              onChange={(e) => onCropChange({ ...cropOptions, y: parseInt(e.target.value) || 0 })}
              className="tnum"
            />
          </Field>
          <Field label="宽度 (px)">
            <Input
              type="number"
              value={cropOptions.width}
              onChange={(e) => onCropChange({ ...cropOptions, width: parseInt(e.target.value) || 0 })}
              className="tnum"
            />
          </Field>
          <Field label="高度 (px)">
            <Input
              type="number"
              value={cropOptions.height}
              onChange={(e) => onCropChange({ ...cropOptions, height: parseInt(e.target.value) || 0 })}
              className="tnum"
            />
          </Field>
        </div>
      )}
    </div>
  );

  const renderWatermarkSettings = () => (
    <div>
      {/* 水印类型 */}
      <div className="hairline-b py-3">
        <Field horizontal label="水印类型">
          <Segmented
            options={[
              { value: 'text', label: '文字' },
              { value: 'image', label: '图片' },
            ]}
            value={watermarkOptions.type}
            onChange={(value) => onWatermarkChange({ ...watermarkOptions, type: value as 'text' | 'image' })}
          />
        </Field>
      </div>

      {/* 水印内容 */}
      {watermarkOptions.type === 'text' ? (
        <>
          <div className="hairline-b py-3">
            <Field label="水印文字">
              <Input
                type="text"
                placeholder="输入水印文字"
                value={watermarkOptions.text}
                onChange={(e) => onWatermarkChange({ ...watermarkOptions, text: e.target.value })}
              />
            </Field>
          </div>

          {/* 字体选择 */}
          <div className="hairline-b py-3">
            <Field label="字体">
              <FontSelector
                fonts={fonts}
                value={watermarkOptions.fontPath || ''}
                fontFamily={watermarkOptions.fontFamily}
                onChange={(font) => {
                  if (font) {
                    onWatermarkChange({
                      ...watermarkOptions,
                      fontPath: font.path,
                      fontFamily: font.family,
                    });
                  } else {
                    onWatermarkChange({
                      ...watermarkOptions,
                      fontPath: '',
                      fontFamily: '',
                    });
                  }
                }}
                loading={fontsLoading}
                disabled={isProcessing}
              />
            </Field>
          </div>

          {/* 字体大小 */}
          <SliderRow
            label="字体大小"
            display={`${watermarkOptions.fontSize}px`}
            min={12}
            max={120}
            value={watermarkOptions.fontSize}
            onChange={(value) => onWatermarkChange({ ...watermarkOptions, fontSize: value })}
            minLabel="12"
            maxLabel="120"
          />

          {/* 字体颜色 */}
          <div className="hairline-b py-3">
            <Field horizontal label="字体颜色">
              <div className="flex items-center gap-2">
                <label
                  className="relative block h-7 w-9 shrink-0 cursor-pointer overflow-hidden rounded-[6px] border border-hairline-strong"
                  style={{ backgroundColor: watermarkOptions.fontColor || '#FFFFFF' }}
                >
                  <input
                    type="color"
                    value={watermarkOptions.fontColor || '#FFFFFF'}
                    onChange={(e) => onWatermarkChange({ ...watermarkOptions, fontColor: e.target.value })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="选择字体颜色"
                  />
                </label>
                <Input
                  type="text"
                  value={watermarkOptions.fontColor || '#FFFFFF'}
                  onChange={(e) => onWatermarkChange({ ...watermarkOptions, fontColor: e.target.value })}
                  className="tnum w-24 font-mono"
                  placeholder="#FFFFFF"
                />
              </div>
            </Field>
          </div>
        </>
      ) : (
        <>
          <div className="hairline-b py-3">
            <Field label="水印图片">
              <button
                onClick={handleWatermarkSelect}
                className="flex w-full flex-col items-center gap-1.5 rounded-[6px] border border-dashed border-hairline-strong bg-surface-1 px-3 py-4 text-text-3 transition-colors duration-150 hover:bg-surface-2 hover:text-text-2"
              >
                <Icon name="photo" size={18} />
                <span className="truncate text-[12px]">
                  {getFileName(watermarkOptions.imagePath) || '点击选择水印图片'}
                </span>
              </button>
            </Field>
          </div>

          {/* 缩放比例仅对图片水印有效 */}
          <SliderRow
            label="缩放比例"
            display={`${Math.round(watermarkOptions.scale * 100)}%`}
            min={10}
            max={100}
            value={Math.round(watermarkOptions.scale * 100)}
            onChange={(value) => onWatermarkChange({ ...watermarkOptions, scale: value / 100 })}
            minLabel="10%"
            maxLabel="100%"
          />
        </>
      )}

      {/* 水印模式：单个/平铺 */}
      <div className="hairline-b py-3">
        <Field horizontal label="水印模式">
          <Segmented
            options={[
              { value: WatermarkPosition.PositionSingle, label: '单个水印' },
              { value: WatermarkPosition.PositionTile, label: '平铺水印' },
            ]}
            value={watermarkOptions.position}
            onChange={(value) => onWatermarkChange({ ...watermarkOptions, position: value as WatermarkPosition })}
          />
        </Field>
      </div>

      {/* 旋转角度 */}
      <SliderRow
        label="旋转角度"
        display={`${watermarkOptions.rotation || 0}°`}
        min={-180}
        max={180}
        value={watermarkOptions.rotation || 0}
        onChange={(value) => onWatermarkChange({ ...watermarkOptions, rotation: value })}
        minLabel="-180°"
        centerLabel="0°"
        maxLabel="180°"
      />

      {/* 单个水印：X/Y 偏移 */}
      {watermarkOptions.position === WatermarkPosition.PositionSingle && (
        <>
          <SliderRow
            label="X 偏移"
            display={`${watermarkOptions.offsetX || 0}px`}
            min={-500}
            max={500}
            value={watermarkOptions.offsetX || 0}
            onChange={(value) => onWatermarkChange({ ...watermarkOptions, offsetX: value })}
          />
          <SliderRow
            label="Y 偏移"
            display={`${watermarkOptions.offsetY || 0}px`}
            min={-500}
            max={500}
            value={watermarkOptions.offsetY || 0}
            onChange={(value) => onWatermarkChange({ ...watermarkOptions, offsetY: value })}
          />
        </>
      )}

      {/* 平铺模式：间距控制 */}
      {watermarkOptions.position === WatermarkPosition.PositionTile && (
        <>
          <SliderRow
            label="X 间距"
            display={`${watermarkOptions.tileSpacingX || 100}px`}
            min={50}
            max={500}
            value={watermarkOptions.tileSpacingX || 100}
            onChange={(value) => onWatermarkChange({ ...watermarkOptions, tileSpacingX: value })}
          />
          <SliderRow
            label="Y 间距"
            display={`${watermarkOptions.tileSpacingY || 100}px`}
            min={50}
            max={500}
            value={watermarkOptions.tileSpacingY || 100}
            onChange={(value) => onWatermarkChange({ ...watermarkOptions, tileSpacingY: value })}
          />
        </>
      )}

      {/* 透明度 */}
      <SliderRow
        label="透明度"
        display={`${Math.round(watermarkOptions.opacity * 100)}%`}
        min={0}
        max={100}
        value={Math.round(watermarkOptions.opacity * 100)}
        onChange={(value) => onWatermarkChange({ ...watermarkOptions, opacity: value / 100 })}
      />
    </div>
  );

  const handleBlindWatermarkSelect = useCallback(async () => {
    try {
      const result = await Dialogs.OpenFile({
        Title: '选择水印图片',
        CanChooseFiles: true,
        CanChooseDirectories: false,
        AllowsMultipleSelection: false,
        Filters: [
          { DisplayName: '图片文件', Pattern: '*.jpg;*.jpeg;*.png;*.gif;*.bmp;*.tif;*.tiff;*.webp;*.ico' },
          { DisplayName: '所有文件', Pattern: '*.*' },
        ],
      });

      const selected = Array.isArray(result) ? result[0] : result;
      if (selected) {
        onSteganographyChange({
          ...steganographyOptions,
          type: 'image',
          imagePath: selected,
        });
      }
    } catch (err) {
      showError('选择文件失败');
    }
  }, [steganographyOptions, onSteganographyChange, showError]);

  const renderSteganographySettings = () => (
    <div>
      <div className="hairline-b pb-3 pt-1">
        <div className="card-inset flex items-start gap-2.5 p-3">
          <Icon name="lock" size={15} className="mt-0.5 shrink-0 text-text-3" />
          <div className="text-[11.5px] leading-relaxed text-text-3">
            盲水印使用 DWT+DCT+SVD 算法，抗压缩、抗裁剪，适合版权保护。
          </div>
        </div>
      </div>

      <div className="hairline-b py-3">
        <Field horizontal label="模式">
          <Segmented
            options={[
              { value: 'encode', label: '嵌入水印' },
              { value: 'decode', label: '提取水印' },
            ]}
            value={steganographyOptions.mode}
            onChange={(value) => onSteganographyChange({ ...steganographyOptions, mode: value as 'encode' | 'decode' })}
          />
        </Field>
      </div>

      {steganographyOptions.mode === 'encode' && (
        <>
          <div className="hairline-b py-3">
            <Field horizontal label="水印类型">
              <Segmented
                options={[
                  { value: 'text', label: '文本' },
                  { value: 'image', label: '图片' },
                ]}
                value={steganographyOptions.type || 'text'}
                onChange={(value) => onSteganographyChange({ ...steganographyOptions, type: value as 'text' | 'image' })}
              />
            </Field>
          </div>

          {(steganographyOptions.type === 'text' || !steganographyOptions.type) && (
            <div className="hairline-b py-3">
              <Field label="水印文本">
                <Textarea
                  placeholder="输入版权信息或标识..."
                  value={steganographyOptions.message}
                  onChange={(e) => onSteganographyChange({ ...steganographyOptions, message: e.target.value })}
                  rows={3}
                  className="resize-none"
                />
              </Field>
            </div>
          )}

          {steganographyOptions.type === 'image' && (
            <div className="hairline-b py-3">
              <Field label="水印图片 (Logo)" hint="建议使用 64x64 的黑白 Logo 图片">
                <button
                  onClick={handleBlindWatermarkSelect}
                  className="flex w-full flex-col items-center gap-1.5 rounded-[6px] border border-dashed border-hairline-strong bg-surface-1 px-3 py-4 text-text-3 transition-colors duration-150 hover:bg-surface-2 hover:text-text-2"
                >
                  <Icon name="photo" size={18} />
                  <span className="truncate text-[12px]">
                    {getFileName(steganographyOptions.imagePath) || '点击选择水印图片'}
                  </span>
                </button>
              </Field>
            </div>
          )}

          <div className="hairline-b grid grid-cols-2 gap-3 py-3">
            <Field label="密码种子 1">
              <Input
                type="number"
                placeholder="默认: 12345"
                value={steganographyOptions.password1 || ''}
                onChange={(e) => onSteganographyChange({ ...steganographyOptions, password1: parseInt(e.target.value) || 0 })}
                className="tnum"
              />
            </Field>
            <Field label="密码种子 2">
              <Input
                type="number"
                placeholder="默认: 67890"
                value={steganographyOptions.password2 || ''}
                onChange={(e) => onSteganographyChange({ ...steganographyOptions, password2: parseInt(e.target.value) || 0 })}
                className="tnum"
              />
            </Field>
          </div>

          <div className="py-3">
            <div className="flex items-start gap-2 rounded-[6px] border border-hairline-faint bg-surface-1 px-3 py-2.5">
              <Icon name="information-circle" size={13} className="mt-0.5 shrink-0 text-text-3" />
              <p className="text-[11.5px] leading-relaxed text-text-3">
                密码种子用于加密水印，提取时需要使用相同的密码
              </p>
            </div>
          </div>
        </>
      )}

      {steganographyOptions.mode === 'decode' && (
        <>
          <div className="hairline-b py-3">
            <Field horizontal label="水印类型">
              <Segmented
                options={[
                  { value: 'text', label: '文本' },
                  { value: 'image', label: '图片' },
                ]}
                value={steganographyOptions.type || 'text'}
                onChange={(value) => onSteganographyChange({ ...steganographyOptions, type: value as 'text' | 'image' })}
              />
            </Field>
          </div>

          {(steganographyOptions.type === 'text' || !steganographyOptions.type) && (
            <div className="hairline-b py-3">
              <Field label="提取的水印内容">
                <Textarea
                  readOnly
                  value={steganographyOptions.message}
                  placeholder="点击「开始处理」提取水印..."
                  className="min-h-[80px] resize-none"
                />
              </Field>
            </div>
          )}

          <div className="hairline-b grid grid-cols-2 gap-3 py-3">
            <Field label="密码种子 1">
              <Input
                type="number"
                placeholder="默认: 12345"
                value={steganographyOptions.password1 || ''}
                onChange={(e) => onSteganographyChange({ ...steganographyOptions, password1: parseInt(e.target.value) || 0 })}
                className="tnum"
              />
            </Field>
            <Field label="密码种子 2">
              <Input
                type="number"
                placeholder="默认: 67890"
                value={steganographyOptions.password2 || ''}
                onChange={(e) => onSteganographyChange({ ...steganographyOptions, password2: parseInt(e.target.value) || 0 })}
                className="tnum"
              />
            </Field>
          </div>

          <div className="py-3">
            <div
              className="flex items-start gap-2 rounded-[6px] px-3 py-2.5 text-[11.5px] leading-relaxed"
              style={{
                background: 'rgba(255,159,10,0.08)',
                border: '1px solid rgba(255,159,10,0.18)',
                color: 'var(--color-warning-text)',
              }}
            >
              <Icon name="exclamation-circle" size={13} className="mt-0.5 shrink-0" />
              <span>提取水印需要使用嵌入时相同的密码种子</span>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderFaviconSettings = () => (
    <div>
      <div className="hairline-b pb-3 pt-1">
        <div className="card-inset p-3">
          <div className="flex items-start gap-2.5">
            <Icon name="information-circle" size={15} className="mt-0.5 shrink-0 text-text-3" />
            <div className="min-w-0 text-[11.5px] leading-relaxed text-text-3">
              <p className="mb-1.5">将自动生成以下标准 favicon 文件：</p>
              <ul className="list-inside list-disc space-y-0.5 font-mono text-[11px]">
                <li>android-chrome-192x192.png</li>
                <li>android-chrome-512x512.png</li>
                <li>apple-touch-icon.png (180×180)</li>
                <li>favicon-16x16.png</li>
                <li>favicon-32x32.png</li>
                <li>favicon.ico (48×48)</li>
                <li>site.webmanifest</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-3">
        <div className="card-inset p-3">
          <div className="flex items-start gap-2.5">
            <Icon name="document" size={14} className="mt-0.5 shrink-0 text-text-3" />
            <p className="text-[11.5px] leading-relaxed text-text-3">
              处理完成后，将显示 HTML 链接标签，方便您复制到网站头部。
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => {
    switch (mode) {
      case 'compress':
        return renderCompressSettings();
      case 'crop':
        return renderCropSettings();
      case 'watermark':
        return renderWatermarkSettings();
      case 'steganography':
        return renderSteganographySettings();
      case 'favicon':
        return renderFaviconSettings();
      default:
        return null;
    }
  };

  // 水印模式已实现自动预览，不需要手动预览按钮
  const canPreview = ['compress', 'crop'].includes(mode);

  return (
    <div className="card flex h-full flex-col p-4">
      <h3 className="section-title">处理设置</h3>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {renderSettings()}
      </div>

      <div className="hairline-t mt-2 space-y-2 pt-3">
        {canPreview && (
          <Button
            variant="secondary"
            icon="eye"
            className="w-full"
            onClick={onPreview}
            disabled={isProcessing || filesCount === 0}
          >
            预览效果
          </Button>
        )}
        <Button
          variant="primary"
          icon="play"
          className="w-full"
          onClick={onProcess}
          loading={isProcessing}
          disabled={isProcessing || filesCount === 0}
        >
          开始处理{filesCount > 0 && <span className="tnum">&nbsp;({filesCount})</span>}
        </Button>
      </div>
    </div>
  );
}
