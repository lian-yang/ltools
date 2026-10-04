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
import { t } from '@/i18n';

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
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title={sidebarOpen ? t('隐藏侧边栏') : t('显示侧边栏')}
            >
              <Icon name="sidebar" className="w-5 h-5" />
            </button>

            {/* 搜索框 */}
            <div className="relative">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={t("搜索密码...")}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 pr-4 py-2 w-64 bg-white/5 border border-white/10 rounded-lg
                         text-white placeholder-gray-400 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateEntry}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80
                       rounded-lg transition-colors text-white"
            >
              <Icon name="plus" className="w-4 h-4" />
              <span>{t('新建')}</span>
            </button>
            <button
              onClick={() => setShowChangePassword(true)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title={t("修改主密码")}
            >
              <Icon name="key" className="w-5 h-5" />
            </button>
            <button
              onClick={handleLock}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title={t("锁定保险库")}
            >
              <Icon name="lock" className="w-5 h-5" />
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
