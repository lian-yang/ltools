import React, { useState } from 'react';
import { Icon } from '../Icon';
import { Input } from '../ui';

interface CategorySidebarProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onAddCategory: (name: string) => void;
  onDeleteCategory: (name: string) => void;
}

const CategorySidebar: React.FC<CategorySidebarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  onAddCategory,
  onDeleteCategory,
}) => {
  const [showAddInput, setShowAddInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      onAddCategory(newCategoryName.trim());
      setNewCategoryName('');
      setShowAddInput(false);
    }
  };

  const itemClass = (active: boolean) =>
    `flex h-[30px] w-full items-center gap-2.5 rounded-[6px] px-2.5 text-left text-[12.5px] transition-colors duration-150 ${
      active ? 'bg-accent-subtle font-medium text-accent-text' : 'text-text-2 hover:bg-white/[0.045] hover:text-text-1'
    }`;

  return (
    <div className="flex w-[200px] shrink-0 flex-col border-r border-hairline bg-surface-1">
      {/* 头部 */}
      <div className="px-4 pb-2 pt-4">
        <h3 className="text-[11px] font-medium text-text-4">分类</h3>
      </div>

      {/* 分类列表 */}
      <div className="flex-1 space-y-0.5 overflow-auto p-2 scrollbar-hide">
        {/* 全部 */}
        <button onClick={() => onSelectCategory('')} className={itemClass(selectedCategory === '')}>
          <Icon name="funnel" size={14} className="shrink-0" />
          <span className="flex-1 truncate">全部</span>
        </button>

        {/* 分类项 */}
        {categories.map((category) => {
          const active = selectedCategory === category;
          return (
            <div key={category} className="group relative flex items-center">
              <button onClick={() => onSelectCategory(category)} className={itemClass(active)}>
                <span className="flex-1 truncate">{category}</span>
              </button>
              <button
                onClick={() => onDeleteCategory(category)}
                className="icon-btn icon-btn-sm absolute right-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                title="删除分类"
              >
                <Icon name="close" size={11} />
              </button>
            </div>
          );
        })}

        {/* 添加分类输入框 */}
        {showAddInput && (
          <div className="mt-2 px-0.5">
            <Input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddCategory();
                } else if (e.key === 'Escape') {
                  setShowAddInput(false);
                  setNewCategoryName('');
                }
              }}
              autoFocus
              placeholder="输入分类名称"
            />
          </div>
        )}
      </div>

      {/* 添加分类按钮 */}
      <div className="border-t border-hairline p-2">
        <button
          onClick={() => setShowAddInput(true)}
          className="flex h-[30px] w-full items-center gap-2 rounded-[6px] px-2.5 text-[12.5px] text-text-3 transition-colors duration-150 hover:bg-white/[0.045] hover:text-text-1"
        >
          <Icon name="plus" size={14} />
          <span>添加分类</span>
        </button>
      </div>
    </div>
  );
};

export default CategorySidebar;
