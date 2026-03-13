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
    <div className="space-y-4">
      <div>
        <label className="text-sm text-white/60 mb-2 block">压缩质量: {compressOptions.quality}%</label>
        <input
          type="range"
          min="1"
          max="100"
          value={compressOptions.quality}
          onChange={(e) => onCompressChange({ ...compressOptions, quality: parseInt(e.target.value) })}
          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#7C3AED]"
        />
        <div className="flex justify-between text-xs text-white/40 mt-1">
          <span>低质量</span>
          <span>高质量</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-white/60 mb-1 block">最大宽度 (px)</label>
          <input
            type="number"
            placeholder="不限制"
            value={compressOptions.maxWidth || ''}
            onChange={(e) => onCompressChange({ ...compressOptions, maxWidth: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#7C3AED]"
          />
        </div>
        <div>
          <label className="text-sm text-white/60 mb-1 block">最大高度 (px)</label>
          <input
            type="number"
            placeholder="不限制"
            value={compressOptions.maxHeight || ''}
            onChange={(e) => onCompressChange({ ...compressOptions, maxHeight: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#7C3AED]"
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-white/60 mb-2 block">输出格式</label>
        <div className="flex gap-2">
          {['', 'jpeg', 'png'].map((fmt) => (
            <button
              key={fmt || 'original'}
              onClick={() => onCompressChange({ ...compressOptions, outputFormat: fmt })}
              className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                compressOptions.outputFormat === fmt
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {fmt ? fmt.toUpperCase() : '原格式'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCropSettings = () => (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-white/60 mb-2 block">裁剪模式</label>
        <div className="grid grid-cols-3 gap-2">
          {aspectRatios.map((ratio) => (
            <button
              key={ratio.value}
              onClick={() => onCropChange({ ...cropOptions, aspectRatio: ratio.value })}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                cropOptions.aspectRatio === ratio.value
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {ratio.label}
            </button>
          ))}
        </div>
      </div>

      {!cropOptions.aspectRatio && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-white/60 mb-1 block">X 坐标 (px)</label>
            <input
              type="number"
              value={cropOptions.x}
              onChange={(e) => onCropChange({ ...cropOptions, x: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#7C3AED]"
            />
          </div>
          <div>
            <label className="text-sm text-white/60 mb-1 block">Y 坐标 (px)</label>
            <input
              type="number"
              value={cropOptions.y}
              onChange={(e) => onCropChange({ ...cropOptions, y: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#7C3AED]"
            />
          </div>
          <div>
            <label className="text-sm text-white/60 mb-1 block">宽度 (px)</label>
            <input
              type="number"
              value={cropOptions.width}
              onChange={(e) => onCropChange({ ...cropOptions, width: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#7C3AED]"
            />
          </div>
          <div>
            <label className="text-sm text-white/60 mb-1 block">高度 (px)</label>
            <input
              type="number"
              value={cropOptions.height}
              onChange={(e) => onCropChange({ ...cropOptions, height: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#7C3AED]"
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderWatermarkSettings = () => (
    <div className="space-y-4">
      {/* 水印类型 */}
      <div>
        <label className="text-sm text-white/60 mb-2 block">水印类型</label>
        <div className="flex gap-2">
          {[
            { value: 'text', label: '文字' },
            { value: 'image', label: '图片' },
          ].map((type) => (
            <button
              key={type.value}
              onClick={() => onWatermarkChange({ ...watermarkOptions, type: type.value as 'text' | 'image' })}
              className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                watermarkOptions.type === type.value
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* 水印内容 */}
      {watermarkOptions.type === 'text' ? (
        <>
          <div>
            <label className="text-sm text-white/60 mb-1 block">水印文字</label>
            <input
              type="text"
              placeholder="输入水印文字"
              value={watermarkOptions.text}
              onChange={(e) => onWatermarkChange({ ...watermarkOptions, text: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#7C3AED]"
            />
          </div>
          {/* 字体选择 */}
          <div>
            <label className="text-sm text-white/60 mb-2 block">字体</label>
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
          </div>
          {/* 字体大小 */}
          <div>
            <label className="text-sm text-white/60 mb-2 block">字体大小: {watermarkOptions.fontSize}px</label>
            <input
              type="range"
              min="12"
              max="120"
              value={watermarkOptions.fontSize}
              onChange={(e) => onWatermarkChange({ ...watermarkOptions, fontSize: parseInt(e.target.value) })}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#7C3AED]"
            />
            <div className="flex justify-between text-xs text-white/40 mt-1">
              <span>12</span>
              <span>120</span>
            </div>
          </div>
          {/* 字体颜色 */}
          <div>
            <label className="text-sm text-white/60 mb-2 block">字体颜色</label>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg border-2 border-white/20 cursor-pointer overflow-hidden flex-shrink-0"
                style={{ backgroundColor: watermarkOptions.fontColor || '#FFFFFF' }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'color';
                  input.value = watermarkOptions.fontColor || '#FFFFFF';
                  input.onchange = (e) => {
                    const target = e.target as HTMLInputElement;
                    onWatermarkChange({ ...watermarkOptions, fontColor: target.value });
                  };
                  input.click();
                }}
              >
                <input
                  type="color"
                  value={watermarkOptions.fontColor || '#FFFFFF'}
                  onChange={(e) => onWatermarkChange({ ...watermarkOptions, fontColor: e.target.value })}
                  className="w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <input
                type="text"
                value={watermarkOptions.fontColor || '#FFFFFF'}
                onChange={(e) => onWatermarkChange({ ...watermarkOptions, fontColor: e.target.value })}
                className="flex-1 min-w-0 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-[#7C3AED]"
                placeholder="#FFFFFF"
              />
            </div>
          </div>
        </>
      ) : (
        <div>
          <label className="text-sm text-white/60 mb-1 block">水印图片</label>
          <button
            onClick={handleWatermarkSelect}
            className="w-full px-3 py-4 bg-white/5 border border-white/10 border-dashed rounded-lg text-white/60 text-sm hover:bg-white/10 transition-colors flex flex-col items-center gap-2"
          >
            <Icon name="photo" className="w-6 h-6" />
            {getFileName(watermarkOptions.imagePath) || '点击选择水印图片'}
          </button>
          {/* 缩放比例仅对图片水印有效 */}
          <div className="mt-3">
            <label className="text-sm text-white/60 mb-2 block">缩放比例: {Math.round(watermarkOptions.scale * 100)}%</label>
            <input
              type="range"
              min="10"
              max="100"
              value={Math.round(watermarkOptions.scale * 100)}
              onChange={(e) => onWatermarkChange({ ...watermarkOptions, scale: parseInt(e.target.value) / 100 })}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#7C3AED]"
            />
          </div>
        </div>
      )}

      {/* 水印模式：单个/平铺 */}
      <div>
        <label className="text-sm text-white/60 mb-2 block">水印模式</label>
        <div className="flex gap-2">
          <button
            onClick={() => onWatermarkChange({ ...watermarkOptions, position: WatermarkPosition.PositionSingle })}
            className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
              watermarkOptions.position === WatermarkPosition.PositionSingle
                ? 'bg-[#7C3AED] text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            单个水印
          </button>
          <button
            onClick={() => onWatermarkChange({ ...watermarkOptions, position: WatermarkPosition.PositionTile })}
            className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
              watermarkOptions.position === WatermarkPosition.PositionTile
                ? 'bg-[#7C3AED] text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            平铺水印
          </button>
        </div>
      </div>

      {/* 旋转角度 */}
      <div>
        <label className="text-sm text-white/60 mb-2 block">旋转角度: {watermarkOptions.rotation || 0}°</label>
        <input
          type="range"
          min="-180"
          max="180"
          value={watermarkOptions.rotation || 0}
          onChange={(e) => onWatermarkChange({ ...watermarkOptions, rotation: parseInt(e.target.value) })}
          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#7C3AED]"
        />
        <div className="flex justify-between text-xs text-white/40 mt-1">
          <span>-180°</span>
          <span>0°</span>
          <span>180°</span>
        </div>
      </div>

      {/* 单个水印：X/Y 偏移 */}
      {watermarkOptions.position === WatermarkPosition.PositionSingle && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-white/60 mb-1 block">X 偏移: {watermarkOptions.offsetX || 0}px</label>
            <input
              type="range"
              min="-500"
              max="500"
              value={watermarkOptions.offsetX || 0}
              onChange={(e) => onWatermarkChange({ ...watermarkOptions, offsetX: parseInt(e.target.value) })}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#7C3AED]"
            />
          </div>
          <div>
            <label className="text-sm text-white/60 mb-1 block">Y 偏移: {watermarkOptions.offsetY || 0}px</label>
            <input
              type="range"
              min="-500"
              max="500"
              value={watermarkOptions.offsetY || 0}
              onChange={(e) => onWatermarkChange({ ...watermarkOptions, offsetY: parseInt(e.target.value) })}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#7C3AED]"
            />
          </div>
        </div>
      )}

      {/* 平铺模式：间距控制 */}
      {watermarkOptions.position === WatermarkPosition.PositionTile && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-white/60 mb-1 block">X 间距: {watermarkOptions.tileSpacingX || 100}px</label>
            <input
              type="range"
              min="50"
              max="500"
              value={watermarkOptions.tileSpacingX || 100}
              onChange={(e) => onWatermarkChange({ ...watermarkOptions, tileSpacingX: parseInt(e.target.value) })}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#7C3AED]"
            />
          </div>
          <div>
            <label className="text-sm text-white/60 mb-1 block">Y 间距: {watermarkOptions.tileSpacingY || 100}px</label>
            <input
              type="range"
              min="50"
              max="500"
              value={watermarkOptions.tileSpacingY || 100}
              onChange={(e) => onWatermarkChange({ ...watermarkOptions, tileSpacingY: parseInt(e.target.value) })}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#7C3AED]"
            />
          </div>
        </div>
      )}

      {/* 透明度 */}
      <div>
        <label className="text-sm text-white/60 mb-2 block">透明度: {Math.round(watermarkOptions.opacity * 100)}%</label>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(watermarkOptions.opacity * 100)}
          onChange={(e) => onWatermarkChange({ ...watermarkOptions, opacity: parseInt(e.target.value) / 100 })}
          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#7C3AED]"
        />
      </div>
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
    <div className="space-y-4">
      <div className="bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Icon name="lock" className="w-5 h-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-[#22C55E]/80">
            <p className="mb-1">盲水印使用 DWT+DCT+SVD 算法，</p>
            <p>抗压缩、抗裁剪，适合版权保护。</p>
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm text-white/60 mb-2 block">模式</label>
        <div className="flex gap-2">
          {[
            { value: 'encode', label: '嵌入水印' },
            { value: 'decode', label: '提取水印' },
          ].map((m) => (
            <button
              key={m.value}
              onClick={() => onSteganographyChange({ ...steganographyOptions, mode: m.value as 'encode' | 'decode' })}
              className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                steganographyOptions.mode === m.value
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {steganographyOptions.mode === 'encode' && (
        <>
          <div>
            <label className="text-sm text-white/60 mb-2 block">水印类型</label>
            <div className="flex gap-2">
              {[
                { value: 'text', label: '文本' },
                { value: 'image', label: '图片' },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => onSteganographyChange({ ...steganographyOptions, type: t.value as 'text' | 'image' })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                    (steganographyOptions.type || 'text') === t.value
                      ? 'bg-[#7C3AED] text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {(steganographyOptions.type === 'text' || !steganographyOptions.type) && (
            <div>
              <label className="text-sm text-white/60 mb-1 block">水印文本</label>
              <textarea
                placeholder="输入版权信息或标识..."
                value={steganographyOptions.message}
                onChange={(e) => onSteganographyChange({ ...steganographyOptions, message: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#7C3AED] resize-none"
              />
            </div>
          )}

          {steganographyOptions.type === 'image' && (
            <div>
              <label className="text-sm text-white/60 mb-1 block">水印图片 (Logo)</label>
              <button
                onClick={handleBlindWatermarkSelect}
                className="w-full px-3 py-4 bg-white/5 border border-white/10 border-dashed rounded-lg text-white/60 text-sm hover:bg-white/10 transition-colors flex flex-col items-center gap-2"
              >
                <Icon name="photo" className="w-6 h-6" />
                {getFileName(steganographyOptions.imagePath) || '点击选择水印图片'}
              </button>
              <p className="text-xs text-white/40 mt-1">建议使用 64x64 的黑白 Logo 图片</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-white/60 mb-1 block">密码种子 1</label>
              <input
                type="number"
                placeholder="默认: 12345"
                value={steganographyOptions.password1 || ''}
                onChange={(e) => onSteganographyChange({ ...steganographyOptions, password1: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#7C3AED]"
              />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1 block">密码种子 2</label>
              <input
                type="number"
                placeholder="默认: 67890"
                value={steganographyOptions.password2 || ''}
                onChange={(e) => onSteganographyChange({ ...steganographyOptions, password2: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#7C3AED]"
              />
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-2">
            <p className="text-xs text-white/40">
              💡 密码种子用于加密水印，提取时需要使用相同的密码
            </p>
          </div>
        </>
      )}

      {steganographyOptions.mode === 'decode' && (
        <>
          <div>
            <label className="text-sm text-white/60 mb-2 block">水印类型</label>
            <div className="flex gap-2">
              {[
                { value: 'text', label: '文本' },
                { value: 'image', label: '图片' },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => onSteganographyChange({ ...steganographyOptions, type: t.value as 'text' | 'image' })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                    (steganographyOptions.type || 'text') === t.value
                      ? 'bg-[#7C3AED] text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {(steganographyOptions.type === 'text' || !steganographyOptions.type) && (
            <div>
              <label className="text-sm text-white/60 mb-1 block">提取的水印内容</label>
              <textarea
                readOnly
                value={steganographyOptions.message}
                placeholder="点击「开始处理」提取水印..."
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#7C3AED] min-h-[80px] resize-none"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-white/60 mb-1 block">密码种子 1</label>
              <input
                type="number"
                placeholder="默认: 12345"
                value={steganographyOptions.password1 || ''}
                onChange={(e) => onSteganographyChange({ ...steganographyOptions, password1: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#7C3AED]"
              />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1 block">密码种子 2</label>
              <input
                type="number"
                placeholder="默认: 67890"
                value={steganographyOptions.password2 || ''}
                onChange={(e) => onSteganographyChange({ ...steganographyOptions, password2: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#7C3AED]"
              />
            </div>
          </div>

          <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg p-2">
            <p className="text-xs text-[#F59E0B]/80">
              ⚠️ 提取水印需要使用嵌入时相同的密码种子
            </p>
          </div>
        </>
      )}
    </div>
  );

  const renderFaviconSettings = () => (
    <div className="space-y-4">
      <div className="bg-[#A78BFA]/10 border border-[#A78BFA]/20 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Icon name="information-circle" className="w-5 h-5 text-[#A78BFA] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-[#A78BFA]/80">
            <p className="mb-2">将自动生成以下标准 favicon 文件：</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
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

      <div className="bg-white/5 border border-white/10 rounded-lg p-3">
        <div className="flex items-start gap-2 mb-2">
          <Icon name="document" className="w-4 h-4 text-white/60 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-white/60">处理完成后，将显示 HTML 链接标签，方便您复制到网站头部。</p>
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
    <div className="glass-heavy rounded-2xl p-4 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-[#FAF5FF] mb-4 flex items-center gap-2">
        <Icon name="cog-6-tooth" className="w-5 h-5 text-[#A78BFA]" />
        处理设置
      </h3>

      <div className="flex-1 overflow-y-auto">
        {renderSettings()}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
        {canPreview && (
          <button
            onClick={onPreview}
            disabled={isProcessing || filesCount === 0}
            className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="eye" className="w-4 h-4" />
            预览效果
          </button>
        )}
        <button
          onClick={onProcess}
          disabled={isProcessing || filesCount === 0}
          className="w-full px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              处理中...
            </>
          ) : (
            <>
              <Icon name="play" className="w-4 h-4" />
              开始处理 {filesCount > 0 && `(${filesCount})`}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
