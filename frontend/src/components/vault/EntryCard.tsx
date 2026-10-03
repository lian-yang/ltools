import React, { useState } from 'react';
import { VaultEntry } from '../../../bindings/ltools/plugins/vault/models';
import { Icon } from '../Icon';
import { Badge } from '../ui';

interface EntryCardProps {
  entry: VaultEntry;
  mode: 'list' | 'grid';
  onEdit: () => void;
  onDelete: () => void;
}

const EntryCard: React.FC<EntryCardProps> = ({ entry, mode, onEdit, onDelete }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<'username' | 'password' | null>(null);

  // 获取网站首字母
  const getInitial = () => {
    if (entry.website) {
      try {
        const url = new URL(entry.website.startsWith('http') ? entry.website : `https://${entry.website}`);
        return url.hostname.charAt(0).toUpperCase();
      } catch {
        return entry.title.charAt(0).toUpperCase();
      }
    }
    return entry.title.charAt(0).toUpperCase();
  };

  // 复制到剪贴板
  const copyToClipboard = async (text: string, field: 'username' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const initialTile = (size: 'sm' | 'lg') => (
    <div
      className={`flex shrink-0 items-center justify-center rounded-[8px] border border-hairline bg-surface-3 ${
        size === 'lg' ? 'h-11 w-11 text-[15px]' : 'h-10 w-10 text-[14px]'
      } font-semibold text-text-2`}
    >
      {getInitial()}
    </div>
  );

  if (mode === 'list') {
    return (
      <div className="card card-hover group flex items-center gap-3 px-3.5 py-3">
        {initialTile('sm')}

        {/* 信息 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[13px] font-medium text-text-1">{entry.title}</h3>
            {entry.favorite && (
              <Icon name="star" size={12} color="var(--color-warning-text)" className="shrink-0" />
            )}
          </div>
          <p className="truncate text-[11.5px] text-text-3 select-text">{entry.username}</p>
        </div>

        {/* 分类标签 */}
        {entry.category && <Badge tone="neutral">{entry.category}</Badge>}

        {/* 操作按钮 */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button
            onClick={() => copyToClipboard(entry.username, 'username')}
            className="icon-btn icon-btn-sm"
            title="复制用户名"
          >
            <Icon name={copied === 'username' ? 'check' : 'user'} size={13} color={copied === 'username' ? 'var(--color-success-text)' : undefined} />
          </button>
          <button
            onClick={() => copyToClipboard(entry.password, 'password')}
            className="icon-btn icon-btn-sm"
            title="复制密码"
          >
            <Icon name={copied === 'password' ? 'check' : 'key'} size={13} color={copied === 'password' ? 'var(--color-success-text)' : undefined} />
          </button>
          <button onClick={onEdit} className="icon-btn icon-btn-sm" title="编辑">
            <Icon name="pencil" size={13} />
          </button>
          <button onClick={onDelete} className="icon-btn icon-btn-sm" title="删除" style={{ color: 'var(--color-error-text)' }}>
            <Icon name="trash" size={13} />
          </button>
        </div>
      </div>
    );
  }

  // 网格视图
  return (
    <div className="card card-hover group p-4">
      {/* 头部 */}
      <div className="mb-3 flex items-start justify-between">
        {initialTile('lg')}
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button onClick={onEdit} className="icon-btn icon-btn-sm" title="编辑">
            <Icon name="pencil" size={13} />
          </button>
          <button onClick={onDelete} className="icon-btn icon-btn-sm" title="删除" style={{ color: 'var(--color-error-text)' }}>
            <Icon name="trash" size={13} />
          </button>
        </div>
      </div>

      {/* 标题 */}
      <div className="mb-2.5 flex items-center gap-1.5">
        <h3 className="truncate text-[13px] font-medium text-text-1">{entry.title}</h3>
        {entry.favorite && (
          <Icon name="star" size={12} color="var(--color-warning-text)" className="shrink-0" />
        )}
      </div>

      {/* 用户名 */}
      <div className="mb-2">
        <p className="mb-0.5 text-[10.5px] text-text-4">用户名</p>
        <div className="flex items-center gap-1.5">
          <p className="min-w-0 flex-1 truncate text-[12px] text-text-2 select-text">{entry.username}</p>
          <button
            onClick={() => copyToClipboard(entry.username, 'username')}
            className="icon-btn icon-btn-sm"
            title="复制用户名"
          >
            <Icon name={copied === 'username' ? 'check' : 'copy'} size={12} color={copied === 'username' ? 'var(--color-success-text)' : undefined} />
          </button>
        </div>
      </div>

      {/* 密码 */}
      <div className="mb-3">
        <p className="mb-0.5 text-[10.5px] text-text-4">密码</p>
        <div className="flex items-center gap-1.5">
          <p className="min-w-0 flex-1 truncate font-mono text-[12px] text-text-2 select-text">
            {showPassword ? entry.password : '••••••••'}
          </p>
          <button
            onClick={() => setShowPassword(!showPassword)}
            className="icon-btn icon-btn-sm"
            title={showPassword ? '隐藏密码' : '显示密码'}
          >
            <Icon name={showPassword ? 'eye-off' : 'eye'} size={12} />
          </button>
          <button
            onClick={() => copyToClipboard(entry.password, 'password')}
            className="icon-btn icon-btn-sm"
            title="复制密码"
          >
            <Icon name={copied === 'password' ? 'check' : 'copy'} size={12} color={copied === 'password' ? 'var(--color-success-text)' : undefined} />
          </button>
        </div>
      </div>

      {/* 分类和网站 */}
      <div className="flex items-center justify-between gap-2">
        {entry.category ? (
          <Badge tone="neutral">{entry.category}</Badge>
        ) : (
          <span />
        )}
        {entry.website && (
          <a
            href={entry.website.startsWith('http') ? entry.website : `https://${entry.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-[120px] truncate text-[11px] text-accent-text hover:underline"
          >
            {entry.website}
          </a>
        )}
      </div>
    </div>
  );
};

export default EntryCard;
