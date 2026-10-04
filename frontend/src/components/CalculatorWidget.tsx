import { useState, useEffect, useCallback } from 'react';
import { Icon } from './Icon';
import { t } from '@/i18n';

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
  const baseClasses = 'rounded-xl font-semibold text-lg transition-all duration-150 clickable';
  const spanClasses = span === 2 ? 'col-span-2' : '';

  const variantClasses: Record<string, string> = {
    number: 'bg-white/5 hover:bg-white/10 text-white',
    operator: 'bg-[#7C3AED]/20 hover:bg-[#7C3AED]/30 text-[#A78BFA]',
    function: 'bg-white/5 hover:bg-white/10 text-white/70',
    equals: 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-lg shadow-[#7C3AED]/30',
    clear: 'bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444]',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${spanClasses} py-4`}
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
    <div
      className="glass-light rounded-lg p-3 hover:bg-white/5 transition-all duration-200 cursor-pointer clickable"
      onClick={() => onClick(item.expression)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/60 font-mono truncate">{item.expression}</p>
          <p className="text-lg font-semibold text-[#A78BFA] font-mono">{item.result}</p>
        </div>
        <span className="text-xs text-white/30 whitespace-nowrap">{formatTime(item.timestamp)}</span>
      </div>
    </div>
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
    <div className="flex justify-center gap-6">
      {/* 计算器主体 */}
      <div className="max-w-md">
        <div className="glass-heavy rounded-2xl p-6">
          {/* 显示屏 */}
          <div className="mb-6">
            {/* 表达式显示 */}
            {expression && (
              <div className="text-right text-white/50 text-sm mb-2 h-6 font-mono">
                {expression.replace(/\*/g, '×').replace(/\//g, '÷')}
              </div>
            )}
            {/* 主显示屏 */}
            <div className="text-right">
              <input
                type="text"
                className="w-full bg-transparent text-right text-5xl font-bold text-white placeholder-white/20 focus:outline-none font-mono"
                value={formatDisplay(display)}
                readOnly
              />
            </div>
          </div>

          {/* 计算器按钮网格 */}
          <div className="grid grid-cols-4 gap-3">
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
            <div className="mt-4 pt-4 border-t border-white/10">
              <button
                className="w-full text-center text-sm text-white/40 hover:text-white/60 transition-colors clickable"
                onClick={() => setDisplay(lastResult)}
              >
                {t('使用上次结果:')} {lastResult}
              </button>
            </div>
          )}
        </div>

        {/* 键盘提示 */}
        <div className="mt-4 text-center text-xs text-white/30">
          {t('支持键盘输入 | Enter = | Esc = 清除')}
        </div>
      </div>

      {/* 历史记录侧边栏 */}
      <div className={`w-72 transition-all duration-300 ${showHistory ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}>
        <div className="glass-light rounded-xl p-4 h-full flex flex-col">
          {/* 历史记录标题 */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white/60 flex items-center gap-2">
              <Icon name="clock" size={14} color="#A78BFA" />
              {t('计算历史')}
            </h3>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button
                  className="text-xs text-white/30 hover:text-[#EF4444] transition-colors clickable"
                  onClick={clearHistory}
                >
                  {t('清空')}
                </button>
              )}
              <button
                className="text-xs text-white/30 hover:text-white/60 transition-colors clickable"
                onClick={() => setShowHistory(!showHistory)}
              >
                {showHistory ? t('收起') : t('展开')}
              </button>
            </div>
          </div>

          {/* 历史记录列表 */}
          {showHistory && (
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {history.length === 0 ? (
                <div className="text-center py-8 text-white/30 text-sm">
                  <Icon name="clock" size={24} color="rgba(255,255,255,0.2)" />
                  <p className="mt-2">{t('暂无计算历史')}</p>
                </div>
              ) : (
                history.map((item, index) => (
                  <HistoryRecord
                    key={`${item.timestamp}-${index}`}
                    item={item}
                    onClick={loadFromHistory}
                  />
                ))
              )}
            </div>
          )}

          {/* 历史统计 */}
          {history.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-xs text-white/30">
                {t('共')} {history.length} {t('条记录')}
              </p>
            </div>
          )}
        </div>
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

  return (
    <div className="p-2">
      <div className="text-right text-lg font-semibold text-white mb-2 font-mono">
        {display}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', 'C', '0', '=', '+'].map((btn) => (
          <button
            key={btn}
            className="p-2 text-xs rounded bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors clickable"
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
