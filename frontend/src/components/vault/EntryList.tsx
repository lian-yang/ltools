import React, { useState } from 'react';
import { VaultEntry } from '../../../bindings/ltools/plugins/vault/models';
import EntryCard from './EntryCard';
import { Icon } from '../Icon';
import { t } from '@/i18n';

interface EntryListProps {
  entries: VaultEntry[];
  onEdit: (entry: VaultEntry) => void;
  onDelete: (id: string) => void;
}

const EntryList: React.FC<EntryListProps> = ({ entries, onEdit, onDelete }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // 按收藏和更新时间排序
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.favorite !== b.favorite) {
      return a.favorite ? -1 : 1;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Icon name="key" className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">{t('暂无密码条目')}</h3>
          <p className="text-sm text-gray-500">
            {t('点击右上角的"新建"按钮添加您的第一个密码')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      {/* 视图切换 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">
          {t('共')} {entries.length} {t('个条目')}
        </p>
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
            }`}
            title={t("列表视图")}
          >
            <Icon name="list" className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
            }`}
            title={t("网格视图")}
          >
            <Icon name="grid" className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 条目列表 */}
      {viewMode === 'list' ? (
        <div className="space-y-2">
          {sortedEntries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              mode="list"
              onEdit={() => onEdit(entry)}
              onDelete={() => onDelete(entry.id)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedEntries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              mode="grid"
              onEdit={() => onEdit(entry)}
              onDelete={() => onDelete(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default EntryList;
