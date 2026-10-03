import { useState, useEffect, useCallback } from 'react';
import { Events } from '@wailsio/runtime';
import * as UpdateService from '../../bindings/ltools/internal/update/service';
import { Icon } from '../components/Icon';

interface UpdateInfo {
  version: string;
  size: number;
  patchSize: number;
  hasPatch: boolean;
  releaseDate: string;
  releaseNotes: string;
  mandatory: boolean;
  downloadUrl: string;
  checksum: string;
}

export function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const [downloadedFilePath, setDownloadedFilePath] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // 先定义所有回调函数
  const handleRestart = useCallback(async () => {
    try {
      setError(null);
      await UpdateService.RestartApp();
    } catch (err) {
      console.error('Restart failed:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleInstall = useCallback(async () => {
    if (!downloadedFilePath) {
      setError('安装失败：文件路径不存在');
      return;
    }

    try {
      setInstalling(true);
      setError(null);
      await UpdateService.InstallUpdate(downloadedFilePath);

      // macOS/Linux: 安装成功后会发送 update:installed 事件
      // Windows: 安装程序会自动退出应用
      console.log('Update installation started...');
    } catch (err) {
      console.error('Installation failed:', err);
      setInstalling(false);
      setDownloaded(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [downloadedFilePath]);

  const handleDownload = useCallback(async () => {
    if (!updateInfo) return;

    // 参数验证
    if (!updateInfo.downloadUrl || !updateInfo.checksum) {
      setError('更新信息不完整，请稍后重试');
      return;
    }

    setDownloading(true);
    setDownloaded(false);
    setDownloadProgress(0);
    setError(null);

    try {
      const filePath = await UpdateService.DownloadUpdate(
        updateInfo.downloadUrl,
        updateInfo.checksum
      );

      console.log('Download completed:', filePath);
      setDownloadedFilePath(filePath); // 保存文件路径
      setDownloaded(true);
      setDownloading(false);
    } catch (err) {
      console.error('Download failed:', err);
      setError(err instanceof Error ? err.message : String(err));
      setDownloading(false);
    }
  }, [updateInfo]);

  const handleDismiss = useCallback(() => {
    if (!updateInfo?.mandatory) {
      setDismissed(true);
    }
  }, [updateInfo?.mandatory]);

  // 然后使用 useEffect
  useEffect(() => {
    // 监听更新可用事件
    const unsubscribeUpdate = Events.On('update:available', (ev) => {
      console.log('Update available:', ev.data);
      if (ev.data) {
        setUpdateInfo(ev.data);
        setDismissed(false);
      }
    });

    // 监听下载进度事件
    const unsubscribeProgress = Events.On('update:progress', (ev) => {
      console.log('Download progress:', ev.data);
      if (ev.data !== null && ev.data !== undefined) {
        setDownloadProgress(ev.data);
      }
    });

    // 监听安装完成事件
    const unsubscribeInstalled = Events.On('update:installed', (ev) => {
      console.log('Update installed:', ev.data);
      if (ev.data) {
        setInstalling(false);
        setDownloaded(false);

        // 显示重启提示
        if (ev.data.action === 'restart') {
          // 自动重启应用
          handleRestart();
        }
      }
    });

    return () => {
      unsubscribeUpdate();
      unsubscribeProgress();
      unsubscribeInstalled();
    };
  }, [handleRestart]);

  if (!updateInfo || dismissed) {
    // 没有更新信息，不显示任何内容
    // 用户应该通过设置页面手动检查更新
    return null;
  }

  return (
    <div
      className="animate-slide-up fixed right-4 bottom-4 z-[950] w-[340px] rounded-[10px] p-4"
      style={{
        background: 'var(--color-surface-3)',
        border: '1px solid var(--color-hairline-strong)',
        boxShadow: 'var(--shadow-pop)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-accent-subtle">
          <Icon name="download" size={15} color="var(--color-accent-text)" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-[13.5px] font-semibold text-text-1">
            发现新版本 {updateInfo.version}
          </h3>

          <div className="mt-0.5 text-[11.5px] text-text-3 tnum">
            大小:{updateInfo.hasPatch
              ? `${(updateInfo.patchSize / 1024).toFixed(0)} KB(补丁)`
              : `${(updateInfo.size / 1024 / 1024).toFixed(1)} MB`
            }
          </div>

          {updateInfo.releaseNotes && (
            <div className="mt-2 max-h-28 overflow-y-auto text-[11.5px] leading-relaxed text-text-2">
              <pre className="whitespace-pre-wrap font-sans">{updateInfo.releaseNotes}</pre>
            </div>
          )}

          {error && (
            <div className="mt-2 rounded-[6px] px-2.5 py-1.5 text-[11.5px]" style={{ background: 'rgba(255,69,58,0.12)', color: 'var(--color-error-text)' }}>
              {error}
            </div>
          )}

          {downloading && (
            <div className="mt-3">
              <div className="progress">
                <div className="progress-bar" style={{ width: `${downloadProgress}%` }} />
              </div>
              <div className="mt-1.5 text-[11px] text-text-3 tnum">下载中… {downloadProgress}%</div>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            {!downloading && !downloaded && !installing && (
              <>
                <button onClick={handleDownload} className="btn btn-primary flex-1">
                  立即下载
                </button>
                {!updateInfo.mandatory && (
                  <button onClick={handleDismiss} className="btn btn-ghost">
                    稍后提醒
                  </button>
                )}
              </>
            )}

            {downloaded && !installing && (
              <>
                <button onClick={handleInstall} className="btn btn-primary flex-1">
                  安装更新
                </button>
                {!updateInfo.mandatory && (
                  <button onClick={handleDismiss} className="btn btn-ghost">
                    稍后安装
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {!updateInfo.mandatory && !downloading && (
          <button onClick={handleDismiss} className="icon-btn icon-btn-sm shrink-0" aria-label="关闭">
            <Icon name="close" size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
