import { useState, useEffect, useCallback } from 'react';
import { Icon } from './Icon';
import { Button, Card, KeyCap, SectionTitle } from './ui';

interface HistoryItem {
  expression: string;
  result: string;
  timestamp: number;
}

/**
 * 计算器按钮组件
 */
interface CalculatorButtonProps {
  label: string;
  value: string;
  onClick: (value: string) => void;
  variant?: 'number' | 'operator' | 'function' | 'equals' | 'clear';
  span?: 1 | 2;
}

function CalculatorButton({ label, value, onClick, variant = 'number', span = 1 }: CalculatorButtonProps): JSX.Element {
  const spanClasses = span === 2 ? 'col-span-2' : '';

  const variantClasses: Record<string, string> = {
    number: 'bg-surface-3 text-text-1 hover:bg-surface-4',
    operator: 'bg-surface-3 text-accent-text hover:bg-surface-4',
    function: 'bg-surface-3 text-text-2 hover:bg-surface-4',
    equals: 'btn-primary',
    clear: 'btn-danger',
  };

  return (
    <button
      className={`btn ${variantClasses[variant]} ${spanClasses} h-12 rounded-[6px] font-mono text-[16px] font-medium`}
      onClick={() => onClick(value)}
    >
      {label}
    </button>
  );
}

/**
 * 历史记录项组件
 */
interface HistoryItemProps {
  item: HistoryItem;
  onClick: (expression: string) => void;
}

function HistoryRecord({ item, onClick }: HistoryItemProps): JSX.Element {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <button
      type="button"
      className="row row-clickable w-full text-left"
      title={item.expression}
      onClick={() => onClick(item.expression)}
    >
      <span className="tnum min-w-0 flex-1 truncate font-mono text-[12px] text-text-3">
        {item.expression}
      </span>
      <span className="tnum max-w-[40%] shrink-0 truncate font-mono text-[12.5px] font-medium text-text-1">
        {item.result}
      </span>
      <span className="tnum w-12 shrink-0 text-right text-[11px] text-text-4">
        {formatTime(item.timestamp)}
      </span>
    </button>
  );
}

/**
 * 计算器主组件
 */
export function CalculatorWidget(): JSX.Element {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // 格式化显示数字
  const formatDisplay = (value: string): string => {
    if (!value || value === 'Error') return '0';
    // 移除前导零（保留小数点前的零）
    if (value.startsWith('-0.') || value.startsWith('0.')) return value;
    if (value.startsWith('-0') && value.length > 2) {
      const num = parseFloat(value);
      if (!isNaN(num)) return num.toString();
    }
    if (value.startsWith('0') && value.length > 1 && !value.includes('.')) {
      return value.substring(1);
    }
    return value;
  };

  // 计算表达式结果
  const calculate = useCallback((expr: string): string => {
    try {
      // 安全地评估数学表达式
      const sanitized = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/[^0-9+\-*/().\s]/g, '');

      if (!sanitized) return '0';

      // 使用 Function 构造器安全地计算
      const result = new Function('return ' + sanitized)();

      if (result === Infinity || result === -Infinity) return 'Error';
      if (isNaN(result)) return 'Error';

      // 格式化结果
      const formatted = Number(result.toFixed(10)).toString();
      return formatted;
    } catch {
      return 'Error';
    }
  }, []);

  // 处理按钮点击
  const handleButtonClick = useCallback((value: string) => {
    switch (value) {
      case 'C':
        setDisplay('0');
        setExpression('');
        setLastResult(null);
        break;

      case '⌫':
        if (display.length > 1) {
          setDisplay(display.slice(0, -1));
        } else {
          setDisplay('0');
        }
        break;

      case '+/-':
        if (display !== '0') {
          if (display.startsWith('-')) {
            setDisplay(display.substring(1));
          } else {
            setDisplay('-' + display);
          }
        }
        break;

      case '%':
        const num = parseFloat(display);
        if (!isNaN(num)) {
          setDisplay((num / 100).toString());
        }
        break;

      case '=':
        if (expression) {
          const fullExpr = expression + display;
          const result = calculate(fullExpr);

          // 添加到历史记录
          if (result !== 'Error') {
            const newHistory: HistoryItem = {
              expression: fullExpr.replace(/\*/g, '×').replace(/\//g, '÷'),
              result: result,
              timestamp: Date.now(),
            };
            setHistory(prev => [newHistory, ...prev].slice(0, 20));
          }

          setDisplay(result);
          setExpression('');
          setLastResult(result !== 'Error' ? result : null);
        }
        break;

      case '+':
      case '-':
      case '×':
      case '÷':
        setExpression(expression + display + ' ' + value + ' ');
        setDisplay('0');
        break;

      default:
        // 数字和小数点
        if (display === '0' && value !== '.') {
          setDisplay(value);
        } else if (value === '.' && display.includes('.')) {
          // 防止多个小数点
          return;
        } else {
          setDisplay(display + value);
        }
        break;
    }
  }, [display, expression, calculate]);

  // 键盘支持
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // 修复:插件页通过 KeepAlive 隐藏时监听仍然存活,
      // 会劫持其他插件输入框的按键(尤其是 '/' 的 preventDefault)。
      // 只在焦点不在可编辑元素时响应;只读输入框(计算器显示屏)除外。
      const target = e.target as HTMLElement | null;
      if (target instanceof HTMLInputElement && target.readOnly) {
        // 计算器自身显示屏,继续处理
      } else if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = e.key;

      // 数字
      if (/^[0-9]$/.test(key)) {
        handleButtonClick(key);
      }
      // 小数点
      else if (key === '.') {
        handleButtonClick('.');
      }
      // 运算符
      else if (key === '+') {
        handleButtonClick('+');
      } else if (key === '-') {
        handleButtonClick('-');
      } else if (key === '*') {
        handleButtonClick('×');
      } else if (key === '/') {
        e.preventDefault();
        handleButtonClick('÷');
      }
      // 等号
      else if (key === 'Enter' || key === '=') {
        handleButtonClick('=');
      }
      // 清除
      else if (key === 'Escape' || key === 'c' || key === 'C') {
        handleButtonClick('C');
      }
      // 退格
      else if (key === 'Backspace') {
        handleButtonClick('⌫');
      }
      // 百分比
      else if (key === '%') {
        handleButtonClick('%');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleButtonClick]);

  // 从历史记录加载
  const loadFromHistory = (expr: string) => {
    setDisplay('0');
    setExpression('');
    // 可以选择重新计算或者只显示表达式
  };

  // 清空历史记录
  const clearHistory = () => {
    setHistory([]);
  };

  return (
    <div className="flex flex-wrap justify-center gap-6">
      {/* 计算器主体 */}
      <div className="max-w-md min-w-0">
        <Card className="p-5">
          {/* 显示屏 */}
          <div className="card-inset mb-4 rounded-[6px] px-4 py-3">
            {/* 表达式显示(占位避免高度跳动) */}
            <div className="tnum mb-1 h-[18px] truncate text-right font-mono text-[12px] leading-[18px] text-text-3">
              {expression ? expression.replace(/\*/g, '×').replace(/\//g, '÷') : ''}
            </div>
            {/* 主显示屏 */}
            <input
              type="text"
              className="tnum w-full bg-transparent text-right font-mono text-[32px] font-light leading-tight text-text-1 placeholder-text-4 focus:outline-none"
              value={formatDisplay(display)}
              readOnly
            />
          </div>

          {/* 计算器按钮网格 */}
          <div className="grid grid-cols-4 gap-2">
            {/* 第一行 */}
            <CalculatorButton label="C" value="C" onClick={handleButtonClick} variant="clear" />
            <CalculatorButton label="⌫" value="⌫" onClick={handleButtonClick} variant="function" />
            <CalculatorButton label="%" value="%" onClick={handleButtonClick} variant="function" />
            <CalculatorButton label="÷" value="÷" onClick={handleButtonClick} variant="operator" />

            {/* 第二行 */}
            <CalculatorButton label="7" value="7" onClick={handleButtonClick} />
            <CalculatorButton label="8" value="8" onClick={handleButtonClick} />
            <CalculatorButton label="9" value="9" onClick={handleButtonClick} />
            <CalculatorButton label="×" value="×" onClick={handleButtonClick} variant="operator" />

            {/* 第三行 */}
            <CalculatorButton label="4" value="4" onClick={handleButtonClick} />
            <CalculatorButton label="5" value="5" onClick={handleButtonClick} />
            <CalculatorButton label="6" value="6" onClick={handleButtonClick} />
            <CalculatorButton label="-" value="-" onClick={handleButtonClick} variant="operator" />

            {/* 第四行 */}
            <CalculatorButton label="1" value="1" onClick={handleButtonClick} />
            <CalculatorButton label="2" value="2" onClick={handleButtonClick} />
            <CalculatorButton label="3" value="3" onClick={handleButtonClick} />
            <CalculatorButton label="+" value="+" onClick={handleButtonClick} variant="operator" />

            {/* 第五行 */}
            <CalculatorButton label="+/-" value="+/-" onClick={handleButtonClick} variant="function" />
            <CalculatorButton label="0" value="0" onClick={handleButtonClick} />
            <CalculatorButton label="." value="." onClick={handleButtonClick} />
            <CalculatorButton label="=" value="=" onClick={handleButtonClick} variant="equals" />
          </div>

          {/* 上次结果 */}
          {lastResult && (
            <div className="hairline-t mt-4 pt-3">
              <button
                type="button"
                className="tnum w-full text-center font-mono text-[12px] text-text-3 transition-colors duration-150 hover:text-text-1"
                onClick={() => setDisplay(lastResult)}
              >
                使用上次结果: {lastResult}
              </button>
            </div>
          )}
        </Card>

        {/* 键盘提示 */}
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-text-4">
          <span>支持键盘输入</span>
          <KeyCap>Enter</KeyCap>
          <span>计算</span>
          <KeyCap>Esc</KeyCap>
          <span>清除</span>
        </div>
      </div>

      {/* 历史记录侧边栏 */}
      <div
        className={`w-72 min-w-0 shrink-0 transition-opacity duration-150 ${
          showHistory ? 'opacity-100' : 'opacity-60 hover:opacity-100'
        }`}
      >
        <Card inset className="flex h-full flex-col p-3">
          {/* 历史记录标题 */}
          <SectionTitle
            title="计算历史"
            action={
              <div className="flex items-center gap-1">
                {history.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearHistory}>
                    清空
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
                  {showHistory ? '收起' : '展开'}
                </Button>
              </div>
            }
          />

          {/* 历史记录列表 */}
          {showHistory && (
            <div className="mt-2 min-h-0 max-h-[460px] flex-1 overflow-y-auto">
              {history.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
                  <Icon name="clock" size={18} className="text-text-4" />
                  <p className="text-[12px] text-text-3">暂无计算历史</p>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {history.map((item) => (
                    <HistoryRecord
                      key={`${item.timestamp}-${item.expression}`}
                      item={item}
                      onClick={loadFromHistory}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 历史统计 */}
          {history.length > 0 && (
            <div className="hairline-t mt-3 pt-2.5">
              <p className="tnum text-[11px] text-text-4">
                共 {history.length} 条记录
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/**
 * 简化版计算器（侧边栏小工具）
 */
export function MiniCalculator(): JSX.Element {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');

  const handleButtonClick = (value: string) => {
    switch (value) {
      case 'C':
        setDisplay('0');
        setExpression('');
        break;
      case '=':
        try {
          const result = new Function('return ' + expression.replace(/×/g, '*').replace(/÷/g, '/'))();
          setDisplay(result.toString());
          setExpression('');
        } catch {
          setDisplay('Error');
        }
        break;
      case '+':
      case '-':
      case '×':
      case '÷':
        setExpression(expression + display + value);
        setDisplay('0');
        break;
      default:
        setDisplay(display === '0' ? value : display + value);
    }
  };

  const keyClass = (btn: string): string => {
    if (btn === '=') return 'btn-primary';
    if (btn === 'C') return 'bg-surface-3 text-error-text hover:bg-surface-4';
    if ('+-×÷'.includes(btn)) return 'bg-surface-3 text-accent-text hover:bg-surface-4';
    return 'bg-surface-3 text-text-1 hover:bg-surface-4';
  };

  return (
    <div className="p-2">
      <div
        className="tnum mb-2 truncate text-right font-mono text-[15px] text-text-1"
        title={display}
      >
        {display}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', 'C', '0', '=', '+'].map((btn) => (
          <button
            key={btn}
            className={`btn h-8 rounded-[6px] px-0 font-mono text-[12.5px] ${keyClass(btn)}`}
            onClick={() => handleButtonClick(btn)}
          >
            {btn}
          </button>
        ))}
      </div>
    </div>
  );
}

export default CalculatorWidget;
