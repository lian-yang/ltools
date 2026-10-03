import React, { useState } from 'react';
import * as VaultService from '../../../bindings/ltools/plugins/vault/vaultservice';
import { VaultEntry, CreateEntryRequest, UpdateEntryRequest } from '../../../bindings/ltools/plugins/vault/models';
import { Icon } from '../Icon';
import { Button, Field, Input, Textarea, Toggle, ProgressBar } from '../ui';

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
  const getPasswordStrength = (pwd: string): { level: number; tone: 'accent' | 'error' | 'warning' | 'success' } => {
    if (!pwd) return { level: 0, tone: 'accent' };

    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    if (score <= 2) return { level: 1, tone: 'error' };
    if (score <= 3) return { level: 2, tone: 'warning' };
    if (score <= 4) return { level: 3, tone: 'success' };
    return { level: 4, tone: 'success' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 验证
    if (!title.trim()) {
      setError('请输入标题');
      return;
    }
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (!password) {
      setError('请输入密码');
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
      setError('保存失败，请重试');
      console.error('Save failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-[520px]">
        {/* 头部 */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-text-1">
            {mode === 'create' ? '新建密码条目' : '编辑密码条目'}
          </h2>
          <button onClick={onCancel} className="icon-btn" aria-label="关闭">
            <Icon name="close" size={15} />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="card space-y-4 p-5">
          <Field label={<>标题 <span style={{ color: 'var(--color-error-text)' }}>*</span></>}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如:GitHub 账号" />
          </Field>

          <Field label="网站">
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="例如:github.com" />
          </Field>

          <Field label={<>用户名 <span style={{ color: 'var(--color-error-text)' }}>*</span></>}>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="输入用户名或邮箱" />
          </Field>

          {/* 密码 */}
          <div>
            <label className="field-label">
              密码 <span style={{ color: 'var(--color-error-text)' }}>*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 font-mono"
                  placeholder="输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="icon-btn icon-btn-sm absolute right-1 top-1"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={14} />
                </button>
              </div>
              <Button type="button" variant="secondary" icon="refresh-cw" onClick={generatePassword} title="生成随机密码">
                生成
              </Button>
            </div>

            {/* 密码强度 */}
            {password && (
              <div className="mt-2">
                <ProgressBar value={(strength.level / 4) * 100} tone={strength.tone} />
              </div>
            )}
          </div>

          {/* 分类 */}
          <Field label="分类">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input cursor-pointer appearance-none"
            >
              <option value="">选择分类</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </Field>

          {/* 备注 */}
          <Field label="备注">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="resize-none" placeholder="添加备注信息…" />
          </Field>

          {/* 收藏 */}
          <Field horizontal label="收藏" hint="收藏的条目会排在列表最前">
            <Toggle checked={favorite} onChange={setFavorite} label="收藏" />
          </Field>

          {/* 错误信息 */}
          {error && (
            <div className="rounded-[6px] px-3 py-2 text-[12px]" style={{ background: 'rgba(255,69,58,0.12)', color: 'var(--color-error-text)' }}>
              {error}
            </div>
          )}

          {/* 按钮组 */}
          <div className="flex items-center justify-end gap-2 border-t border-hairline pt-4">
            <Button type="button" variant="ghost" onClick={onCancel}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={loading} icon="save">
              {loading ? '保存中…' : '保存'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EntryEditor;
