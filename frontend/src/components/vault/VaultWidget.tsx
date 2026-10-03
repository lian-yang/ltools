import React, { useState, useEffect, useCallback } from 'react';
import * as VaultService from '../../../bindings/ltools/plugins/vault/vaultservice';
import { VaultStatus, VaultEntry } from '../../../bindings/ltools/plugins/vault/models';
import VaultSetup from './VaultSetup';
import VaultUnlock from './VaultUnlock';
import EntryList from './EntryList';
import EntryEditor from './EntryEditor';
import CategorySidebar from './CategorySidebar';
import ChangePasswordDialog from './ChangePasswordDialog';
import { Icon } from '../Icon';
import { Button, Input } from '../ui';

type ViewMode = 'setup' | 'unlock' | 'list' | 'edit';

interface EditorState {
  mode: 'create' | 'edit';
  entry?: VaultEntry;
}

const VaultWidget: React.FC = () => {
  const [_status, setStatus] = useState<VaultStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('unlock');
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // 加载保险库状态
  const loadStatus = useCallback(async () => {
    try {
      const s = await VaultService.Status();
      setStatus(s);

      if (!s.initialized) {
        setViewMode('setup');
      } else if (s.locked) {
        setViewMode('unlock');
      } else {
        setViewMode('list');
        await loadEntries();
        await loadCategories();
      }
    } catch (err) {
      console.error('Failed to load vault status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载条目
  const loadEntries = async () => {
    try {
      const list = await VaultService.ListEntries();
      setEntries(list || []);
    } catch (err) {
      console.error('Failed to load entries:', err);
    }
  };

  // 加载分类
  const loadCategories = async () => {
    try {
      const cats = await VaultService.GetCategories();
      setCategories(cats || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  // 初始化时加载状态
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // 处理设置完成
  const handleSetupComplete = async () => {
    await loadStatus();
  };

  // 处理解锁成功
  const handleUnlockSuccess = async () => {
    await loadStatus();
  };

  // 处理锁定
  const handleLock = async () => {
    try {
      await VaultService.Lock();
      setStatus(prev => prev ? { ...prev, locked: true } : null);
      setViewMode('unlock');
      setEntries([]);
    } catch (err) {
      console.error('Failed to lock vault:', err);
    }
  };

  // 处理创建新条目
  const handleCreateEntry = () => {
    setEditorState({ mode: 'create' });
    setViewMode('edit');
  };

  // 处理编辑条目
  const handleEditEntry = (entry: VaultEntry) => {
    setEditorState({ mode: 'edit', entry });
    setViewMode('edit');
  };

  // 处理保存条目
  const handleSaveEntry = async () => {
    await loadEntries();
    setEditorState(null);
    setViewMode('list');
  };

  // 处理取消编辑
  const handleCancelEdit = () => {
    setEditorState(null);
    setViewMode('list');
  };

  // 处理删除条目
  const handleDeleteEntry = async (id: string) => {
    try {
      await VaultService.DeleteEntry(id);
      await loadEntries();
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  // 处理搜索
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      try {
        const result = await VaultService.SearchEntries(query);
        setEntries(result?.entries || []);
      } catch (err) {
        console.error('Failed to search entries:', err);
      }
    } else {
      await loadEntries();
    }
  };

  // 过滤条目
  const filteredEntries = selectedCategory
    ? entries.filter(e => e.category === selectedCategory)
    : entries;

  // 加载中状态
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="spinner" />
      </div>
    );
  }

  // 设置界面
  if (viewMode === 'setup') {
    return <VaultSetup onComplete={handleSetupComplete} />;
  }

  // 解锁界面
  if (viewMode === 'unlock') {
    return <VaultUnlock onSuccess={handleUnlockSuccess} />;
  }

  // 编辑界面
  if (viewMode === 'edit' && editorState) {
    return (
      <EntryEditor
        mode={editorState.mode}
        entry={editorState.entry}
        categories={categories}
        onSave={handleSaveEntry}
        onCancel={handleCancelEdit}
      />
    );
  }

  // 主列表界面
  return (
    <div className="flex h-full">
      {/* 侧边栏 */}
      {sidebarOpen && (
        <CategorySidebar
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onAddCategory={async (name) => {
            try {
              await VaultService.AddCategory(name);
              await loadCategories();
            } catch (err) {
              console.error('Failed to add category:', err);
            }
          }}
          onDeleteCategory={async (name) => {
            try {
              await VaultService.DeleteCategory(name);
              await loadCategories();
              if (selectedCategory === name) {
                setSelectedCategory('');
              }
            } catch (err) {
              console.error('Failed to delete category:', err);
            }
          }}
        />
      )}

      {/* 主内容区 */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="icon-btn shrink-0"
              title={sidebarOpen ? '隐藏侧边栏' : '显示侧边栏'}
            >
              <Icon name="sidebar" size={15} />
            </button>

            {/* 搜索框 */}
            <div className="relative w-56 min-w-0">
              <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-4" />
              <Input
                type="text"
                placeholder="搜索密码…"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="primary" size="sm" icon="plus" onClick={handleCreateEntry}>
              新建
            </Button>
            <button onClick={() => setShowChangePassword(true)} className="icon-btn" title="修改主密码">
              <Icon name="key" size={15} />
            </button>
            <button onClick={handleLock} className="icon-btn" title="锁定保险库">
              <Icon name="lock" size={15} />
            </button>
          </div>
        </div>

        {/* 条目列表 */}
        <EntryList
          entries={filteredEntries}
          onEdit={handleEditEntry}
          onDelete={handleDeleteEntry}
        />
      </div>

      {/* 修改主密码对话框 */}
      <ChangePasswordDialog
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </div>
  );
};

export default VaultWidget;
