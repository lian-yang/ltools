import { useState, useEffect } from 'react';
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
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

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
        setDownloaded(true);
        setDownloading(false);
        // 显示重启提示
        if (ev.data.action === 'restart') {
          // 可以在这里自动重启或显示重启按钮
          setError(null);
        }
      }
    });

    return () => {
      unsubscribeUpdate();
      unsubscribeProgress();
      unsubscribeInstalled();
    };
  }, []);

  const handleDownload = async () => {
    if (!updateInfo) return;

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
      setDownloaded(true);
      setDownloading(false);

      // 自动安装
      await handleInstall(filePath);
    } catch (err) {
      console.error('Download failed:', err);
      setError(err instanceof Error ? err.message : String(err));
      setDownloading(false);
    }
  };

  const handleInstall = async (filePath: string) => {
    try {
      setError(null);
      await UpdateService.InstallUpdate(filePath);

      // 安装成功，应用会重启
      console.log('Update installed, application will restart...');
    } catch (err) {
      console.error('Installation failed:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDismiss = () => {
    if (!updateInfo?.mandatory) {
      setDismissed(true);
    }
  };

  const handleCheckUpdate = async () => {
    try {
      setError(null);
      const info = await UpdateService.CheckForUpdate();

      if (info) {
        setUpdateInfo(info);
        setDismissed(false);
      } else {
        // 已经是最新版本
        setError('您已经在使用最新版本！');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      console.error('Check update failed:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!updateInfo || dismissed) {
    // 手动检查更新按钮
    return (
      <div className="fixed bottom-4 right-4">
        <button
          onClick={handleCheckUpdate}
          className="p-2 rounded-lg glass hover:bg-white/10 transition-colors"
          title="检查更新"
        >
          <Icon name="refresh" className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 max-w-md bg-gradient-to-r from-purple-500/90 to-pink-500/90 backdrop-blur-lg rounded-xl shadow-2xl text-white p-4 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Icon name="download" className="w-6 h-6 mt-1" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg mb-1">
            发现新版本 {updateInfo.version}
          </h3>

          <div className="text-sm text-white/80 mb-2">
            大小: {updateInfo.hasPatch
              ? `${(updateInfo.patchSize / 1024).toFixed(0)} KB (补丁)`
              : `${(updateInfo.size / 1024 / 1024).toFixed(1)} MB`
            }
          </div>

          {updateInfo.releaseNotes && (
            <div className="text-sm text-white/70 mb-3 max-h-32 overflow-y-auto">
              <pre className="whitespace-pre-wrap font-sans">
                {updateInfo.releaseNotes}
              </pre>
            </div>
          )}

          {error && (
            <div className="bg-red-500/50 text-white px-3 py-2 rounded mb-3 text-sm">
              {error}
            </div>
          )}

          {downloading && (
            <div className="mb-3">
              <div className="bg-white/20 rounded-full h-2 mb-1">
                <div
                  className="bg-white h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <div className="text-sm text-white/80">
                下载中... {downloadProgress}%
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {!downloading && !downloaded && (
              <>
                <button
                  onClick={handleDownload}
                  className="flex-1 bg-white text-purple-600 font-medium px-4 py-2 rounded-lg hover:bg-white/90 transition-colors"
                >
                  立即下载
                </button>

                {!updateInfo.mandatory && (
                  <button
                    onClick={handleDismiss}
                    className="px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    稍后提醒
                  </button>
                )}
              </>
            )}

            {downloaded && (
              <button
                onClick={() => handleInstall}
                className="flex-1 bg-white text-purple-600 font-medium px-4 py-2 rounded-lg hover:bg-white/90 transition-colors"
              >
                安装并重启
              </button>
            )}
          </div>
        </div>

        {!updateInfo.mandatory && !downloading && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-white/60 hover:text-white transition-colors"
          >
            <Icon name="x" className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
