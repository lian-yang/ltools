import { useState, useEffect, useCallback, DragEvent, ChangeEvent } from 'react';
import { Events, Browser } from '@wailsio/runtime';
import { ImageBedService } from '../../bindings/ltools/plugins/imagebed';
import { ImageBedConfig, UploadRecord } from '../../bindings/ltools/plugins/imagebed/models';
import { Icon } from './Icon';
import { Button, IconButton, Input, Modal, Spinner } from './ui';
import { useToast } from '../hooks/useToast';

type LinkFormat = 'raw' | 'markdown' | 'html';

/**
 * 图床插件组件
 */
export function ImageBedWidget(): JSX.Element {
  const [config, setConfig] = useState<ImageBedConfig>({
    githubToken: '',
    owner: '',
    repo: '',
    path: 'images',
    branch: 'main',
    version: 1,
  });
  const [history, setHistory] = useState<UploadRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [renamingRecord, setRenamingRecord] = useState<UploadRecord | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<UploadRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { success, error: showError } = useToast();

  // 加载配置和历史
  useEffect(() => {
    loadConfig();
    loadHistory();

    // 监听上传完成事件
    const unsubscribe = Events.On('imagebed:uploaded', () => {
      loadHistory();
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const loadConfig = async () => {
    try {
      const cfg = await ImageBedService.GetConfig();
      if (cfg) {
        setConfig(cfg);
        // 只要配置信息完整就启用（不依赖验证结果）
        const hasCompleteConfig = !!(cfg.githubToken && cfg.owner && cfg.repo);
        setIsConfigured(hasCompleteConfig);

        if (hasCompleteConfig) {
          setShowConfig(false);
        }
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  };

  const loadHistory = async () => {
    try {
      const records = await ImageBedService.GetUploadHistory();
      setHistory(records || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const handleSaveConfig = async () => {
    if (!config.githubToken || !config.owner || !config.repo) {
      showError('请填写完整的配置信息');
      return;
    }

    setIsValidating(true);
    try {
      await ImageBedService.SetConfig(config);
      const result = await ImageBedService.ValidateConfig();

      if (result && result.valid) {
        success(result.message || '配置保存成功');
        setIsConfigured(true);
        setShowConfig(false);
      } else if (result) {
        // 显示详细错误信息
        const errorMsg = result.message || '配置验证失败';
        showError(errorMsg);

        // 即使验证失败，也启用配置（让用户可以修正分支后继续使用）
        setIsConfigured(true);
        setShowConfig(false);

        // 如果是分支错误，提供额外提示
        if (errorMsg.includes('分支') || errorMsg.includes('Branch')) {
          showError('请检查分支名称是否正确。如果不确定，可以在 GitHub 仓库页面查看默认分支名称。');
        }
      } else {
        showError('配置验证失败');
        // 即使验证失败，也启用配置
        setIsConfigured(true);
      }
    } catch (err) {
      console.error('Failed to save config:', err);
      showError('保存配置失败');
      // 即使出错，如果配置信息完整，也启用
      if (config.githubToken && config.owner && config.repo) {
        setIsConfigured(true);
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!isConfigured) {
      showError('请先配置图床设置');
      setShowConfig(true);
      return;
    }

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      showError('只能上传图片文件');
      return;
    }

    // 验证文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      showError('图片大小不能超过 10MB');
      return;
    }

    setIsUploading(true);
    try {
      // 读取文件为 base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        try {
          const result = await ImageBedService.UploadImage(file.name, base64);
          if (result && result.success) {
            success('上传成功');
            loadHistory();
          } else if (result) {
            showError(result.message || '上传失败');
          } else {
            showError('上传失败');
          }
        } catch (err) {
          console.error('Upload error:', err);
          showError('上传失败');
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File read error:', err);
      showError('读取文件失败');
      setIsUploading(false);
    }
  };

  const handleDrag = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, [isConfigured]);

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          handleFileUpload(file);
        }
        break;
      }
    }
  }, [isConfigured]);

  // 监听粘贴事件
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  const handleDeleteClick = (record: UploadRecord) => {
    setDeletingRecord(record);
  };

  const handleConfirmDelete = async () => {
    if (!deletingRecord) return;

    setIsDeleting(true);
    try {
      const result = await ImageBedService.DeleteImage(deletingRecord.id);
      if (result && result.success) {
        success('删除成功');
        setDeletingRecord(null);
        loadHistory();
      } else if (result) {
        showError(result.message || '删除失败');
      } else {
        showError('删除失败');
      }
    } catch (err) {
      console.error('Delete error:', err);
      showError('删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyLink = async (record: UploadRecord, format: LinkFormat) => {
    try {
      let link = '';
      switch (format) {
        case 'markdown':
          link = `![${record.fileName}](${record.cdnUrl})`;
          break;
        case 'html':
          link = `<img src="${record.cdnUrl}" alt="${record.fileName}" />`;
          break;
        default:
          link = record.cdnUrl;
      }

      await navigator.clipboard.writeText(link);
      success('链接已复制');
    } catch (err) {
      console.error('Copy error:', err);
      showError('复制失败');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSyncFromRepo = async () => {
    try {
      const records = await ImageBedService.SyncFromRepository();
      setHistory(records || []);
      success(`已同步 ${records?.length || 0} 张图片`);
    } catch (err) {
      console.error('Failed to sync from repository:', err);
      showError('同步仓库图片失败');
    }
  };

  const handleRenameImage = async () => {
    if (!renamingRecord || !newFileName.trim()) {
      showError('请输入新文件名');
      return;
    }

    setIsRenaming(true);
    try {
      const result = await ImageBedService.RenameImage(renamingRecord.id, newFileName.trim());
      if (result && result.success) {
        success('重命名成功');
        setRenamingRecord(null);
        setNewFileName('');
        loadHistory();
      } else if (result) {
        showError(result.message || '重命名失败');
      } else {
        showError('重命名失败');
      }
    } catch (err) {
      console.error('Rename error:', err);
      showError('重命名失败');
    } finally {
      setIsRenaming(false);
    }
  };

  // 过滤历史记录（模糊搜索）
  const filteredHistory = history.filter((record) =>
    record.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openGitHubTokenPage = async () => {
    await Browser.OpenURL('https://github.com/settings/tokens/new?scopes=repo&description=LTools%20ImageBed');
  };

  const helpSteps = [
    { title: '创建 Personal Access Token', desc: null },
    { title: '配置 Token 权限', desc: <>勾选 <code className="rounded bg-surface-1 px-1 py-0.5 font-mono text-[11px]">repo</code> 权限即可(包含对仓库的读写权限)</> },
    { title: '生成并复制 Token', desc: <>点击底部 "Generate token" 按钮,然后复制生成的 Token(以 <code className="rounded bg-surface-1 px-1 py-0.5 font-mono text-[11px]">ghp_</code> 开头)</> },
  ];

  return (
    <div>
      {/* 头部 */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="page-title">图床</h1>
          <p className="page-subtitle">使用 GitHub 仓库托管图片</p>
        </div>
        <Button
          variant="secondary"
          icon="cog-6-tooth"
          onClick={() => setShowConfig(!showConfig)}
        >
          {showConfig ? '返回上传' : '设置'}
        </Button>
      </div>

      {/* 配置面板 */}
      {showConfig && (
        <div className="card mx-auto max-w-[560px] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[13.5px] font-semibold text-text-1">GitHub 配置</h3>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center gap-1 text-[11.5px] text-accent-text transition-colors hover:text-accent-hover"
            >
              <Icon name="information-circle" size={13} />
              {showHelp ? '隐藏帮助' : '获取帮助'}
            </button>
          </div>

          {/* 帮助面板 */}
          {showHelp && (
            <div className="card-inset mb-4 space-y-3 p-4">
              <h4 className="text-[12.5px] font-semibold text-text-1">如何获取 GitHub Token</h4>

              <div className="space-y-3">
                {helpSteps.map((step, i) => (
                  <div key={step.title} className="flex gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-[10.5px] font-semibold text-accent-text">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] text-text-1">{step.title}</p>
                      {i === 0 ? (
                        <button
                          onClick={openGitHubTokenPage}
                          className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] text-accent-text transition-colors hover:text-accent-hover"
                        >
                          <Icon name="external-link" size={12} />
                          打开 GitHub Token 页面
                        </button>
                      ) : (
                        <p className="mt-0.5 text-[11.5px] leading-relaxed text-text-3">{step.desc}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="flex items-start gap-2 rounded-[7px] px-3 py-2.5 text-[11.5px] leading-relaxed"
                style={{ background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.18)', color: 'var(--color-warning-text)' }}
              >
                <Icon name="exclamation-circle" size={13} className="mt-0.5 shrink-0" />
                <span>Token 只会显示一次,请立即保存。不要将 Token 提交到公开仓库。</span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="field-label">
                GitHub Token <span style={{ color: 'var(--color-error-text)' }}>*</span>
              </label>
              <Input
                type="password"
                value={config.githubToken}
                onChange={(e) => setConfig({ ...config, githubToken: e.target.value })}
                placeholder="ghp_xxxxxxxxxxxx"
              />
              <p className="field-hint">需要 repo 权限的 Personal Access Token</p>
            </div>
            <div>
              <label className="field-label">
                仓库所有者 <span style={{ color: 'var(--color-error-text)' }}>*</span>
              </label>
              <Input
                type="text"
                value={config.owner}
                onChange={(e) => setConfig({ ...config, owner: e.target.value })}
                placeholder="username"
              />
              <p className="field-hint">GitHub 用户名或组织名</p>
            </div>
            <div>
              <label className="field-label">
                仓库名称 <span style={{ color: 'var(--color-error-text)' }}>*</span>
              </label>
              <Input
                type="text"
                value={config.repo}
                onChange={(e) => setConfig({ ...config, repo: e.target.value })}
                placeholder="image-hosting"
              />
              <p className="field-hint">用于存储图片的 GitHub 仓库名</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">存储路径</label>
                <Input
                  type="text"
                  value={config.path}
                  onChange={(e) => setConfig({ ...config, path: e.target.value })}
                  placeholder="images"
                />
                <p className="field-hint">图片在仓库中的存储路径</p>
              </div>
              <div>
                <label className="field-label">分支</label>
                <Input
                  type="text"
                  value={config.branch}
                  onChange={(e) => setConfig({ ...config, branch: e.target.value })}
                  placeholder="main"
                />
                <p className="field-hint">
                  常见值:<code className="rounded bg-surface-1 px-1 font-mono text-[11px]">main</code> 或{' '}
                  <code className="rounded bg-surface-1 px-1 font-mono text-[11px]">master</code>
                </p>
                <button
                  onClick={() => {
                    const url = `https://github.com/${config.owner}/${config.repo}`;
                    if (config.owner && config.repo) {
                      Browser.OpenURL(url);
                    } else {
                      showError('请先填写仓库所有者和仓库名称');
                    }
                  }}
                  disabled={!config.owner || !config.repo}
                  className="mt-1.5 flex items-center gap-1 text-[11px] text-accent-text transition-colors hover:text-accent-hover disabled:opacity-40"
                >
                  <Icon name="external-link" size={11} />
                  查看仓库分支
                </button>
              </div>
            </div>
            <Button variant="primary" className="w-full" onClick={handleSaveConfig} loading={isValidating}>
              {isValidating ? '验证中…' : '保存配置'}
            </Button>
          </div>
        </div>
      )}

      {/* 上传区域 */}
      {!showConfig && (
        <>
          <div
            className={`rounded-[10px] border border-dashed p-8 text-center transition-colors duration-150 ${
              dragActive
                ? 'file-drop-target-active'
                : 'border-hairline-strong hover:border-text-4'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="flex cursor-pointer flex-col items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: dragActive ? 'var(--color-accent-subtle)' : 'var(--color-surface-2)' }}
              >
                {isUploading ? (
                  <Spinner size={20} />
                ) : (
                  <Icon name="cloud-arrow-up" size={22} color={dragActive ? 'var(--color-accent-text)' : 'var(--color-text-3)'} />
                )}
              </div>
              <div>
                <p className="text-[13.5px] font-medium text-text-1">
                  {isUploading ? '上传中…' : '拖拽图片到这里或点击上传'}
                </p>
                <p className="mt-1 text-[11.5px] text-text-3">
                  支持 Ctrl/Cmd+V 粘贴上传,最大 10MB
                </p>
              </div>
            </label>
          </div>

          {/* 历史记录 */}
          {history.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="section-title" style={{ marginBottom: 0 }}>上传历史</h3>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="refresh"
                  onClick={handleSyncFromRepo}
                  disabled={!isConfigured}
                  title="从 GitHub 仓库同步已有图片"
                >
                  同步仓库图片
                </Button>
              </div>

              {/* 搜索框 */}
              <div className="relative mb-3 max-w-[320px]">
                <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-4" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索文件名…"
                  className="pl-8"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {filteredHistory.map((record) => (
                  <div key={record.id} className="card group flex flex-col overflow-hidden">
                    <div className="relative aspect-square shrink-0 bg-surface-1">
                      <img
                        src={record.cdnUrl}
                        alt={record.fileName}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 p-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        <div className="flex gap-1.5">
                          <IconButton name="link" label="复制原始链接" onClick={() => handleCopyLink(record, 'raw')} />
                          <IconButton name="code-bracket" label="复制 Markdown 格式" onClick={() => handleCopyLink(record, 'markdown')} />
                          <IconButton name="code-bracket-square" label="复制 HTML 格式" onClick={() => handleCopyLink(record, 'html')} />
                          <IconButton
                            name="pencil-square"
                            label="重命名"
                            onClick={() => {
                              setRenamingRecord(record);
                              setNewFileName(record.fileName);
                            }}
                          />
                          <IconButton name="trash" label="删除" onClick={() => handleDeleteClick(record)} />
                        </div>
                      </div>
                    </div>
                    <div className="hairline-t p-2">
                      <p className="truncate text-[11.5px] text-text-1" title={record.fileName}>
                        {record.fileName}
                      </p>
                      <p className="tnum mt-0.5 text-[10.5px] text-text-4">
                        {formatFileSize(record.size)} · {formatDate(record.uploadTime)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {history.length === 0 && (
            <p className="mt-6 py-8 text-center text-[12.5px] text-text-3">暂无上传记录</p>
          )}
        </>
      )}

      {/* 重命名对话框 */}
      <Modal
        open={renamingRecord !== null}
        onClose={() => {
          setRenamingRecord(null);
          setNewFileName('');
        }}
        title="重命名图片"
        width={380}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setRenamingRecord(null);
                setNewFileName('');
              }}
              disabled={isRenaming}
            >
              取消
            </Button>
            <Button variant="primary" onClick={handleRenameImage} loading={isRenaming} disabled={!newFileName.trim()}>
              确认
            </Button>
          </>
        }
      >
        <div>
          <label className="field-label">新文件名</label>
          <Input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="输入新文件名"
            autoFocus
          />
        </div>
      </Modal>

      {/* 删除确认对话框 */}
      <Modal
        open={deletingRecord !== null}
        onClose={() => setDeletingRecord(null)}
        title="确认删除图片"
        width={380}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingRecord(null)} disabled={isDeleting}>
              取消
            </Button>
            <Button variant="danger-solid" onClick={handleConfirmDelete} loading={isDeleting}>
              {isDeleting ? '删除中…' : '确认删除'}
            </Button>
          </>
        }
      >
        <div className="card-inset px-3.5 py-3">
          <p className="text-[12.5px] text-text-1">
            <span className="font-medium">文件名:</span>
            <span className="select-text">{deletingRecord?.fileName}</span>
          </p>
          <p className="mt-1 text-[11.5px] text-text-3">图片将从 GitHub 仓库和历史记录中永久删除</p>
        </div>
      </Modal>
    </div>
  );
}
