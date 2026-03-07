import { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { Browser } from '@wailsio/runtime';
import * as UpdateService from '../../bindings/ltools/internal/update/service';

/**
 * 关于页面组件
 * 显示应用版本信息、技术栈和相关链接
 */
export function AboutSettings() {
  const [checking, setChecking] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>('加载中...');

  const goVersion = '1.25+';
  const wailsVersion = 'v3 (alpha)';
  const reactVersion = '18.2';

  // 从后端获取应用版本
  useEffect(() => {
    UpdateService.GetCurrentVersion()
      .then(version => setAppVersion(version))
      .catch(err => {
        console.error('Failed to get app version:', err);
        setAppVersion('未知');
      });
  }, []);

  const handleCheckUpdate = async () => {
    setChecking(true);
    setUpdateMessage(null);

    try {
      const info = await UpdateService.CheckForUpdate();

      if (info) {
        // 更新信息会通过 "update:available" 事件发送到 UpdateNotification 组件显示
        // 这里只显示一个简短的提示
        setUpdateMessage('发现新版本，请查看更新通知');
        setTimeout(() => setUpdateMessage(null), 3000);
      } else {
        setUpdateMessage('您已经在使用最新版本！');
        setTimeout(() => setUpdateMessage(null), 3000);
      }
    } catch (error) {
      console.error('Check update failed:', error);
      setUpdateMessage('检查更新失败，请稍后重试');
      setTimeout(() => setUpdateMessage(null), 3000);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Icon name="information-circle" size={20} color="#A78BFA" />
          关于
        </h2>
        <p className="text-white/50 text-sm mt-1">
          了解 LTools 的版本信息和技术栈
        </p>
      </div>

      {/* 应用信息卡片 */}
      <div className="glass-light rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
            <Icon name="cube" size={32} color="white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">LTools</h3>
            <p className="text-white/50 text-sm">多功能开发工具集</p>
          </div>
        </div>

        <p className="text-white/60 text-sm leading-relaxed">
          LTools 是一个基于 Wails v3 的插件化跨平台桌面工具箱应用。
          通过插件架构提供统一的工具集中心，面向开发者和高级用户，
          支持全局搜索和快捷键快速访问工具。
        </p>
      </div>

      {/* 版本信息 */}
      <div className="glass-light rounded-xl p-5 space-y-4">
        <h3 className="text-white font-medium flex items-center gap-2">
          <Icon name="code" size={16} color="#A78BFA" />
          版本信息
        </h3>

        <div className="space-y-3">
          <VersionRow label="应用版本" value={`v${appVersion}`} />
          <VersionRow label="Go" value={goVersion} />
          <VersionRow label="Wails" value={wailsVersion} />
          <VersionRow label="React" value={reactVersion} />
        </div>

        {/* 检查更新按钮 */}
        <div className="pt-3 border-t border-white/5">
          <button
            onClick={handleCheckUpdate}
            disabled={checking}
            className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Icon
              name="refresh"
              size={16}
              color="white"
              className={checking ? 'animate-spin' : ''}
            />
            {checking ? '检查中...' : '检查更新'}
          </button>

          {updateMessage && (
            <div className={`mt-3 px-4 py-2.5 rounded-lg text-sm text-center ${
              updateMessage.includes('失败')
                ? 'bg-red-500/20 text-red-300'
                : updateMessage.includes('最新版本')
                  ? 'bg-green-500/20 text-green-300'
                  : 'bg-purple-500/20 text-purple-300'
            }`}>
              {updateMessage}
            </div>
          )}
        </div>
      </div>

      {/* 技术栈 */}
      <div className="glass-light rounded-xl p-5">
        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
          <Icon name="terminal" size={16} color="#A78BFA" />
          技术栈
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <TechBadge name="Go" description="后端框架" />
          <TechBadge name="Wails v3" description="桌面框架" />
          <TechBadge name="React" description="前端框架" />
          <TechBadge name="TypeScript" description="类型安全" />
          <TechBadge name="Vite" description="构建工具" />
          <TechBadge name="TailwindCSS" description="样式框架" />
        </div>
      </div>

      {/* 相关链接 */}
      <div className="glass-light rounded-xl p-5">
        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
          <Icon name="link" size={16} color="#A78BFA" />
          相关链接
        </h3>

        <div className="space-y-2">
          <LinkRow
            label="Wails 官方文档"
            href="https://v3.wails.io/"
            icon="external-link"
          />
          <LinkRow
            label="GitHub 仓库"
            href="https://github.com/lian-yang/ltools"
            icon="external-link"
          />
          <LinkRow
            label="问题反馈"
            href="https://github.com/lian-yang/ltools/issues"
            icon="external-link"
          />
        </div>
      </div>

      {/* 版权信息 */}
      <div className="text-center text-white/30 text-xs py-4">
        <p>© 2025 LTools. All rights reserved.</p>
      </div>
    </div>
  );
}

/**
 * 版本信息行
 */
function VersionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-white/50 text-sm">{label}</span>
      <span className="text-white text-sm font-mono">{value}</span>
    </div>
  );
}

/**
 * 技术标签
 */
function TechBadge({ name, description }: { name: string; description: string }) {
  return (
    <div className="bg-[#0D0F1A]/50 rounded-lg p-3 border border-white/5">
      <p className="text-white text-sm font-medium">{name}</p>
      <p className="text-white/40 text-xs mt-0.5">{description}</p>
    </div>
  );
}

/**
 * 链接行
 */
function LinkRow({ label, href, icon }: { label: string; href: string; icon: string }) {
  const handleClick = async () => {
    await Browser.OpenURL(href);
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors group w-full text-left"
    >
      <span className="text-white/70 text-sm group-hover:text-white">{label}</span>
      <Icon name={icon as any} size={14} color="currentColor" className="text-white/30 group-hover:text-[#A78BFA]" />
    </button>
  );
}
