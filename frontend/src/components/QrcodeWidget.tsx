import { useState, useRef, useCallback, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Icon } from './Icon';
import { useToast } from '../hooks/useToast';
import { Badge, Button, Card, EmptyState, Field, SectionTitle, Segmented, Textarea, Toggle } from './ui';
import * as QrcodeService from '../../bindings/ltools/plugins/qrcode/qrcodeservice';

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
  { value: 'L', label: 'L', description: '7% 容错' },
  { value: 'M', label: 'M', description: '15% 容错' },
  { value: 'Q', label: 'Q', description: '25% 容错' },
  { value: 'H', label: 'H', description: '30% 容错' },
];

const QUICK_FILLS: Array<{ label: string; value: string }> = [
  { label: 'GitHub', value: 'https://github.com' },
  { label: '示例网址', value: 'https://example.com' },
  { label: '文本示例', value: 'Hello, World!' },
  { label: 'WiFi 配置', value: 'WIFI:S:MyNetwork;T:WPA;P:password;;' },
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
  const copiedTimerRef = useRef<number | null>(null);

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

  // 卸载时清理复制状态计时器
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
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
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
      success('二维码已复制到剪贴板');
    } catch (err) {
      console.error('复制失败:', err);
      showError('复制失败: ' + (err as Error).message);
    }
  }, [success, showError]);

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
      success(`二维码已保存到:\n${savedPath}`);
    } catch (err) {
      console.error('保存失败:', err);
      showError('保存失败: ' + (err as Error).message);
    }
  }, [success, showError]);

  // 常用内容快速填充
  const quickFill = useCallback((text: string) => {
    setContent(text);
  }, []);

  // 生成二维码（内容非空时）
  const showQrcode = content.trim().length > 0;

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* 左列：输入与参数 */}
      <div className="min-w-0 space-y-5">
        {/* 输入内容 */}
        <Card className="p-4">
          <SectionTitle
            title="输入内容"
            className="mb-3"
            action={
              showQrcode ? (
                <span className="tnum text-[11.5px] text-text-4">{content.length} 字符</span>
              ) : undefined
            }
          />
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="输入网址、文本或任何内容..."
            className="h-28 resize-none"
          />
          {inputType !== 'empty' && (
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-[11.5px] text-text-4">类型</span>
              {inputType === 'url' ? (
                <Badge tone="accent">链接</Badge>
              ) : (
                <Badge tone="neutral">文本</Badge>
              )}
            </div>
          )}

          {/* 快速填充 */}
          <div className="hairline-t mt-3.5 flex flex-wrap items-center gap-1.5 pt-3.5">
            <span className="mr-1 text-[11.5px] text-text-4">快速填充</span>
            {QUICK_FILLS.map((fill) => (
              <Button key={fill.label} variant="ghost" size="sm" onClick={() => quickFill(fill.value)}>
                {fill.label}
              </Button>
            ))}
          </div>
        </Card>

        {/* 参数 */}
        <Card className="p-4">
          <SectionTitle title="生成参数" className="mb-3" />

          {/* 尺寸 */}
          <div className="mb-1">
            <Field label="二维码尺寸">
              <Segmented<'small' | 'medium' | 'large'>
                options={[
                  { value: 'small', label: '小' },
                  { value: 'medium', label: '中' },
                  { value: 'large', label: '大' },
                ]}
                value={sizePreset === 'custom' ? 'medium' : sizePreset}
                onChange={setSizePreset}
              />
            </Field>
            <p className="tnum field-hint">{SIZE_PRESETS[sizePreset]} px</p>
          </div>

          {/* 纠错级别 */}
          <div className="mb-1 mt-4">
            <Field label="纠错级别">
              <Segmented<ErrorCorrectionLevel>
                options={ERROR_LEVELS.map((level) => ({
                  value: level.value,
                  label: level.label,
                }))}
                value={errorLevel}
                onChange={setErrorLevel}
              />
            </Field>
            <p className="field-hint">
              {ERROR_LEVELS.find((l) => l.value === errorLevel)?.description}
            </p>
          </div>

          {/* 边距 */}
          <div className="hairline-t mt-4">
            <Field horizontal label="添加边距" hint="在二维码四周保留空白区域，便于扫描">
              <Toggle checked={includeMargin} onChange={setIncludeMargin} label="添加边距" />
            </Field>
          </div>
        </Card>

        {/* 保存位置 */}
        <div className="card-inset flex items-center gap-2.5 px-4 py-3">
          <Icon name="folder" size={15} color="var(--color-text-3)" className="shrink-0" />
          <span className="shrink-0 text-[12px] text-text-3">保存位置</span>
          <span className="min-w-0 flex-1 truncate select-text font-mono text-[12px] text-text-2" title={saveDir}>
            {saveDir}
          </span>
        </div>
      </div>

      {/* 右列：预览 */}
      <div className="min-w-0 space-y-5">
        <Card className="p-4">
          <SectionTitle title="预览" className="mb-3" />
          {showQrcode ? (
            <>
              {/* 二维码白底容器：12px 内边距，圆角 */}
              <div className="flex justify-center">
                <div className="max-w-full rounded-[9px] bg-white p-3">
                  <QRCodeCanvas
                    ref={canvasRef}
                    value={content}
                    size={actualSize}
                    level={errorLevel}
                    includeMargin={includeMargin}
                    style={{ width: '100%', height: 'auto', maxWidth: actualSize }}
                  />
                </div>
              </div>
              <p className="tnum mt-3 text-center text-[11.5px] text-text-4">
                {actualSize} × {actualSize} px
              </p>

              {/* 操作按钮 */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  variant="primary"
                  icon={copied ? 'check' : 'copy'}
                  onClick={copyToClipboard}
                >
                  {copied ? '已复制' : '复制'}
                </Button>
                <Button variant="secondary" icon="download" onClick={saveToFile}>
                  保存
                </Button>
              </div>
            </>
          ) : (
            <EmptyState
              icon="qrcode"
              title="尚未生成"
              description="输入内容后将自动生成二维码"
              className="py-10"
            />
          )}
        </Card>

        {/* 使用提示 */}
        <Card inset className="p-4">
          <SectionTitle title="使用提示" className="mb-2.5" />
          <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-text-3">
            <li>较高的纠错级别可以在二维码部分损坏时仍能扫描</li>
            <li>WiFi 二维码格式：WIFI:S:网络名;T:加密方式;P:密码;;</li>
            <li>支持前端复制与后端保存两种方式</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

export default QrcodeWidget;
