import { useState, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from '../hooks/useTheme';
import { Icon } from './Icon';
import { JSONEditorService } from '../../bindings/ltools/plugins/jsoneditor';
import { Badge, Button, Card, Segmented } from './ui';

type ViewMode = 'code' | 'tree';

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'code', label: '代码视图' },
  { value: 'tree', label: '树形视图' },
];

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
  const { resolvedTheme } = useTheme();
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
      setError(`导入失败: ${String(err)}`);
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
      setError(`导出失败: ${String(err)}`);
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
    <Card className="p-4">
      {/* 工具栏:视图切换 + 文件导入导出 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Segmented<ViewMode>
          options={VIEW_OPTIONS}
          value={viewMode}
          onChange={(nextMode) => setViewMode(nextMode)}
        />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon="upload" onClick={handleImport}>
            导入文件
          </Button>
          <Button variant="ghost" size="sm" icon="download" onClick={handleExport}>
            导出文件
          </Button>
        </div>
      </div>

      {/* 编辑器区域 */}
      {viewMode === 'code' ? (
        <div className="overflow-hidden rounded-[9px] border border-hairline">
          <Editor
            height="500px"
            defaultLanguage="json"
            value={jsonText}
            onChange={(value) => setJsonText(value || '')}
            theme={resolvedTheme === 'light' ? 'light' : 'vs-dark'}
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
      ) : (
        <div className="card-inset h-[500px] overflow-auto rounded-[9px] p-3">
          {/* 简单的树形视图 */}
          <JSONTreeView data={jsonText} error={error} />
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-[6px] bg-error/10 px-3 py-2 text-[12.5px] text-error-text">
          <Icon name="alert-circle" size={15} className="mt-px shrink-0" />
          <span className="selectable min-w-0 flex-1 break-all">{error}</span>
        </div>
      )}

      {/* 统计信息 */}
      <div className="mt-3 flex items-center justify-between gap-3 text-[11.5px] text-text-3">
        <span className="min-w-0 truncate">
          类型 {stats.type || '-'} · 大小{' '}
          <span className="tnum font-medium text-text-2">{stats.size}</span> 字符 · 行数{' '}
          <span className="tnum font-medium text-text-2">{stats.lines}</span>
        </span>
        <Badge tone={isValid ? 'success' : 'error'} className="shrink-0">
          {isValid ? '有效 JSON' : '无效 JSON'}
        </Badge>
      </div>

      {/* 操作按钮 */}
      <div className="hairline-t mt-3 flex flex-wrap items-center gap-2 pt-3">
        <Button variant="primary" onClick={handleFormat}>
          格式化
        </Button>
        <Button variant="secondary" onClick={handleMinify}>
          压缩
        </Button>
        <Button variant="secondary" onClick={handleValidate}>
          验证
        </Button>
        <Button variant="secondary" icon="copy" onClick={handleCopy}>
          复制
        </Button>
        <Button variant="ghost" icon="trash" onClick={handleClear}>
          清空
        </Button>
      </div>
    </Card>
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
      <div className="flex flex-col items-center py-8 text-center">
        <Icon name="alert-circle" size={28} className="text-error-text" />
        <p className="mt-2 text-[12.5px] text-error-text">无效的 JSON</p>
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="py-8 text-center text-[12.5px] text-text-3">
        请输入有效的 JSON 数据
      </div>
    );
  }

  return (
    <div className="selectable font-mono text-[12.5px]">
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
    let valueColor = 'text-accent-text';

    if (type === 'string') {
      valueDisplay = `"${data}"`;
      valueColor = 'text-success-text';
    } else if (type === 'number') {
      valueColor = 'text-warning-text';
    } else if (type === 'boolean') {
      valueColor = 'text-info';
    } else if (type === 'null') {
      valueColor = 'text-text-4';
    }

    return (
      <div className="rounded-[5px] px-1.5 py-0.5 hover:bg-surface-3">
        {name && <span className="text-accent-text">{name}</span>}
        {name && <span className="mx-1 text-text-4">:</span>}
        <span className={`tnum break-all ${valueColor}`}>{valueDisplay}</span>
      </div>
    );
  }

  // 对象或数组
  const entries = type === 'array'
    ? data.map((item: any, index: number) => [index, item])
    : Object.entries(data);

  const isEmpty = entries.length === 0;
  const bracketColor = type === 'array' ? 'text-warning-text' : 'text-accent-text';

  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-1 rounded-[5px] px-1.5 py-0.5 hover:bg-surface-3"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="shrink-0 select-none text-text-4">
          <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={11} />
        </span>
        {name && <span className="text-accent-text">{name}</span>}
        {name && <span className="mx-1 text-text-4">:</span>}
        <span className={bracketColor}>{type === 'array' ? '[' : '{'}</span>
        {!expanded && <span className="text-text-4">...</span>}
        {isEmpty && <span className={bracketColor}>{type === 'array' ? ']' : '}'}</span>}
        {!isEmpty && expanded && (
          <span className="tnum text-[11px] text-text-4">
            {entries.length} {type === 'array' ? '项' : '个属性'}
          </span>
        )}
      </div>

      {expanded && !isEmpty && (
        <div className="ml-3 border-l border-hairline pl-2">
          {entries.map(([key, value], index) => (
            <TreeNode key={`${name}-${key}-${index}`} data={value} name={String(key)} />
          ))}
          <div className={`py-0.5 px-1.5 ${bracketColor}`}>{type === 'array' ? ']' : '}'}</div>
        </div>
      )}
    </div>
  );
}

export default JSONEditorWidget;
