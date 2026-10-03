import { useEffect, useState } from 'react';
import { Events } from '@wailsio/runtime';
import { DateTimeService } from '../../bindings/ltools/plugins/datetime';
import {
  Badge,
  Button,
  Card,
  IconButton,
  Input,
  SectionTitle,
  Segmented,
} from './ui';

type TimestampMode = 'toDatetime' | 'toTimestamp';

const MODE_OPTIONS: { value: TimestampMode; label: string }[] = [
  { value: 'toDatetime', label: '时间戳 → 日期时间' },
  { value: 'toTimestamp', label: '日期时间 → 时间戳' },
];

const QUICK_REFS: { label: string; seconds: number }[] = [
  { label: '1分钟前', seconds: -60 },
  { label: '1小时前', seconds: -3600 },
  { label: '1天后', seconds: 86400 },
  { label: '1周后', seconds: 604800 },
];

/**
 * 日期时间小部件组件
 * 显示当前日期和时间
 */
export function DateTimeWidget(): JSX.Element {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [weekday, setWeekday] = useState<string>('');
  const [isWeekend, setIsWeekend] = useState<boolean>(false);

  // 初始化和监听实时更新事件
  useEffect(() => {
    // 初始化时获取当前时间
    const initializeDateTime = async () => {
      try {
        const [time, date, day] = await Promise.all([
          DateTimeService.GetCurrentTime(),
          DateTimeService.GetCurrentDate(),
          DateTimeService.GetWeekday(),
        ]);
        setCurrentTime(time || '');
        setCurrentDate(date || '');
        setWeekday(day || '');

        // 检查是否是周末
        const weekendDays = ['星期六', '星期日', 'Saturday', 'Sunday', '周六', '周日'];
        setIsWeekend(weekendDays.some(wd => day?.includes(wd)));
      } catch (err) {
        console.error('Failed to initialize datetime:', err);
      }
    };
    initializeDateTime();

    // 监听时间更新
    const unsubscribeTime = Events.On('datetime:time', (ev: { data: string }) => {
      setCurrentTime(ev.data);
    });

    // 监听日期更新
    const unsubscribeDate = Events.On('datetime:date', (ev: { data: string }) => {
      setCurrentDate(ev.data);
    });

    // 监听星期更新
    const unsubscribeWeekday = Events.On('datetime:weekday', (ev: { data: string }) => {
      setWeekday(ev.data);
      const weekendDays = ['星期六', '星期日', 'Saturday', 'Sunday', '周六', '周日'];
      setIsWeekend(weekendDays.some(wd => ev.data?.includes(wd)));
    });

    return () => {
      unsubscribeTime?.();
      unsubscribeDate?.();
      unsubscribeWeekday?.();
    };
  }, []);

  return (
    <Card className="px-6 py-8 text-center">
      {/* 时间 */}
      <div className="tnum font-mono text-[44px] font-light leading-none tracking-tight text-text-1">
        {currentTime || '--:--:--'}
      </div>

      {/* 日期 */}
      <div className="tnum mt-3 text-[13.5px] text-text-2">
        {currentDate || '----/--/--'}
      </div>

      {/* 星期 */}
      <div className="mt-4 flex justify-center">
        <Badge tone={isWeekend ? 'success' : 'neutral'}>
          {weekday || '--'}
          {isWeekend ? ' · 周末' : ''}
        </Badge>
      </div>
    </Card>
  );
}

/**
 * 简化的时钟组件（侧边栏）
 */
export function ClockWidget(): JSX.Element {
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    // 初始化时获取当前时间
    const initializeClock = async () => {
      try {
        const [timeData, dateData] = await Promise.all([
          DateTimeService.GetCurrentTime(),
          DateTimeService.GetCurrentDate(),
        ]);
        setTime(timeData || '');
        setDate(dateData || '');
      } catch (err) {
        console.error('Failed to initialize clock:', err);
      }
    };
    initializeClock();

    const unsubscribeTime = Events.On('datetime:time', (ev: { data: string }) => {
      setTime(ev.data);
    });

    const unsubscribeDate = Events.On('datetime:date', (ev: { data: string }) => {
      setDate(ev.data);
    });

    return () => {
      unsubscribeTime?.();
      unsubscribeDate?.();
    };
  }, []);

  return (
    <div className="text-center">
      <div className="tnum font-mono text-[15px] font-semibold leading-tight text-text-1">
        {time || '--:--:--'}
      </div>
      <div className="tnum mt-0.5 text-[11px] text-text-4">
        {date || '----/--/--'}
      </div>
    </div>
  );
}

export default DateTimeWidget;

/**
 * 时间戳转换工具组件
 */
export function TimestampConverter(): JSX.Element {
  const [mode, setMode] = useState<TimestampMode>('toDatetime');
  const [timestamp, setTimestamp] = useState<string>('');
  const [datetime, setDatetime] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('');

  // 获取当前时间戳
  useEffect(() => {
    const updateCurrentTimestamp = () => {
      setCurrentTime(Math.floor(Date.now() / 1000).toString());
    };
    updateCurrentTimestamp();
    const timer = setInterval(updateCurrentTimestamp, 1000);
    return () => clearInterval(timer);
  }, []);

  // 时间戳转日期时间
  const timestampToDatetime = (ts: string): string => {
    const timestamp = parseInt(ts, 10);
    if (isNaN(timestamp)) return '无效的时间戳';

    // 判断是秒还是毫秒
    const date = timestamp > 9999999999 ? new Date(timestamp) : new Date(timestamp * 1000);

    if (isNaN(date.getTime())) return '无效的日期';

    // 格式化输出多种格式
    const formats = [
      date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      date.toISOString(),
      date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
    ];

    return formats.join('\n');
  };

  // 日期时间转时间戳
  const datetimeToTimestamp = (dt: string): string => {
    if (!dt.trim()) return '请输入日期时间';

    // 尝试多种日期格式解析
    let date: Date;

    // 尝试直接解析
    date = new Date(dt);
    if (!isNaN(date.getTime())) {
      return `秒级: ${Math.floor(date.getTime() / 1000)}\n毫秒级: ${date.getTime()}`;
    }

    // 尝试常见格式
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
      /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
      /^(\d{4})-(\d{2})-(\d{2})$/,
      /^(\d{4})\/(\d{2})\/(\d{2})$/,
    ];

    for (const fmt of formats) {
      const match = dt.match(fmt);
      if (match) {
        const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
        date = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second)
        );
        if (!isNaN(date.getTime())) {
          return `秒级: ${Math.floor(date.getTime() / 1000)}\n毫秒级: ${date.getTime()}`;
        }
      }
    }

    return '无法解析日期格式，请使用格式如：2024-01-01 12:00:00';
  };

  // 处理转换
  const handleConvert = () => {
    if (mode === 'toDatetime') {
      setResult(timestampToDatetime(timestamp));
    } else {
      setResult(datetimeToTimestamp(datetime));
    }
  };

  // 使用当前时间戳
  const useCurrentTimestamp = () => {
    setTimestamp(currentTime);
    if (mode === 'toDatetime') {
      setResult(timestampToDatetime(currentTime));
    }
  };

  // 使用当前日期时间
  const useCurrentDatetime = () => {
    const now = new Date();
    const formatted = now.toISOString().slice(0, 19).replace('T', ' ');
    setDatetime(formatted);
    if (mode === 'toTimestamp') {
      setResult(datetimeToTimestamp(formatted));
    }
  };

  // 复制结果
  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(result.split('\n')[0]);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Card className="p-4">
      <SectionTitle title="时间戳转换" className="mb-3" />

      {/* 模式切换 */}
      <Segmented<TimestampMode>
        options={MODE_OPTIONS}
        value={mode}
        onChange={(nextMode) => {
          setMode(nextMode);
          setResult('');
        }}
        className="mb-4"
      />

      {/* 时间戳转日期时间模式 */}
      {mode === 'toDatetime' && (
        <div className="space-y-1.5">
          <label className="field-label">输入时间戳</label>
          <div className="flex gap-2">
            <Input
              type="text"
              className="min-w-0 flex-1 font-mono tnum"
              placeholder="例如: 1704067200 或 1704067200000"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConvert();
              }}
            />
            <Button variant="primary" onClick={handleConvert}>
              转换
            </Button>
            <IconButton name="clock" label="使用当前时间戳" onClick={useCurrentTimestamp} />
          </div>
          <p className="text-[11.5px] text-text-3">
            当前时间戳: <span className="tnum font-mono text-text-1">{currentTime}</span>（秒级）
          </p>
        </div>
      )}

      {/* 日期时间转时间戳模式 */}
      {mode === 'toTimestamp' && (
        <div className="space-y-1.5">
          <label className="field-label">输入日期时间</label>
          <div className="flex gap-2">
            <Input
              type="text"
              className="min-w-0 flex-1 font-mono tnum"
              placeholder="例如: 2024-01-01 12:00:00 或 2024/01/01"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConvert();
              }}
            />
            <Button variant="primary" onClick={handleConvert}>
              转换
            </Button>
            <IconButton name="clock" label="使用当前日期时间" onClick={useCurrentDatetime} />
          </div>
          <p className="text-[11.5px] text-text-3">
            支持格式: YYYY-MM-DD HH:MM:SS, YYYY/MM/DD 等
          </p>
        </div>
      )}

      {/* 转换结果 */}
      {result && (
        <div className="card-inset mt-3 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] text-text-4">转换结果</span>
            <Button variant="ghost" size="sm" icon="copy" onClick={copyResult}>
              复制
            </Button>
          </div>
          <pre className="selectable whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-text-1">
            {result}
          </pre>
        </div>
      )}

      {/* 快捷时间戳参考 */}
      <div className="hairline-t mt-4 pt-3">
        <p className="mb-2 text-[11px] text-text-4">快捷参考</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REFS.map((item) => (
            <button
              key={item.label}
              className="btn btn-sm btn-secondary"
              onClick={() => {
                const ts = Math.floor((Date.now() / 1000) + item.seconds);
                setTimestamp(ts.toString());
                setResult(timestampToDatetime(ts.toString()));
                setMode('toDatetime');
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
