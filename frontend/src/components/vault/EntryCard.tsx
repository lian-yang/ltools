import React, { useState } from 'react';
import { VaultEntry } from '../../../bindings/ltools/plugins/vault/models';
import { Icon } from '../Icon';
import { t } from '@/i18n';

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

  // 获取分类颜色
  const getCategoryColor = (category?: string) => {
    const colors: Record<string, string> = {
      '社交': 'bg-blue-500',
      '工作': 'bg-green-500',
      '金融': 'bg-yellow-500',
      '购物': 'bg-pink-500',
      '其他': 'bg-gray-500',
    };
    return colors[category || ''] || 'bg-purple-500';
  };

  if (mode === 'list') {
    return (
      <div className="group flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10
                    rounded-lg transition-colors border border-transparent hover:border-white/10">
        {/* 图标 */}
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
          <span className="text-primary font-bold">{getInitial()}</span>
        </div>

        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-white truncate">{entry.title}</h3>
            {entry.favorite && (
              <Icon name="star" className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-gray-400 truncate">{entry.username}</p>
        </div>

        {/* 分类标签 */}
        {entry.category && (
          <span className={`px-2 py-1 text-xs rounded-full text-white ${getCategoryColor(entry.category)}`}>
            {t(entry.category)}
          </span>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => copyToClipboard(entry.username, 'username')}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title={t("复制用户名")}
          >
            {copied === 'username' ? (
              <Icon name="check" className="w-4 h-4 text-green-500" />
            ) : (
              <Icon name="user" className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <button
            onClick={() => copyToClipboard(entry.password, 'password')}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title={t("复制密码")}
          >
            {copied === 'password' ? (
              <Icon name="check" className="w-4 h-4 text-green-500" />
            ) : (
              <Icon name="key" className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <button
            onClick={onEdit}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title={t("编辑")}
          >
            <Icon name="edit" className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title={t("删除")}
          >
            <Icon name="trash" className="w-4 h-4 text-gray-400 hover:text-red-400" />
          </button>
        </div>
      </div>
    );
  }

  // 网格视图
  return (
    <div className="group p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors
                  border border-transparent hover:border-white/10">
      {/* 头部 */}
      <div className="flex items-start justify-between mb-3">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
          <span className="text-primary font-bold text-lg">{getInitial()}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Icon name="edit" className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Icon name="trash" className="w-4 h-4 text-gray-400 hover:text-red-400" />
          </button>
        </div>
      </div>

      {/* 标题 */}
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-medium text-white truncate">{entry.title}</h3>
        {entry.favorite && (
          <Icon name="star" className="w-4 h-4 text-yellow-500 flex-shrink-0" />
        )}
      </div>

      {/* 用户名 */}
      <div className="mb-2">
        <p className="text-xs text-gray-500 mb-1">{t('用户名')}</p>
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-300 truncate flex-1">{entry.username}</p>
          <button
            onClick={() => copyToClipboard(entry.username, 'username')}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            {copied === 'username' ? (
              <Icon name="check" className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Icon name="copy" className="w-3.5 h-3.5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* 密码 */}
      <div className="mb-3">
        <p className="text-xs text-gray-500 mb-1">{t('密码')}</p>
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-300 flex-1 font-mono">
            {showPassword ? entry.password : '••••••••'}
          </p>
          <button
            onClick={() => setShowPassword(!showPassword)}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <Icon name={showPassword ? 'eye-off' : 'eye'} className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button
            onClick={() => copyToClipboard(entry.password, 'password')}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            {copied === 'password' ? (
              <Icon name="check" className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Icon name="copy" className="w-3.5 h-3.5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* 分类和网站 */}
      <div className="flex items-center justify-between">
        {entry.category && (
          <span className={`px-2 py-0.5 text-xs rounded-full text-white ${getCategoryColor(entry.category)}`}>
            {t(entry.category)}
          </span>
        )}
        {entry.website && (
          <a
            href={entry.website.startsWith('http') ? entry.website : `https://${entry.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline truncate max-w-[120px]"
          >
            {entry.website}
          </a>
        )}
      </div>
    </div>
  );
};

export default EntryCard;
