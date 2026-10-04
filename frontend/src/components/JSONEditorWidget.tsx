import { useState, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Icon } from './Icon';
import { JSONEditorService } from '../../bindings/ltools/plugins/jsoneditor';
import { t } from '@/i18n';

type ViewMode = 'code' | 'tree';

interface JSONStats {
  size: number;
  lines: number;
  type: string;
  isValid: boolean;
  errorMsg: string;
}

/**
 * JSON 编辑器主组件
 */
export function JSONEditorWidget(): JSX.Element {
  const [jsonText, setJsonText] = useState('{\n  \n}');
  const [viewMode, setViewMode] = useState<ViewMode>('code');
  const [error, setError] = useState('');
  const [stats, setStats] = useState<JSONStats>({ isValid: true, type: '', lines: 1, size: 5, errorMsg: '' });
  const [isValid, setIsValid] = useState(true);

  // 格式化
  const handleFormat = useCallback(async () => {
    try {
      const formatted = await JSONEditorService.FormatJSON(jsonText);
      setJsonText(formatted);
      setError('');
      setIsValid(true);
    } catch (err) {
      const errorMsg = String(err);
      setError(errorMsg);
      setIsValid(false);
    }
  }, [jsonText]);

  // 压缩
  const handleMinify = useCallback(async () => {
    try {
      const minified = await JSONEditorService.MinifyJSON(jsonText);
      setJsonText(minified);
      setError('');
      setIsValid(true);
    } catch (err) {
      const errorMsg = String(err);
      setError(errorMsg);
      setIsValid(false);
    }
  }, [jsonText]);

  // 验证
  const handleValidate = useCallback(async () => {
    const valid = await JSONEditorService.ValidateJSON(jsonText);
    setIsValid(valid);
    if (!valid) {
      const errorMsg = await JSONEditorService.GetJSONError(jsonText);
      setError(errorMsg);
    } else {
      setError('');
    }
  }, [jsonText]);

  // 更新统计
  useEffect(() => {
    const updateStats = async () => {
      const result = await JSONEditorService.GetJSONStats(jsonText);
      setStats(result);
      setIsValid(result.isValid);
      if (!result.isValid && result.errorMsg) {
        setError(result.errorMsg);
      } else {
        setError('');
      }
    };

    // 防抖处理
    const timeoutId = setTimeout(updateStats, 300);
    return () => clearTimeout(timeoutId);
  }, [jsonText]);

  // 导入文件 - 使用后端服务以获得更好的文件过滤器支持
  const handleImport = useCallback(async () => {
    try {
      const result = await JSONEditorService.ImportFile();
      if (result && result.content) {
        setJsonText(result.content);
        setError('');
      }
    } catch (err) {
      console.error('Failed to import file:', err);
      setError(t('导入失败: {msg}', { msg: String(err) }));
    }
  }, []);

  // 导出文件 - 使用后端服务以获得更好的文件过滤器支持
  const handleExport = useCallback(async () => {
    try {
      const filePath = await JSONEditorService.ExportFile(jsonText, 'data.json');
      if (filePath) {
        // 可以添加成功提示
        console.log('File saved to:', filePath);
      }
    } catch (err) {
      console.error('Failed to export file:', err);
      setError(t('导出失败: {msg}', { msg: String(err) }));
    }
  }, [jsonText]);

  // 复制到剪贴板
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      // 可以添加提示
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // 清空内容
  const handleClear = () => {
    setJsonText('{\n  \n}');
    setError('');
    setIsValid(true);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="glass-heavy rounded-2xl p-6">
        {/* 标题和工具栏 */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-white">{t('JSON 编辑器')}</h3>
            <p className="text-white/60 text-sm">{t('格式化、验证和编辑 JSON 数据')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`px-3 py-1.5 rounded-lg text-sm transition-all clickable ${
                viewMode === 'code' ? 'bg-[#7C3AED] text-white' : 'bg-white/5 text-white/60 hover:text-white'
              }`}
              onClick={() => setViewMode('code')}
            >
              {t('代码视图')}
            </button>
            <button
              className={`px-3 py-1.5 rounded-lg text-sm transition-all clickable ${
                viewMode === 'tree' ? 'bg-[#7C3AED] text-white' : 'bg-white/5 text-white/60 hover:text-white'
              }`}
              onClick={() => setViewMode('tree')}
            >
              {t('树形视图')}
            </button>
          </div>
        </div>

        {/* 编辑器区域 */}
        {viewMode === 'code' ? (
          <div className="mb-4">
            <div className="rounded-xl overflow-hidden border border-white/10">
              <Editor
                height="500px"
                defaultLanguage="json"
                value={jsonText}
                onChange={(value) => setJsonText(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  wordWrap: 'on',
                  formatOnPaste: true,
                  tabSize: 2,
                }}
              />
            </div>
          </div>
        ) : (
          <div className="glass-light rounded-xl p-4 h-[500px] overflow-auto">
            {/* 简单的树形视图 */}
            <JSONTreeView data={jsonText} error={error} />
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[#EF4444]/10 text-[#EF4444] text-sm flex items-start gap-2">
            <Icon name="alert-circle" size={16} color="#EF4444" />
            <span className="flex-1 break-all">{error}</span>
          </div>
        )}

        {/* 统计信息 */}
        <div className="flex items-center justify-between text-xs text-white/40">
          <span>
            {t('类型:')} {stats.type} {t('| 大小:')} {stats.size} {t('字符 | 行数:')} {stats.lines}
          </span>
          <span className={isValid ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
            {isValid ? t('✓ 有效 JSON') : t('✗ 无效 JSON')}
          </span>
        </div>

        {/* 操作按钮 */}
        <div className="mt-4 flex items-center gap-3">
          <button
            className="px-4 py-2 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all clickable"
            onClick={handleFormat}
          >
            {t('格式化')}
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-all clickable"
            onClick={handleMinify}
          >
            {t('压缩')}
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-all clickable"
            onClick={handleValidate}
          >
            {t('验证')}
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-all clickable"
            onClick={handleCopy}
          >
            {t('复制')}
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-all clickable"
            onClick={handleClear}
          >
            {t('清空')}
          </button>
        </div>

        {/* 文件导入导出 */}
        <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3">
          <button
            className="px-4 py-2 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all clickable"
            onClick={handleImport}
          >
            <div className="flex items-center gap-2">
              <Icon name="upload" size={16} />
              {t('导入文件')}
            </div>
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all clickable"
            onClick={handleExport}
          >
            <div className="flex items-center gap-2">
              <Icon name="download" size={16} />
              {t('导出文件')}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 简单的 JSON 树形视图组件
 */
interface JSONTreeViewProps {
  data: string;
  error: string;
}

function JSONTreeView({ data, error }: JSONTreeViewProps): JSX.Element {
  const [parsed, setParsed] = useState<any>(null);

  useEffect(() => {
    try {
      const parsedData = JSON.parse(data);
      setParsed(parsedData);
    } catch {
      setParsed(null);
    }
  }, [data]);

  if (error) {
    return (
      <div className="text-center py-8">
        <Icon name="alert-circle" size={32} color="#EF4444" />
        <p className="text-[#EF4444] mt-2">{t('无效的 JSON')}</p>
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="text-center py-8 text-white/40">
        {t('请输入有效的 JSON 数据')}
      </div>
    );
  }

  return (
    <div className="font-mono text-sm">
      <TreeNode data={parsed} key="root" />
    </div>
  );
}

/**
 * 递归渲染树节点
 */
interface TreeNodeProps {
  data: any;
  name?: string;
}

function TreeNode({ data, name }: TreeNodeProps): JSX.Element {
  const [expanded, setExpanded] = useState(true);

  const getType = (value: any): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  };

  const type = getType(data);

  // 基本类型值
  if (type !== 'object' && type !== 'array') {
    let valueDisplay = String(data);
    let valueColor = 'text-[#A78BFA]';

    if (type === 'string') {
      valueDisplay = `"${data}"`;
      valueColor = 'text-[#22C55E]';
    } else if (type === 'number') {
      valueColor = 'text-[#F59E0B]';
    } else if (type === 'boolean') {
      valueColor = 'text-[#7C3AED]';
    } else if (type === 'null') {
      valueColor = 'text-white/40';
    }

    return (
      <div className="py-1 px-2 hover:bg-white/5 rounded">
        {name && <span className="text-[#60A5FA]">{name}</span>}
        {name && <span className="text-white/40 mx-1">:</span>}
        <span className={valueColor}>{valueDisplay}</span>
      </div>
    );
  }

  // 对象或数组
  const entries = type === 'array'
    ? data.map((item: any, index: number) => [index, item])
    : Object.entries(data);

  const isEmpty = entries.length === 0;
  const bracketColor = type === 'array' ? 'text-[#F59E0B]' : 'text-[#60A5FA]';

  return (
    <div className="ml-2">
      <div
        className="flex items-center gap-1 py-1 px-2 hover:bg-white/5 rounded cursor-pointer clickable"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-white/30 select-none">
          {expanded ? '▼' : '▶'}
        </span>
        {name && <span className="text-[#60A5FA]">{name}</span>}
        {name && <span className="text-white/40 mx-1">:</span>}
        <span className={bracketColor}>{type === 'array' ? '[' : '{'}</span>
        {!expanded && <span className="text-white/40">...</span>}
        {isEmpty && <span className={bracketColor}>{type === 'array' ? ']' : '}'}</span>}
        {!isEmpty && (
          <span className="text-white/40 text-xs">
            {entries.length} {type === 'array' ? t('项') : t('个属性')}
          </span>
        )}
      </div>

      {expanded && !isEmpty && (
        <div className="ml-4 border-l border-white/10 pl-2">
          {entries.map(([key, value], index) => (
            <TreeNode key={`${name}-${key}-${index}`} data={value} name={String(key)} />
          ))}
          <div className={bracketColor}>{type === 'array' ? ']' : '}'}</div>
        </div>
      )}
    </div>
  );
}

export default JSONEditorWidget;
