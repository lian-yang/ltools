import React, { useState } from 'react';
import * as VaultService from '../../../bindings/ltools/plugins/vault/vaultservice';
import { VaultEntry, CreateEntryRequest, UpdateEntryRequest } from '../../../bindings/ltools/plugins/vault/models';
import { Icon } from '../Icon';
import { t } from '@/i18n';

interface EntryEditorProps {
  mode: 'create' | 'edit';
  entry?: VaultEntry;
  categories: string[];
  onSave: () => void;
  onCancel: () => void;
}

const EntryEditor: React.FC<EntryEditorProps> = ({
  mode,
  entry,
  categories,
  onSave,
  onCancel,
}) => {
  const [title, setTitle] = useState(entry?.title || '');
  const [website, setWebsite] = useState(entry?.website || '');
  const [username, setUsername] = useState(entry?.username || '');
  const [password, setPassword] = useState(entry?.password || '');
  const [notes, setNotes] = useState(entry?.notes || '');
  const [category, setCategory] = useState(entry?.category || '');
  const [favorite, setFavorite] = useState(entry?.favorite || false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 密码生成器（简单版本）
  const generatePassword = () => {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setPassword(result);
  };

  // 密码强度检查
  const getPasswordStrength = (pwd: string): { level: number; color: string } => {
    if (!pwd) return { level: 0, color: 'bg-gray-700' };

    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    if (score <= 2) return { level: 1, color: 'bg-red-500' };
    if (score <= 3) return { level: 2, color: 'bg-yellow-500' };
    if (score <= 4) return { level: 3, color: 'bg-green-500' };
    return { level: 4, color: 'bg-green-600' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 验证
    if (!title.trim()) {
      setError(t('请输入标题'));
      return;
    }
    if (!username.trim()) {
      setError(t('请输入用户名'));
      return;
    }
    if (!password) {
      setError(t('请输入密码'));
      return;
    }

    setLoading(true);
    try {
      if (mode === 'create') {
        const req: CreateEntryRequest = {
          title: title.trim(),
          website: website.trim(),
          username: username.trim(),
          password,
          notes: notes.trim(),
          category,
          favorite,
        };
        await VaultService.CreateEntry(req);
      } else if (entry) {
        const req: UpdateEntryRequest = {
          id: entry.id,
          title: title.trim(),
          website: website.trim(),
          username: username.trim(),
          password,
          notes: notes.trim(),
          category,
          favorite,
        };
        await VaultService.UpdateEntry(req);
      }
      onSave();
    } catch (err) {
      setError(t('保存失败，请重试'));
      console.error('Save failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-2xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {mode === 'create' ? t('新建密码条目') : t('编辑密码条目')}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Icon name="x" className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 标题 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('标题')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg
                       text-white placeholder-gray-400 focus:outline-none focus:border-primary"
              placeholder={t("例如：GitHub 账号")}
            />
          </div>

          {/* 网站 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('网站')}
            </label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg
                       text-white placeholder-gray-400 focus:outline-none focus:border-primary"
              placeholder={t("例如：github.com")}
            />
          </div>

          {/* 用户名 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('用户名')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg
                       text-white placeholder-gray-400 focus:outline-none focus:border-primary"
              placeholder={t("输入用户名或邮箱")}
            />
          </div>

          {/* 密码 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('密码')} <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg
                           text-white placeholder-gray-400 focus:outline-none focus:border-primary
                           pr-12 font-mono"
                  placeholder={t("输入密码")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} className="w-5 h-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={generatePassword}
                className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors
                         text-gray-300 hover:text-white flex items-center gap-2"
                title={t("生成随机密码")}
              >
                <Icon name="refresh-cw" className="w-4 h-4" />
                <span>{t('生成')}</span>
              </button>
            </div>

            {/* 密码强度 */}
            {password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        level <= strength.level ? strength.color : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 分类 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('分类')}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg
                       text-white focus:outline-none focus:border-primary appearance-none
                       cursor-pointer"
            >
              <option value="" className="bg-gray-800">{t('选择分类')}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat} className="bg-gray-800">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('备注')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg
                       text-white placeholder-gray-400 focus:outline-none focus:border-primary
                       resize-none"
              placeholder={t("添加备注信息...")}
            />
          </div>

          {/* 收藏 */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFavorite(!favorite)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                favorite
                  ? 'bg-yellow-500/20 text-yellow-500'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              <Icon name="star" className={`w-4 h-4 ${favorite ? 'fill-current' : ''}`} />
              <span>{t('收藏')}</span>
            </button>
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* 按钮组 */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-lg
                       text-gray-300 transition-colors"
            >
              {t('取消')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-primary hover:bg-primary/80 disabled:bg-gray-600
                       disabled:cursor-not-allowed rounded-lg text-white font-medium
                       transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>{t('保存中...')}</span>
                </>
              ) : (
                <>
                  <Icon name="save" className="w-5 h-5" />
                  <span>{t('保存')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EntryEditor;
