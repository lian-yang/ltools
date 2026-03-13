import { useState } from 'react';
import { Icon } from '../Icon';
import { useToast } from '../../hooks/useToast';

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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="glass-heavy rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-[#FAF5FF] flex items-center gap-2">
            <Icon name="check-circle" className="w-5 h-5 text-green-400" />
            Favicon 生成成功
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Icon name="x-mark" className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-[#A78BFA]/10 border border-[#A78BFA]/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Icon name="information-circle" className="w-5 h-5 text-[#A78BFA] flex-shrink-0 mt-0.5" />
              <div className="text-sm text-[#A78BFA]/80">
                <p className="mb-2">已生成以下文件：</p>
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-white/60">
                将以下代码添加到您的 HTML &lt;head&gt; 标签中：
              </label>
              <button
                onClick={handleCopy}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  copied
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white'
                }`}
              >
                <Icon name={copied ? 'check' : 'clipboard'} className="w-4 h-4" />
                {copied ? '已复制' : '复制代码'}
              </button>
            </div>
            <div className="bg-black/40 rounded-lg p-4 font-mono text-sm text-white/80 overflow-x-auto">
              <pre className="whitespace-pre-wrap break-all">{htmlCode}</pre>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Icon name="information-circle" className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-white/60">
                <p className="font-medium text-white/70 mb-1">使用提示：</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>将生成的文件上传到您网站的根目录</li>
                  <li>确保文件可通过根路径访问（例如：/favicon.ico）</li>
                  <li>site.webmanifest 文件用于 PWA 应用</li>
                  <li>清除浏览器缓存以查看更新后的 favicon</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
