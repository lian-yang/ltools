import { useState } from 'react';
import { Icon } from '../Icon';
import { useToast } from '../../hooks/useToast';
import { Button, Modal } from '../ui';

interface FaviconResultDialogProps {
  visible: boolean;
  onClose: () => void;
}

export function FaviconResultDialog({ visible, onClose }: FaviconResultDialogProps): JSX.Element | null {
  const { success } = useToast();
  const [copied, setCopied] = useState(false);

  if (!visible) return null;

  const htmlCode = `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="manifest" href="/site.webmanifest">`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(htmlCode);
      setCopied(true);
      success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <Modal
      open={visible}
      onClose={onClose}
      width={560}
      title={
        <span className="flex items-center gap-2">
          <Icon name="check-circle" size={15} className="text-success-text" />
          Favicon 生成成功
        </span>
      }
      footer={
        <Button variant="ghost" onClick={onClose}>
          关闭
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="card-inset p-3">
          <div className="flex items-start gap-2.5">
            <Icon name="information-circle" size={15} className="mt-0.5 shrink-0 text-text-3" />
            <div className="min-w-0 text-[12px] leading-relaxed text-text-3">
              <p className="mb-1.5">已生成以下文件：</p>
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

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-text-2">
              将以下代码添加到您的 HTML &lt;head&gt; 标签中：
            </span>
            <Button
              size="sm"
              variant={copied ? 'secondary' : 'primary'}
              icon={copied ? 'check' : 'clipboard'}
              onClick={handleCopy}
            >
              {copied ? '已复制' : '复制代码'}
            </Button>
          </div>
          <div className="selectable overflow-x-auto rounded-[6px] border border-hairline bg-surface-1 p-3">
            <pre className="whitespace-pre-wrap break-all font-mono text-[11.5px] leading-relaxed text-text-2">
              {htmlCode}
            </pre>
          </div>
        </div>

        <div className="card-inset p-3">
          <div className="flex items-start gap-2.5">
            <Icon name="information-circle" size={14} className="mt-0.5 shrink-0 text-text-3" />
            <div className="min-w-0 text-[11.5px] leading-relaxed text-text-3">
              <p className="mb-1 font-medium text-text-2">使用提示：</p>
              <ul className="list-inside list-disc space-y-0.5">
                <li>将生成的文件上传到您网站的根目录</li>
                <li>确保文件可通过根路径访问（例如：/favicon.ico）</li>
                <li>site.webmanifest 文件用于 PWA 应用</li>
                <li>清除浏览器缓存以查看更新后的 favicon</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
