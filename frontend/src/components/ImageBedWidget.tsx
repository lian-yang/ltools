import { useState, useEffect, useCallback, DragEvent, ChangeEvent } from 'react';
import { Events, Browser } from '@wailsio/runtime';
import { ImageBedService } from '../../bindings/ltools/plugins/imagebed';
import { ImageBedConfig, UploadRecord } from '../../bindings/ltools/plugins/imagebed/models';
import { Icon } from './Icon';
import { useToast } from '../hooks/useToast';
import { t } from '@/i18n';

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
      showError(t('请填写完整的配置信息'));
      return;
    }

    setIsValidating(true);
    try {
      await ImageBedService.SetConfig(config);
      const result = await ImageBedService.ValidateConfig();

      if (result && result.valid) {
        success(result.message || t('配置保存成功'));
        setIsConfigured(true);
        setShowConfig(false);
      } else if (result) {
        // 显示详细错误信息
        const errorMsg = result.message || t('配置验证失败');
        showError(errorMsg);

        // 即使验证失败，也启用配置（让用户可以修正分支后继续使用）
        setIsConfigured(true);
        setShowConfig(false);

        // 如果是分支错误，提供额外提示
        if (errorMsg.includes('分支') || errorMsg.includes('Branch')) {
          showError(t('请检查分支名称是否正确。如果不确定，可以在 GitHub 仓库页面查看默认分支名称。'));
        }
      } else {
        showError(t('配置验证失败'));
        // 即使验证失败，也启用配置
        setIsConfigured(true);
      }
    } catch (err) {
      console.error('Failed to save config:', err);
      showError(t('保存配置失败'));
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
      showError(t('请先配置图床设置'));
      setShowConfig(true);
      return;
    }

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      showError(t('只能上传图片文件'));
      return;
    }

    // 验证文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      showError(t('图片大小不能超过 10MB'));
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
            success(t('上传成功'));
            loadHistory();
          } else if (result) {
            showError(result.message || t('上传失败'));
          } else {
            showError(t('上传失败'));
          }
        } catch (err) {
          console.error('Upload error:', err);
          showError(t('上传失败'));
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File read error:', err);
      showError(t('读取文件失败'));
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
        success(t('删除成功'));
        setDeletingRecord(null);
        loadHistory();
      } else if (result) {
        showError(result.message || t('删除失败'));
      } else {
        showError(t('删除失败'));
      }
    } catch (err) {
      console.error('Delete error:', err);
      showError(t('删除失败'));
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
      success(t('链接已复制'));
    } catch (err) {
      console.error('Copy error:', err);
      showError(t('复制失败'));
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
      success(t('已同步 {n} 张图片', { n: records?.length || 0 }));
    } catch (err) {
      console.error('Failed to sync from repository:', err);
      showError(t('同步仓库图片失败'));
    }
  };

  const handleRenameImage = async () => {
    if (!renamingRecord || !newFileName.trim()) {
      showError(t('请输入新文件名'));
      return;
    }

    setIsRenaming(true);
    try {
      const result = await ImageBedService.RenameImage(renamingRecord.id, newFileName.trim());
      if (result && result.success) {
        success(t('重命名成功'));
        setRenamingRecord(null);
        setNewFileName('');
        loadHistory();
      } else if (result) {
        showError(result.message || t('重命名失败'));
      } else {
        showError(t('重命名失败'));
      }
    } catch (err) {
      console.error('Rename error:', err);
      showError(t('重命名失败'));
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

  return (
    <div className="glass-heavy rounded-2xl p-8">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Icon name="photo" className="w-6 h-6 text-[#A78BFA]" />
          {t('图床')}
        </h2>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="px-4 py-2 rounded-lg bg-[#A78BFA]/10 hover:bg-[#A78BFA]/20 text-[#A78BFA] transition-colors flex items-center gap-2"
        >
          <Icon name="cog-6-tooth" size={18} />
          {showConfig ? t('返回上传') : t('设置')}
        </button>
      </div>

      {/* 配置面板 */}
      {showConfig && (
        <div className="glass rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{t('GitHub 配置')}</h3>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="text-[#A78BFA] hover:text-[#A78BFA]/80 text-sm flex items-center gap-1 transition-colors"
            >
              <Icon name="information-circle" size={16} />
              {showHelp ? t('隐藏帮助') : t('获取帮助')}
            </button>
          </div>

          {/* 帮助面板 */}
          {showHelp && (
            <div className="mb-6 space-y-4">
              <div className="glass rounded-lg p-4 border-l-4 border-[#A78BFA]">
                <h4 className="font-semibold mb-3 text-[#FAF5FF]">{t('如何获取 GitHub Token')}</h4>

                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#A78BFA] flex items-center justify-center text-white text-sm font-bold">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#E9D5FF] mb-2">{t('创建 Personal Access Token')}</p>
                      <button
                        onClick={openGitHubTokenPage}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-[#A78BFA] hover:bg-[#A78BFA]/80 text-white rounded-lg transition-colors"
                      >
                        <Icon name="external-link" size={14} />
                        {t('打开 GitHub Token 页面')}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#A78BFA] flex items-center justify-center text-white text-sm font-bold">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#E9D5FF] mb-2">{t('配置 Token 权限')}</p>
                      <p className="text-xs text-[#E9D5FF]/70">{t('勾选')} <code className="px-1 py-0.5 bg-[#1E1E2E] rounded">repo</code> {t('权限即可（包含对仓库的读写权限）')}</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#A78BFA] flex items-center justify-center text-white text-sm font-bold">
                      3
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#E9D5FF] mb-2">{t('生成并复制 Token')}</p>
                      <p className="text-xs text-[#E9D5FF]/70">{t('点击底部 "Generate token" 按钮，然后复制生成的 Token（以')} <code className="px-1 py-0.5 bg-[#1E1E2E] rounded">ghp_</code> {t('开头）')}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-xs text-yellow-300 flex items-start gap-2">
                    <span className="text-base">⚠️</span>
                    <span>{t('Token 只会显示一次，请立即保存。不要将 Token 提交到公开仓库。')}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#E9D5FF] mb-2">
                GitHub Token <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={config.githubToken}
                onChange={(e) => setConfig({ ...config, githubToken: e.target.value })}
                placeholder="ghp_xxxxxxxxxxxx"
                className="w-full px-4 py-2 bg-[#1E1E2E] border border-[#A78BFA]/20 rounded-lg focus:outline-none focus:border-[#A78BFA] text-[#FAF5FF]"
              />
              <p className="text-xs text-[#E9D5FF]/60 mt-1">{t('需要 repo 权限的 Personal Access Token')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#E9D5FF] mb-2">
                {t('仓库所有者')} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={config.owner}
                onChange={(e) => setConfig({ ...config, owner: e.target.value })}
                placeholder="username"
                className="w-full px-4 py-2 bg-[#1E1E2E] border border-[#A78BFA]/20 rounded-lg focus:outline-none focus:border-[#A78BFA] text-[#FAF5FF]"
              />
              <p className="text-xs text-[#E9D5FF]/60 mt-1">{t('GitHub 用户名或组织名')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#E9D5FF] mb-2">
                {t('仓库名称')} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={config.repo}
                onChange={(e) => setConfig({ ...config, repo: e.target.value })}
                placeholder="image-hosting"
                className="w-full px-4 py-2 bg-[#1E1E2E] border border-[#A78BFA]/20 rounded-lg focus:outline-none focus:border-[#A78BFA] text-[#FAF5FF]"
              />
              <p className="text-xs text-[#E9D5FF]/60 mt-1">{t('用于存储图片的 GitHub 仓库名')}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#E9D5FF] mb-2">
                  {t('存储路径')}
                </label>
                <input
                  type="text"
                  value={config.path}
                  onChange={(e) => setConfig({ ...config, path: e.target.value })}
                  placeholder="images"
                  className="w-full px-4 py-2 bg-[#1E1E2E] border border-[#A78BFA]/20 rounded-lg focus:outline-none focus:border-[#A78BFA] text-[#FAF5FF]"
                />
                <p className="text-xs text-[#E9D5FF]/60 mt-1">{t('图片在仓库中的存储路径')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#E9D5FF] mb-2">
                  {t('分支')}
                </label>
                <input
                  type="text"
                  value={config.branch}
                  onChange={(e) => setConfig({ ...config, branch: e.target.value })}
                  placeholder="main"
                  className="w-full px-4 py-2 bg-[#1E1E2E] border border-[#A78BFA]/20 rounded-lg focus:outline-none focus:border-[#A78BFA] text-[#FAF5FF]"
                />
                <p className="text-xs text-[#E9D5FF]/60 mt-1">
                  {t('目标分支名称。常见值：')}<code className="px-1 bg-[#1E1E2E] rounded">main</code> {t('或')} <code className="px-1 bg-[#1E1E2E] rounded">master</code>
                </p>
                <button
                  onClick={() => {
                    const url = `https://github.com/${config.owner}/${config.repo}`;
                    if (config.owner && config.repo) {
                      Browser.OpenURL(url);
                    } else {
                      showError(t('请先填写仓库所有者和仓库名称'));
                    }
                  }}
                  disabled={!config.owner || !config.repo}
                  className="mt-2 text-xs text-[#A78BFA] hover:text-[#A78BFA]/80 disabled:text-[#A78BFA]/40 flex items-center gap-1 transition-colors"
                >
                  <Icon name="external-link" size={12} />
                  {t('查看仓库分支')}
                </button>
              </div>
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={isValidating}
              className="w-full py-3 bg-[#A78BFA] hover:bg-[#A78BFA]/80 disabled:bg-[#A78BFA]/40 rounded-lg font-medium transition-colors"
            >
              {isValidating ? t('验证中...') : t('保存配置')}
            </button>
          </div>
        </div>
      )}

      {/* 上传区域 */}
      {!showConfig && (
        <>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragActive
                ? 'border-[#A78BFA] bg-[#A78BFA]/10'
                : 'border-[#A78BFA]/20 hover:border-[#A78BFA]/40'
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
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-4"
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                dragActive ? 'bg-[#A78BFA]/20' : 'bg-[#A78BFA]/10'
              }`}>
                <Icon name="cloud-arrow-up" size={32} className="text-[#A78BFA]" />
              </div>
              <div>
                <p className="text-lg font-medium text-[#FAF5FF]">
                  {isUploading ? t('上传中...') : t('拖拽图片到这里或点击上传')}
                </p>
                <p className="text-sm text-[#E9D5FF]/60 mt-1">
                  {t('支持 Ctrl/Cmd+V 粘贴上传，最大 10MB')}
                </p>
              </div>
            </label>
          </div>

          {/* 历史记录 */}
          {history.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{t('上传历史')}</h3>
                <button
                  onClick={handleSyncFromRepo}
                  disabled={!isConfigured}
                  className="px-3 py-1.5 text-sm bg-[#A78BFA]/10 hover:bg-[#A78BFA]/20 text-[#A78BFA] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  title={t("从 GitHub 仓库同步已有图片")}
                >
                  <Icon name="refresh" size={14} />
                  {t('同步仓库图片')}
                </button>
              </div>

              {/* 搜索框 */}
              <div className="mb-4">
                <div className="relative">
                  <Icon name="magnifying-glass" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E9D5FF]/60" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("搜索文件名...")}
                    className="w-full pl-10 pr-4 py-2 bg-[#1E1E2E] border border-[#A78BFA]/20 rounded-lg focus:outline-none focus:border-[#A78BFA] text-[#FAF5FF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredHistory.map((record) => (
                  <div
                    key={record.id}
                    className="glass rounded-lg overflow-hidden group flex flex-col"
                  >
                    <div className="relative bg-[#1E1E2E]/50 flex-shrink-0 aspect-square">
                      <img
                        src={record.cdnUrl}
                        alt={record.fileName}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCopyLink(record, 'raw')}
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                            title={t("复制原始链接")}
                          >
                            <Icon name="link" size={16} />
                          </button>
                          <button
                            onClick={() => handleCopyLink(record, 'markdown')}
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                            title={t("复制 Markdown 格式")}
                          >
                            <Icon name="code-bracket" size={16} />
                          </button>
                          <button
                            onClick={() => handleCopyLink(record, 'html')}
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                            title={t("复制 HTML 格式")}
                          >
                            <Icon name="code-bracket-square" size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setRenamingRecord(record);
                              setNewFileName(record.fileName);
                            }}
                            className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors"
                            title={t("重命名")}
                          >
                            <Icon name="pencil-square" size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(record)}
                            className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
                            title={t("删除")}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="p-2 mt-auto bg-[#1E1E2E]/30">
                      <p className="text-xs text-[#E9D5FF] truncate" title={record.fileName}>
                        {record.fileName}
                      </p>
                      <p className="text-xs text-[#E9D5FF]/60 mt-1">
                        {formatFileSize(record.size)} · {formatDate(record.uploadTime)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {history.length === 0 && (
            <div className="mt-6 text-center text-[#E9D5FF]/60 py-8">
              {t('暂无上传记录')}
            </div>
          )}
        </>
      )}

      {/* 重命名对话框 */}
      {renamingRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-heavy rounded-xl p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-4">{t('重命名图片')}</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#E9D5FF] mb-2">
                {t('新文件名')}
              </label>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder={t("输入新文件名")}
                className="w-full px-4 py-2 bg-[#1E1E2E] border border-[#A78BFA]/20 rounded-lg focus:outline-none focus:border-[#A78BFA] text-[#FAF5FF]"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setRenamingRecord(null);
                  setNewFileName('');
                }}
                disabled={isRenaming}
                className="flex-1 py-2 bg-[#1E1E2E] hover:bg-[#1E1E2E]/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {t('取消')}
              </button>
              <button
                onClick={handleRenameImage}
                disabled={isRenaming || !newFileName.trim()}
                className="flex-1 py-2 bg-[#A78BFA] hover:bg-[#A78BFA]/80 disabled:bg-[#A78BFA]/40 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                {isRenaming ? t('重命名中...') : t('确认')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认对话框 */}
      {deletingRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-heavy rounded-xl p-6 w-96 max-w-[90vw]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <Icon name="exclamation-circle" size={24} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{t('确认删除图片')}</h3>
                <p className="text-sm text-[#E9D5FF]/70 mt-1">{t('此操作无法撤销')}</p>
              </div>
            </div>
            <div className="mb-6 p-3 bg-[#1E1E2E]/50 rounded-lg">
              <p className="text-sm text-[#E9D5FF]">
                <span className="font-medium">{t('文件名：')}</span>
                {deletingRecord.fileName}
              </p>
              <p className="text-sm text-[#E9D5FF]/70 mt-1">
                {t('图片将从 GitHub 仓库和历史记录中永久删除')}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingRecord(null)}
                disabled={isDeleting}
                className="flex-1 py-2 bg-[#1E1E2E] hover:bg-[#1E1E2E]/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {t('取消')}
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                {isDeleting ? t('删除中...') : t('确认删除')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
