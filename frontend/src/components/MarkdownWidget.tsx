import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Editor, { Monaco } from '@monaco-editor/react';
import { useTheme } from '../hooks/useTheme';
import { MarkdownPreview } from './MarkdownPreview';
import { Icon } from './Icon';
import { Button, IconButton } from './ui';
import { MarkdownService } from '../../bindings/ltools/plugins/markdown';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

interface MarkdownStats {
  characters: number;
  words: number;
  lines: number;
  readTime: string;
}

const STORAGE_KEY_CONTENT = 'markdown-editor-draft-content';
const STORAGE_KEY_FILENAME = 'markdown-editor-draft-filename';

/** 工具栏分组分隔线 */
function ToolSeparator() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-hairline-strong" />;
}

/**
 * Markdown 编辑器主组件
 */
export function MarkdownWidget(): JSX.Element {
  const { resolvedTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const fileToOpen = searchParams.get('file'); // 从 URL 获取文件路径

  // 从 localStorage 恢复暂存内容
  const [markdownText, setMarkdownText] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CONTENT);
    return saved || '# 欢迎使用 Markdown 编辑器\n\n开始编写你的文档...\n\n## 功能特性\n\n- **实时预览**：编辑时即时查看渲染效果\n- **GFM 支持**：表格、任务列表、删除线等\n- **数学公式**：支持 LaTeX 语法\n- **代码高亮**：多种语言语法高亮\n\n### 代码示例\n\n```javascript\nfunction hello() {\n  console.log("Hello, Markdown!");\n}\n```\n\n### 表格示例\n\n| 功能 | 快捷键 |\n|------|--------|\n| 加粗 | Cmd+B |\n| 斜体 | Cmd+I |\n\n### 数学公式\n\n行内公式：$E = mc^2$\n\n块级公式：\n\n$$\n\\sum_{i=1}^{n} x_i = x_1 + x_2 + \\cdots + x_n\n$$\n';
  });
  const [filename, setFilename] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_FILENAME) || 'untitled.md';
  });
  const [stats, setStats] = useState<MarkdownStats>({ characters: 0, words: 0, lines: 0, readTime: '' });
  const [syncScroll, setSyncScroll] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [editorWidth, setEditorWidth] = useState(50); // 百分比
  const syncScrollRef = useRef<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // 当有文件路径参数时，自动加载文件
  useEffect(() => {
    if (fileToOpen) {
      const loadFile = async () => {
        try {
          console.log('[MarkdownWidget] Loading file from path:', fileToOpen);

          // 使用后端服务读取指定路径的文件
          const result = await MarkdownService.OpenFileAtPath(fileToOpen);

          if (result) {
            setMarkdownText(result.content);
            setFilename(result.filename);
            console.log('[MarkdownWidget] File loaded successfully:', result.filePath);
          } else {
            console.warn('[MarkdownWidget] OpenFileAtPath returned null');
          }
        } catch (err) {
          console.error('[MarkdownWidget] Failed to load file:', err);
        }
      };
      loadFile();
    }
  }, [fileToOpen]);

  // 保持 ref 与 state 同步
  useEffect(() => {
    syncScrollRef.current = syncScroll;
  }, [syncScroll]);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // 更新统计信息
  useEffect(() => {
    const updateStats = async () => {
      try {
        const result = await MarkdownService.GetStats(markdownText);
        setStats(result);
      } catch (err) {
        console.error('Failed to get stats:', err);
      }
    };
    updateStats();
  }, [markdownText]);

  // 暂存内容到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CONTENT, markdownText);
  }, [markdownText]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_FILENAME, filename);
  }, [filename]);

  // 拖拽分隔条处理 - 使用 requestAnimationFrame 优化性能
  const rafRef = useRef<number | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;

      // 取消之前的 RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      // 使用 RAF 批量更新
      rafRef.current = requestAnimationFrame(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const containerWidth = rect.width;
        const mouseX = e.clientX - rect.left;

        // 计算新的宽度百分比
        let newWidth = (mouseX / containerWidth) * 100;

        // 限制最小宽度为 200px 对应的百分比
        const minWidth = 200;
        const minPercent = (minWidth / containerWidth) * 100;
        const maxPercent = 100 - minPercent;

        newWidth = Math.max(minPercent, Math.min(maxPercent, newWidth));
        setEditorWidth(newWidth);
      });
    };

    const handleGlobalMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      // 卸载时兜底恢复全局光标与选中状态
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  // 编辑器挂载时保存引用
  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // 注册编辑器级别快捷键（仅在编辑器聚焦时生效）
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
      insertFormat('**', '**');
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => {
      insertFormat('*', '*');
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
      insertFormat('~~', '~~');
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      insertFormat('[', '](url)');
    });

    // 同步滚动：编辑器滚动时同步预览区域
    editor.onDidScrollChange(() => {
      if (!syncScrollRef.current || !previewRef.current) return;

      const preview = previewRef.current;
      const scrollTop = editor.getScrollTop();
      const scrollHeight = editor.getScrollHeight();
      const layoutHeight = editor.getLayoutInfo().height;

      // 计算滚动比例
      const maxEditorScroll = scrollHeight - layoutHeight;
      const maxPreviewScroll = preview.scrollHeight - preview.clientHeight;

      if (maxEditorScroll > 0 && maxPreviewScroll > 0) {
        const scrollRatio = scrollTop / maxEditorScroll;
        preview.scrollTop = scrollRatio * maxPreviewScroll;
      }
    });
  };

  // 插入格式化标记
  const insertFormat = useCallback((prefix: string, suffix: string) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const selection = editor.getSelection();
    const selectedText = editor.getModel().getValueInRange(selection);
    editor.executeEdits('', [{
      range: selection,
      text: `${prefix}${selectedText}${suffix}`,
    }]);
  }, []);

  // 插入代码块
  const insertCodeBlock = useCallback(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const selection = editor.getSelection();
    const selectedText = editor.getModel().getValueInRange(selection);
    editor.executeEdits('', [{
      range: selection,
      text: `\`\`\`javascript\n${selectedText || '// code here'}\n\`\`\``,
    }]);
  }, []);

  // 插入表格
  const insertTable = useCallback(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const position = editor.getPosition();
    editor.executeEdits('', [{
      range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
      text: '\n| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| 内容 | 内容 | 内容 |\n',
    }]);
  }, []);

  // 插入链接
  const insertLink = useCallback(() => {
    insertFormat('[', '](url)');
  }, [insertFormat]);

  // 插入图片
  const insertImage = useCallback(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const position = editor.getPosition();
    editor.executeEdits('', [{
      range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
      text: '![图片描述](image-url)',
    }]);
  }, []);

  // 插入标题
  const insertHeading = useCallback((level: number) => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const position = editor.getPosition();
    const lineContent = editor.getModel().getLineContent(position.lineNumber);
    const prefix = '#'.repeat(level) + ' ';

    // 移除现有标题标记
    const cleanLine = lineContent.replace(/^#+\s*/, '');
    editor.executeEdits('', [{
      range: new monaco.Range(position.lineNumber, 1, position.lineNumber, lineContent.length + 1),
      text: prefix + cleanLine,
    }]);
  }, []);

  // 插入列表
  const insertList = useCallback((type: 'ul' | 'ol' | 'task') => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const position = editor.getPosition();
    const prefix = type === 'ul' ? '- ' : type === 'ol' ? '1. ' : '- [ ] ';
    editor.executeEdits('', [{
      range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
      text: prefix,
    }]);
  }, []);

  // 导入文件
  const handleImport = useCallback(async () => {
    try {
      const result = await MarkdownService.ImportFile();
      if (result && result.content) {
        setMarkdownText(result.content);
        setFilename(result.filename || 'untitled.md');
      }
    } catch (err) {
      console.error('Failed to import file:', err);
    }
  }, []);

  // 保存文件
  const handleSave = useCallback(async () => {
    try {
      const path = await MarkdownService.SaveFile(markdownText, filename);
      if (path) {
        console.log('File saved to:', path);
      }
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  }, [markdownText, filename]);

  // 导出 HTML
  const handleExportHTML = useCallback(async () => {
    try {
      // 获取渲染后的 HTML
      const previewEl = previewRef.current;
      const renderedHTML = previewEl?.innerHTML || '';
      const title = filename.replace('.md', '');
      const path = await MarkdownService.ExportHTML(markdownText, renderedHTML, title);
      if (path) {
        console.log('HTML exported to:', path);
      }
    } catch (err) {
      console.error('Failed to export HTML:', err);
    }
  }, [markdownText, filename]);

  // 复制到剪贴板
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdownText);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // 清空内容
  const handleClear = () => {
    setMarkdownText('');
    setFilename('untitled.md');
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 工具栏 */}
      <div className="hairline-b flex shrink-0 items-center justify-between gap-3 bg-surface-1 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto scrollbar-hide">
          {/* 标题按钮 */}
          <div className="flex shrink-0 items-center gap-0.5">
            {[1, 2, 3].map((level) => (
              <Button
                key={level}
                variant="ghost"
                size="sm"
                className="min-w-[30px] px-1.5"
                onClick={() => insertHeading(level)}
                title={`标题 ${level}`}
                aria-label={`插入 ${level} 级标题`}
              >
                H{level}
              </Button>
            ))}
          </div>

          <ToolSeparator />

          {/* 格式按钮 */}
          <IconButton name="bold" label="加粗" onClick={() => insertFormat('**', '**')} />
          <IconButton name="italic" label="斜体" onClick={() => insertFormat('*', '*')} />
          <IconButton name="strikethrough" label="删除线" onClick={() => insertFormat('~~', '~~')} />
          <IconButton name="code" label="代码块" onClick={insertCodeBlock} />

          <ToolSeparator />

          {/* 插入按钮 */}
          <IconButton name="link" label="链接" onClick={insertLink} />
          <IconButton name="image" label="图片" onClick={insertImage} />
          <IconButton name="table" label="表格" onClick={insertTable} />

          <ToolSeparator />

          {/* 列表按钮 */}
          <IconButton name="list" label="无序列表" onClick={() => insertList('ul')} />
          <IconButton name="list-numbered" label="有序列表" onClick={() => insertList('ol')} />
          <IconButton name="checkbox" label="任务列表" onClick={() => insertList('task')} />
        </div>

        {/* 右侧操作按钮 */}
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton
            name="view-columns"
            label={showPreview ? '隐藏预览' : '显示预览'}
            className={showPreview ? 'bg-accent-subtle text-accent-text' : ''}
            onClick={() => setShowPreview(!showPreview)}
          />
          <IconButton
            name="eye"
            label="同步滚动"
            className={syncScroll ? 'bg-accent-subtle text-accent-text' : ''}
            onClick={() => setSyncScroll(!syncScroll)}
          />
          <ToolSeparator />
          <IconButton name="upload" label="打开文件" onClick={handleImport} />
          <IconButton name="download" label="保存文件" onClick={handleSave} />
          <IconButton
            name="document"
            label="导出 HTML"
            onClick={handleExportHTML}
            disabled={!showPreview}
          />
        </div>
      </div>

      {/* 主内容区域 - 分屏布局 */}
      <div
        ref={containerRef}
        className="flex min-h-0 flex-1 overflow-hidden"
      >
        {/* 左侧编辑器 */}
        <div
          className={`${showPreview ? '' : 'w-full'} flex min-h-0 flex-col overflow-hidden`}
          style={showPreview ? { width: `${editorWidth}%` } : undefined}
        >
          <div className="hairline-b flex shrink-0 items-center gap-1.5 bg-surface-1 px-3 py-1.5 text-[11px] text-text-3">
            <Icon name="edit" size={12} />
            编辑
            <span className="ml-auto min-w-0 truncate pl-3 font-mono text-[10.5px] text-text-4" title={filename}>
              {filename}
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <Editor
              height="100%"
              defaultLanguage="markdown"
              value={markdownText}
              onChange={(value) => setMarkdownText(value || '')}
              onMount={handleEditorDidMount}
              theme={resolvedTheme === 'light' ? 'light' : 'vs-dark'}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'on',
                tabSize: 2,
                padding: { top: 16 },
              }}
            />
          </div>
        </div>

        {/* 拖拽分隔条（hairline 分割 + 中心手柄） */}
        {showPreview && (
          <div
            className="group relative w-1 shrink-0 cursor-col-resize bg-hairline-faint transition-colors hover:bg-accent/40"
            onMouseDown={handleMouseDown}
            role="separator"
            aria-orientation="vertical"
            aria-label="调整编辑器与预览宽度"
          >
            <div className="absolute left-1/2 top-1/2 h-8 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-hairline-strong transition-colors group-hover:bg-accent" />
          </div>
        )}

        {/* 右侧预览 */}
        {showPreview && (
          <div
            className="flex min-h-0 flex-col overflow-hidden bg-surface-0"
            style={{ width: `${100 - editorWidth}%` }}
          >
            <div className="hairline-b flex shrink-0 items-center gap-1.5 bg-surface-1 px-3 py-1.5 text-[11px] text-text-3">
              <Icon name="eye" size={12} />
              预览
            </div>
            <div
              ref={previewRef}
              className="markdown-preview min-h-0 flex-1 overflow-y-auto px-6 py-5"
            >
              <MarkdownPreview content={markdownText} />
            </div>
          </div>
        )}
      </div>

      {/* 状态栏 */}
      <div className="hairline-t flex shrink-0 items-center justify-between gap-4 bg-surface-1 px-3 py-1.5 text-[11.5px] text-text-3">
        <div className="flex min-w-0 items-center gap-4 overflow-hidden">
          <span className="tnum shrink-0">字符 {stats.characters}</span>
          <span className="tnum shrink-0">字数 {stats.words}</span>
          <span className="tnum shrink-0">行数 {stats.lines}</span>
          <span className="tnum min-w-0 truncate">阅读 {stats.readTime}</span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            className="rounded-[4px] px-1.5 py-0.5 text-[11.5px] text-text-3 transition-colors hover:text-text-1"
            onClick={handleCopy}
          >
            复制
          </button>
          <button
            className="rounded-[4px] px-1.5 py-0.5 text-[11.5px] text-text-3 transition-colors hover:text-text-1"
            onClick={handleClear}
          >
            清空
          </button>
        </div>
      </div>

      {/* Markdown 预览样式（全部走设计 token） */}
      <style>{`
        .markdown-preview {
          color: var(--color-text-1);
          font-size: 13.5px;
          line-height: 1.7;
        }
        .markdown-preview > :first-child {
          margin-top: 0;
        }
        .markdown-preview h1 {
          font-size: 1.6em;
          font-weight: 650;
          margin: 1.2em 0 0.6em;
          padding-bottom: 0.3em;
          border-bottom: 1px solid var(--color-hairline);
          letter-spacing: -0.01em;
        }
        .markdown-preview h2 {
          font-size: 1.35em;
          font-weight: 600;
          margin: 1.1em 0 0.5em;
        }
        .markdown-preview h3 {
          font-size: 1.15em;
          font-weight: 600;
          margin: 1em 0 0.4em;
        }
        .markdown-preview h4, .markdown-preview h5, .markdown-preview h6 {
          font-size: 1em;
          font-weight: 600;
          margin: 1em 0 0.4em;
        }
        .markdown-preview p {
          margin: 0.7em 0;
        }
        .markdown-preview a {
          color: var(--color-accent-text);
        }
        .markdown-preview a:hover {
          text-decoration: underline;
        }
        .markdown-preview code {
          font-family: var(--font-mono);
          font-size: 0.9em;
          background: var(--color-surface-1);
          border: 1px solid var(--color-hairline-faint);
          padding: 0.1em 0.35em;
          border-radius: 4px;
        }
        .markdown-preview pre {
          background: var(--color-surface-1);
          border: 1px solid var(--color-hairline-faint);
          border-radius: 6px;
          padding: 12px 14px;
          overflow-x: auto;
          margin: 1em 0;
        }
        .markdown-preview pre code,
        .markdown-preview pre code.hljs {
          background: transparent;
          border: none;
          padding: 0;
        }
        .markdown-preview blockquote {
          margin: 1em 0;
          padding: 0.25em 1em;
          border-left: 2px solid var(--color-hairline-strong);
          color: var(--color-text-2);
        }
        .markdown-preview table {
          width: 100%;
          border-collapse: collapse;
          margin: 1em 0;
          font-size: 0.95em;
        }
        .markdown-preview th, .markdown-preview td {
          border: 1px solid var(--color-hairline);
          padding: 0.45em 0.9em;
          text-align: left;
        }
        .markdown-preview th {
          background: var(--color-surface-1);
          font-weight: 600;
        }
        .markdown-preview ul, .markdown-preview ol {
          margin: 0.7em 0;
          padding-left: 1.6em;
        }
        .markdown-preview li {
          margin: 0.2em 0;
        }
        .markdown-preview li::marker {
          color: var(--color-text-4);
        }
        .markdown-preview img {
          max-width: 100%;
          border-radius: 6px;
          margin: 1em 0;
        }
        .markdown-preview hr {
          border: none;
          border-top: 1px solid var(--color-hairline);
          margin: 1.6em 0;
        }
        .markdown-preview input[type="checkbox"] {
          margin-right: 0.5em;
          accent-color: var(--color-accent);
        }
        .markdown-preview .katex-display {
          overflow-x: auto;
          overflow-y: hidden;
        }
      `}</style>
    </div>
  );
}

export default MarkdownWidget;
