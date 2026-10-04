import { useEffect, useState } from 'react';
import { Events } from '@wailsio/runtime';
import { DateTimeService } from '../../bindings/ltools/plugins/datetime';
import { Icon } from './Icon';
import { t } from '@/i18n';

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
        const weekendDays = [t('星期六'), t('星期日'), 'Saturday', 'Sunday', t('周六'), t('周日')];
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
      const weekendDays = [t('星期六'), t('星期日'), 'Saturday', 'Sunday', t('周六'), t('周日')];
      setIsWeekend(weekendDays.some(wd => ev.data?.includes(wd)));
    });

    return () => {
      unsubscribeTime?.();
      unsubscribeDate?.();
      unsubscribeWeekday?.();
    };
  }, []);

  return (
    <div className="glass-heavy rounded-2xl p-8 text-center">
      {/* 时间 */}
      <div className="text-6xl font-bold text-[#A78BFA] mb-4 tabular-nums">
        {currentTime || '--:--:--'}
      </div>

      {/* 日期 */}
      <div className="text-xl text-white/80 mb-3">
        {currentDate || '----/--/--'}
      </div>

      {/* 星期 */}
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
        isWeekend
          ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20'
          : 'bg-white/5 text-white/60 border border-white/10'
      }`}>
        <span className="text-sm">
          {weekday || '--'}
        </span>
        {isWeekend && (
          <span className="text-xs font-medium">
            {t('周末')}
          </span>
        )}
      </div>
    </div>
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
      <div className="text-xl font-semibold text-white/90 tabular-nums">
        {time || '--:--:--'}
      </div>
      <div className="text-xs text-white/40 mt-1">
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
  const [mode, setMode] = useState<'toDatetime' | 'toTimestamp'>('toDatetime');
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
    if (isNaN(timestamp)) return t('无效的时间戳');

    // 判断是秒还是毫秒
    const date = timestamp > 9999999999 ? new Date(timestamp) : new Date(timestamp * 1000);

    if (isNaN(date.getTime())) return t('无效的日期');

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
    if (!dt.trim()) return t('请输入日期时间');

    // 尝试多种日期格式解析
    let date: Date;

    // 尝试直接解析
    date = new Date(dt);
    if (!isNaN(date.getTime())) {
      return t('秒级: {s}\n毫秒级: {ms}', { s: Math.floor(date.getTime() / 1000), ms: date.getTime() });
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
          return t('秒级: {s}\n毫秒级: {ms}', { s: Math.floor(date.getTime() / 1000), ms: date.getTime() });
        }
      }
    }

    return t('无法解析日期格式，请使用格式如：2024-01-01 12:00:00');
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
    <div className="glass-light rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Icon name="refresh" size={18} color="#A78BFA" />
        {t('时间戳转换工具')}
      </h3>

      {/* 模式切换 */}
      <div className="flex gap-2 mb-6">
        <button
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 clickable ${
            mode === 'toDatetime'
              ? 'bg-[#7C3AED] text-white'
              : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
          onClick={() => {
            setMode('toDatetime');
            setResult('');
          }}
        >
          {t('时间戳 → 日期时间')}
        </button>
        <button
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 clickable ${
            mode === 'toTimestamp'
              ? 'bg-[#7C3AED] text-white'
              : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
          onClick={() => {
            setMode('toTimestamp');
            setResult('');
          }}
        >
          {t('日期时间 → 时间戳')}
        </button>
      </div>

      {/* 时间戳转日期时间模式 */}
      {mode === 'toDatetime' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">{t('输入时间戳')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-4 py-3 bg-[#0D0F1A]/50 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50 focus:border-[#7C3AED]/50 transition-all duration-200 font-mono"
                placeholder={t("例如: 1704067200 或 1704067200000")}
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleConvert();
                }}
              />
              <button
                className="px-4 py-3 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white transition-all duration-200 text-sm font-medium clickable"
                onClick={handleConvert}
              >
                {t('转换')}
              </button>
              <button
                className="px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 transition-all duration-200 text-sm font-medium clickable border border-white/10"
                onClick={useCurrentTimestamp}
                title={t("使用当前时间戳")}
              >
                <Icon name="clock" size={16} />
              </button>
            </div>
            <p className="text-xs text-white/30 mt-2">
              {t('当前时间戳:')} <span className="font-mono text-[#A78BFA]">{currentTime}</span> {t('(秒级)')}
            </p>
          </div>

          {result && (
            <div className="glass-heavy rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/40">{t('转换结果')}</span>
                <button
                  className="text-xs text-[#7C3AED] hover:text-[#A78BFA] transition-colors clickable flex items-center gap-1"
                  onClick={copyResult}
                >
                  <Icon name="document" size={12} />
                  {t('复制')}
                </button>
              </div>
              <pre className="text-sm text-white whitespace-pre-wrap font-mono">{result}</pre>
            </div>
          )}
        </div>
      )}

      {/* 日期时间转时间戳模式 */}
      {mode === 'toTimestamp' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">{t('输入日期时间')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-4 py-3 bg-[#0D0F1A]/50 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50 focus:border-[#7C3AED]/50 transition-all duration-200 font-mono"
                placeholder={t("例如: 2024-01-01 12:00:00 或 2024/01/01")}
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleConvert();
                }}
              />
              <button
                className="px-4 py-3 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white transition-all duration-200 text-sm font-medium clickable"
                onClick={handleConvert}
              >
                {t('转换')}
              </button>
              <button
                className="px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 transition-all duration-200 text-sm font-medium clickable border border-white/10"
                onClick={useCurrentDatetime}
                title={t("使用当前日期时间")}
              >
                <Icon name="clock" size={16} />
              </button>
            </div>
            <p className="text-xs text-white/30 mt-2">
              {t('支持格式: YYYY-MM-DD HH:MM:SS, YYYY/MM/DD 等')}
            </p>
          </div>

          {result && (
            <div className="glass-heavy rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/40">{t('转换结果')}</span>
                <button
                  className="text-xs text-[#7C3AED] hover:text-[#A78BFA] transition-colors clickable flex items-center gap-1"
                  onClick={copyResult}
                >
                  <Icon name="document" size={12} />
                  {t('复制')}
                </button>
              </div>
              <pre className="text-sm text-white whitespace-pre-wrap font-mono">{result}</pre>
            </div>
          )}
        </div>
      )}

      {/* 快捷时间戳参考 */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <p className="text-xs text-white/40 mb-2">{t('快捷参考')}</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: t('1分钟前'), seconds: -60 },
            { label: t('1小时前'), seconds: -3600 },
            { label: t('1天后'), seconds: 86400 },
            { label: t('1周后'), seconds: 604800 },
          ].map((item) => (
            <button
              key={item.label}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 transition-all duration-200 text-xs clickable border border-white/10"
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
    </div>
  );
}
