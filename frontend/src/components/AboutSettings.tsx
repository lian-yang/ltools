import { useState, useEffect, useRef } from 'react';
import { Browser } from '@wailsio/runtime';
import * as UpdateService from '../../bindings/ltools/internal/update/service';
import { Icon } from './Icon';
import { Badge, Button, PageHeader, SectionTitle } from './ui';

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

  // 记录提示消息的定时器,卸载时清理
  const messageTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      messageTimersRef.current.forEach(clearTimeout);
      messageTimersRef.current = [];
    };
  }, []);

  // 从后端获取应用版本
  useEffect(() => {
    let alive = true;
    UpdateService.GetCurrentVersion()
      .then(version => {
        if (alive) setAppVersion(version);
      })
      .catch(err => {
        console.error('Failed to get app version:', err);
        if (alive) setAppVersion('未知');
      });
    return () => {
      alive = false;
    };
  }, []);

  const showUpdateMessage = (message: string) => {
    setUpdateMessage(message);
    const timer = setTimeout(() => setUpdateMessage(null), 3000);
    messageTimersRef.current.push(timer);
  };

  const handleCheckUpdate = async () => {
    setChecking(true);
    setUpdateMessage(null);

    try {
      const info = await UpdateService.CheckForUpdate();

      if (info) {
        // 更新信息会通过 "update:available" 事件发送到 UpdateNotification 组件显示
        // 这里只显示一个简短的提示
        showUpdateMessage('发现新版本，请查看更新通知');
      } else {
        showUpdateMessage('您已经在使用最新版本！');
      }
    } catch (error) {
      console.error('Check update failed:', error);
      showUpdateMessage('检查更新失败，请稍后重试');
    } finally {
      setChecking(false);
    }
  };

  const updateMessageTone = !updateMessage
    ? 'neutral'
    : updateMessage.includes('失败')
      ? 'error'
      : updateMessage.includes('最新版本')
        ? 'success'
        : 'accent';

  return (
    <div className="animate-fade-in">
      <PageHeader title="关于" description="了解 LTools 的版本信息和技术栈" />

      {/* 应用信息 */}
      <div className="card-inset flex items-start gap-4 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border border-hairline bg-surface-2">
          <Icon name="cube" size={24} className="text-text-2" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-text-1">LTools</h3>
            <span className="text-[11.5px] text-text-3">多功能开发工具集</span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-text-2">
            LTools 是一个基于 Wails v3 的插件化跨平台桌面工具箱应用。
            通过插件架构提供统一的工具集中心，面向开发者和高级用户，
            支持全局搜索和快捷键快速访问工具。
          </p>
        </div>
      </div>

      {/* 版本信息 */}
      <SectionTitle title="版本信息" className="mb-2 mt-5" />
      <div className="card-inset px-4">
        <VersionRow label="应用版本" value={`v${appVersion}`} separated />
        <VersionRow label="Go" value={goVersion} separated />
        <VersionRow label="Wails" value={wailsVersion} separated />
        <VersionRow label="React" value={reactVersion} separated={false} />

        {/* 检查更新 */}
        <div className="hairline-t flex items-center justify-between gap-3 pt-3 pb-1">
          <div className="min-w-0">
            {updateMessage && (
              <Badge tone={updateMessageTone}>{updateMessage}</Badge>
            )}
          </div>
          <Button
            variant="primary"
            icon="refresh"
            loading={checking}
            onClick={handleCheckUpdate}
            disabled={checking}
          >
            {checking ? '检查中...' : '检查更新'}
          </Button>
        </div>
      </div>

      {/* 技术栈 */}
      <SectionTitle title="技术栈" className="mb-2 mt-5" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <TechBadge name="Go" description="后端框架" />
        <TechBadge name="Wails v3" description="桌面框架" />
        <TechBadge name="React" description="前端框架" />
        <TechBadge name="TypeScript" description="类型安全" />
        <TechBadge name="Vite" description="构建工具" />
        <TechBadge name="TailwindCSS" description="样式框架" />
      </div>

      {/* 相关链接 */}
      <SectionTitle title="相关链接" className="mb-2 mt-5" />
      <div className="card-inset p-1.5">
        <LinkRow
          label="Wails 官方文档"
          href="https://v3.wails.io/"
        />
        <LinkRow
          label="GitHub 仓库"
          href="https://github.com/lian-yang/ltools"
        />
        <LinkRow
          label="问题反馈"
          href="https://github.com/lian-yang/ltools/issues"
        />
      </div>

      {/* 版权信息 */}
      <p className="py-4 text-center text-[11.5px] text-text-4">
        © 2025 LTools. All rights reserved.
      </p>
    </div>
  );
}

/**
 * 版本信息行
 */
function VersionRow({ label, value, separated }: { label: string; value: string; separated: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2.5 ${separated ? 'hairline-b' : ''}`}>
      <span className="text-[12px] text-text-3">{label}</span>
      <span className="tnum truncate font-mono text-[12px] text-text-1">{value}</span>
    </div>
  );
}

/**
 * 技术标签
 */
function TechBadge({ name, description }: { name: string; description: string }) {
  return (
    <div className="card-inset p-3">
      <p className="text-[12.5px] font-medium text-text-1">{name}</p>
      <p className="mt-0.5 text-[11.5px] text-text-3">{description}</p>
    </div>
  );
}

/**
 * 链接行
 */
function LinkRow({ label, href }: { label: string; href: string }) {
  const handleClick = async () => {
    await Browser.OpenURL(href);
  };

  return (
    <button
      onClick={handleClick}
      className="row row-clickable w-full text-left"
    >
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-2">{label}</span>
      <Icon name="external-link" size={13} className="shrink-0 text-text-4" />
    </button>
  );
}
