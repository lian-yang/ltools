import React, { useState } from 'react';
import { Icon } from './Icon';
import * as Screenshot2Service from '../../bindings/ltools/plugins/screenshot2/screenshot2service';
import { t } from '@/i18n';

const Screenshot2Widget: React.FC = () => {
  const [isCapturing, setIsCapturing] = useState(false);

  const handleStartCapture = async () => {
    if (isCapturing) return;

    setIsCapturing(true);
    try {
      await Screenshot2Service.StartCapture();
    } catch (error) {
      console.error('[Screenshot2Widget] Failed to start capture:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass p-6 rounded-xl">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Icon name="camera" size={20} />
          {t('微信风格截图')}
        </h3>
        <p className="text-white/60 text-sm mb-4">
          {t('支持：')}
        </p>
        <ul className="text-white/50 text-sm space-y-1 mb-4">
          <li>{t('• 多显示器同时覆盖')}</li>
          <li>{t('• 拖拽选择截图区域')}</li>
          <li>{t('• 8 个调整手柄')}</li>
          <li>{t('• 标注工具（矩形、椭圆、箭头等）')}</li>
          <li>{t('• 一键复制到剪贴板')}</li>
        </ul>
        <button
          onClick={handleStartCapture}
          disabled={isCapturing}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
            isCapturing
              ? 'bg-white/10 text-white/50 cursor-not-allowed'
              : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white'
          }`}
        >
          {isCapturing ? t('正在截图...') : t('开始截图 (Cmd+Shift+S)')}
        </button>
      </div>
    </div>
  );
};

export default Screenshot2Widget;
