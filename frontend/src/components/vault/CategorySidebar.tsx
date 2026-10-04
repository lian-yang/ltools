import React, { useState } from 'react';
import { Icon } from '../Icon';
import { t } from '@/i18n';

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

  // 获取分类图标颜色
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      '社交': 'bg-blue-500',
      '工作': 'bg-green-500',
      '金融': 'bg-yellow-500',
      '购物': 'bg-pink-500',
      '其他': 'bg-gray-500',
    };
    return colors[category] || 'bg-purple-500';
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      onAddCategory(newCategoryName.trim());
      setNewCategoryName('');
      setShowAddInput(false);
    }
  };

  return (
    <div className="w-64 border-r border-white/10 bg-black/20 flex flex-col">
      {/* 头部 */}
      <div className="p-4 border-b border-white/10">
        <h3 className="text-sm font-medium text-gray-400">{t('分类')}</h3>
      </div>

      {/* 分类列表 */}
      <div className="flex-1 overflow-auto p-2">
        {/* 全部 */}
        <button
          onClick={() => onSelectCategory('')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mb-1 ${
            selectedCategory === ''
              ? 'bg-primary/20 text-primary'
              : 'text-gray-300 hover:bg-white/5'
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <span className="flex-1 text-left">{t('全部')}</span>
        </button>

        {/* 分类项 */}
        {categories.map((category) => (
          <div
            key={category}
            className="group flex items-center gap-1 mb-1"
          >
            <button
              onClick={() => onSelectCategory(category)}
              className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                selectedCategory === category
                  ? 'bg-primary/20 text-primary'
                  : 'text-gray-300 hover:bg-white/5'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${getCategoryColor(category)}`} />
              <span className="flex-1 text-left truncate">{t(category)}</span>
            </button>
            <button
              onClick={() => onDeleteCategory(category)}
              className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
              title={t("删除分类")}
            >
              <Icon name="x" className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
            </button>
          </div>
        ))}

        {/* 添加分类输入框 */}
        {showAddInput && (
          <div className="mt-2 px-1">
            <input
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
              placeholder={t("输入分类名称")}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                       text-white placeholder-gray-400 focus:outline-none focus:border-primary
                       text-sm"
            />
          </div>
        )}
      </div>

      {/* 添加分类按钮 */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={() => setShowAddInput(true)}
          className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white
                   hover:bg-white/5 rounded-lg transition-colors text-sm"
        >
          <Icon name="plus" className="w-4 h-4" />
          <span>{t('添加分类')}</span>
        </button>
      </div>
    </div>
  );
};

export default CategorySidebar;
