import React, { useState } from 'react';
import { VaultEntry } from '../../../bindings/ltools/plugins/vault/models';
import EntryCard from './EntryCard';
import { Icon } from '../Icon';
import { EmptyState, Segmented } from '../ui';

interface EntryListProps {
  entries: VaultEntry[];
  onEdit: (entry: VaultEntry) => void;
  onDelete: (id: string) => void;
}

const EntryList: React.FC<EntryListProps> = ({ entries, onEdit, onDelete }) => {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // 按收藏和更新时间排序
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.favorite !== b.favorite) {
      return a.favorite ? -1 : 1;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  if (entries.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon="key"
          title="暂无密码条目"
          description='点击右上角的"新建"按钮添加您的第一个密码'
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      {/* 工具行 */}
      <div className="mb-3 flex items-center justify-between">
        <p className="tnum text-[12px] text-text-3">
          共 {entries.length} 个条目
        </p>
        <Segmented
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: 'list', label: <Icon name="list" size={13} /> },
            { value: 'grid', label: <Icon name="grid" size={13} /> },
          ]}
        />
      </div>

      {/* 条目列表 */}
      {viewMode === 'list' ? (
        <div className="space-y-1.5">
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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
