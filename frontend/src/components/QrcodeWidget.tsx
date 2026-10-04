import { useState, useRef, useCallback, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Icon } from './Icon';
import { useToast } from '../hooks/useToast';
import * as QrcodeService from '../../bindings/ltools/plugins/qrcode/qrcodeservice';
import { t } from '@/i18n';

/**
 * 纠错级别选项
 * L: ~7% 容错
 * M: ~15% 容错
 * Q: ~25% 容错
 * H: ~30% 容错
 */
type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

/**
 * 尺寸预设
 */
type SizePreset = 'small' | 'medium' | 'large' | 'custom';

const SIZE_PRESETS: Record<SizePreset, number> = {
  small: 128,
  medium: 256,
  large: 512,
  custom: 256,
};

const ERROR_LEVELS: Array<{ value: ErrorCorrectionLevel; label: string; description: string }> = [
  { value: 'L', label: 'L', description: t('7% 容错') },
  { value: 'M', label: 'M', description: t('15% 容错') },
  { value: 'Q', label: 'Q', description: t('25% 容错') },
  { value: 'H', label: 'H', description: t('30% 容错') },
];

/**
 * 二维码生成器组件
 *
 * 功能特性：
 * - 实时预览二维码
 * - 自定义尺寸和纠错级别
 * - 一键复制到剪贴板（前端方式，有后端降级）
 * - 保存为 PNG 文件（通过后端）
 * - 自动检测输入类型（URL、文本）
 */
export function QrcodeWidget(): JSX.Element {
  const { success, error: showError } = useToast();
  const [content, setContent] = useState('');
  const [sizePreset, setSizePreset] = useState<SizePreset>('medium');
  const [customSize] = useState(256);
  const [errorLevel, setErrorLevel] = useState<ErrorCorrectionLevel>('Q');
  const [copied, setCopied] = useState(false);
  const [includeMargin, setIncludeMargin] = useState(false);
  const [saveDir, setSaveDir] = useState('~/Pictures/QRCodes');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 计算实际尺寸
  const actualSize = sizePreset === 'custom' ? customSize : SIZE_PRESETS[sizePreset];

  // 检测输入类型
  const detectInputType = useCallback((text: string): 'url' | 'text' | 'empty' => {
    if (!text.trim()) return 'empty';
    try {
      new URL(text);
      return 'url';
    } catch {
      return 'text';
    }
  }, []);

  const inputType = detectInputType(content);

  // 加载保存目录
  useEffect(() => {
    QrcodeService.GetSaveDir().then((dir: string) => {
      setSaveDir(dir);
    }).catch((err: any) => {
      console.error('Failed to get save directory:', err);
    });
  }, []);

  // 复制到剪贴板 - 使用后端原生剪贴板 API
  const copyToClipboard = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      // 转换为 base64
      const dataUrl = canvas.toDataURL('image/png');

      // 调用后端剪贴板方法（使用平台原生 API）
      await QrcodeService.CopyToClipboard(dataUrl);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      success(t('二维码已复制到剪贴板'));
    } catch (err) {
      console.error('复制失败:', err);
      showError(t('复制失败: ') + (err as Error).message);
    }
  }, [showError]);

  // 保存为文件 - 使用后端服务
  const saveToFile = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      // 转换为 base64
      const dataUrl = canvas.toDataURL('image/png');

      // 调用后端保存方法
      const savedPath = await QrcodeService.SaveToFile(dataUrl, '');
      console.log('File saved to:', savedPath);

      // 显示成功消息
      success(t('二维码已保存到:\n{path}', { path: savedPath }));
    } catch (err) {
      console.error('保存失败:', err);
      showError(t('保存失败: ') + (err as Error).message);
    }
  }, [content, success, showError]);

  // 常用内容快速填充
  const quickFill = useCallback((text: string) => {
    setContent(text);
  }, []);

  // 生成二维码（内容非空时）
  const showQrcode = content.trim().length > 0;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="glass-heavy rounded-2xl p-8">
        {/* 标题 */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#7C3AED]/20 flex items-center justify-center">
            <Icon name="qrcode" size={24} color="#A78BFA" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{t('二维码生成器')}</h1>
            <p className="text-sm text-white/50">{t('输入文本或链接，快速生成二维码')}</p>
          </div>
        </div>

        {/* 输入区域 */}
        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              {t('输入内容')}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("输入网址、文本或任何内容...")}
              className="w-full h-32 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#7C3AED]/50 focus:bg-white/10 transition-all resize-none"
            />
            {/* 输入类型指示器 */}
            {inputType !== 'empty' && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-white/40">{t('类型:')}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  inputType === 'url'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {inputType === 'url' ? t('链接') : t('文本')}
                </span>
                <span className="text-xs text-white/30">
                  {content.length} {t('字符')}
                </span>
              </div>
            )}
          </div>

          {/* 快速填充按钮 */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-white/40 self-center">{t('快速填充:')}</span>
            <button
              className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors clickable"
              onClick={() => quickFill('https://github.com')}
            >
              GitHub
            </button>
            <button
              className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors clickable"
              onClick={() => quickFill('https://example.com')}
            >
              {t('示例网址')}
            </button>
            <button
              className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors clickable"
              onClick={() => quickFill('Hello, World!')}
            >
              {t('文本示例')}
            </button>
            <button
              className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors clickable"
              onClick={() => quickFill('WIFI:S:MyNetwork;T:WPA;P:password;;')}
            >
              {t('WiFi 配置')}
            </button>
          </div>
        </div>

        {/* 配置选项 */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* 尺寸选择 */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">
              {t('二维码尺寸')}
            </label>
            <div className="flex gap-2">
              {(['small', 'medium', 'large'] as SizePreset[]).map((preset) => (
                <button
                  key={preset}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    sizePreset === preset
                      ? 'bg-[#7C3AED] text-white shadow-lg shadow-[#7C3AED]/30'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  } clickable`}
                  onClick={() => setSizePreset(preset)}
                >
                  {preset === 'small' ? t('小') : preset === 'medium' ? t('中') : t('大')}
                </button>
              ))}
            </div>
            <div className="mt-2 text-xs text-white/30">
              {t('当前:')} {actualSize}px
            </div>
          </div>

          {/* 纠错级别 */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">
              {t('纠错级别')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {ERROR_LEVELS.map((level) => (
                <button
                  key={level.value}
                  className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                    errorLevel === level.value
                      ? 'bg-[#7C3AED] text-white shadow-lg shadow-[#7C3AED]/30'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  } clickable`}
                  onClick={() => setErrorLevel(level.value)}
                  title={level.description}
                >
                  {level.label}
                </button>
              ))}
            </div>
            <div className="mt-2 text-xs text-white/30">
              {ERROR_LEVELS.find(l => l.value === errorLevel)?.description}
            </div>
          </div>
        </div>

        {/* 边距选项 */}
        <div className="mb-8">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeMargin}
              onChange={(e) => setIncludeMargin(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#7C3AED] focus:ring-[#7C3AED]/50"
            />
            <span className="text-sm text-white/70">{t('添加边距')}</span>
          </label>
        </div>

        {/* 保存目录显示 */}
        <div className="mb-6 p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">{t('保存位置:')}</span>
            <span className="text-sm text-white/80">{saveDir}</span>
          </div>
        </div>

        {/* 二维码预览区域 */}
        <div className="flex flex-col items-center">
          {showQrcode ? (
            <>
              {/* 二维码显示 */}
              <div className="relative">
                <div className="p-6 bg-white rounded-2xl shadow-2xl">
                  <QRCodeCanvas
                    ref={canvasRef}
                    value={content}
                    size={actualSize}
                    level={errorLevel}
                    includeMargin={includeMargin}
                  />
                </div>
                {/* 尺寸标注 */}
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-white/30">
                  {actualSize} × {actualSize} px
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-4 mt-12">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-6 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-medium transition-all shadow-lg shadow-[#7C3AED]/30 clickable"
                >
                  <Icon name={copied ? 'check' : 'copy'} size={18} />
                  {copied ? t('已复制!') : t('复制到剪贴板')}
                </button>
                <button
                  onClick={saveToFile}
                  className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl font-medium transition-all clickable"
                >
                  <Icon name="download" size={18} />
                  {t('保存为文件')}
                </button>
              </div>
            </>
          ) : (
            /* 空状态 */
            <div className="py-16 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                <Icon name="qrcode" size={36} color="rgba(167, 139, 250, 0.2)" />
              </div>
              <p className="text-white/40 text-sm">{t('输入内容后将自动生成二维码')}</p>
            </div>
          )}
        </div>

        {/* 使用提示 */}
        <div className="mt-12 pt-6 border-t border-white/10">
          <h3 className="text-sm font-medium text-white/60 mb-3">{t('使用提示')}</h3>
          <ul className="space-y-2 text-xs text-white/40">
            <li>{t('• 较高的纠错级别可以在二维码部分损坏时仍能扫描')}</li>
            <li>{t('• WiFi 二维码格式: WIFI:S:网络名;T:加密方式;P:密码;;')}</li>
            <li>{t('• 保存位置: ~/Pictures/QRCodes/')}</li>
            <li>{t('• 支持纯前端复制和后端保存两种方式')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default QrcodeWidget;
