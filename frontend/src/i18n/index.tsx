/**
 * 轻量 i18n 运行时
 *
 * 设计约定：以中文原文作为翻译 key。
 * - 中文环境下 `t(key)` 原样返回 key（中文即 key，零成本）。
 * - 英文环境下查 `locales/en.ts`，缺失时回退 key 本身。
 * - 语言选择：设置项（localStorage 持久化）优先；"跟随系统"时根据
 *   navigator.language 判断 —— 中文环境显示中文，其他环境显示英文。
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { en } from './locales/en';

export type Language = 'zh' | 'en';
export type LanguageSetting = 'auto' | Language;

const STORAGE_KEY = 'ltools.language';

function readSetting(): LanguageSetting {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'zh' || v === 'en' || v === 'auto') return v;
  } catch {
    // localStorage 不可用时退回自动检测
  }
  return 'auto';
}

/** 根据设置解析实际使用的语言；auto 时非中文环境回退英文 */
export function resolveLanguage(setting: LanguageSetting): Language {
  if (setting !== 'auto') return setting;
  const candidates =
    typeof navigator !== 'undefined' && navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [typeof navigator !== 'undefined' ? navigator.language : 'en'];
  for (const tag of candidates) {
    if (tag && tag.toLowerCase().startsWith('zh')) return 'zh';
  }
  return 'en';
}

let currentSetting: LanguageSetting = typeof localStorage !== 'undefined' ? readSetting() : 'auto';
let currentLang: Language = resolveLanguage(currentSetting);

const listeners = new Set<() => void>();

function notify() {
  currentLang = resolveLanguage(currentSetting);
  listeners.forEach((fn) => fn());
}

/** 当前实际语言 */
export function getLanguage(): Language {
  return currentLang;
}

/** 当前语言设置（auto/zh/en） */
export function getLanguageSetting(): LanguageSetting {
  return currentSetting;
}

/** 切换语言并持久化；返回是否发生变化 */
export function setLanguageSetting(setting: LanguageSetting): boolean {
  if (setting === currentSetting) return false;
  currentSetting = setting;
  try {
    localStorage.setItem(STORAGE_KEY, setting);
  } catch {
    // 忽略持久化失败
  }
  notify();
  return true;
}

/** 订阅语言变化 */
export function subscribeI18n(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export interface TranslateParams {
  [key: string]: string | number;
}

/**
 * 翻译函数：中文原文即 key。
 * 支持 {name} 形式的插值：t('共 {count} 项', { count: 3 })
 */
export function t(key: string, params?: TranslateParams): string {
  let text: string;
  if (currentLang === 'en') {
    text = Object.prototype.hasOwnProperty.call(en, key) ? (en[key] as string) : key;
  } else {
    text = key;
  }
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

/**
 * 自动翻译：含中文的动态文本（如后端返回的错误消息）优先整句匹配，
 * 再按 ": " 分隔逐级取前缀匹配（对应 Go fmt.Errorf("xxx: %w") 风格），
 * 均未命中时原样返回。纯英文文本直接返回。
 */
export function tAuto(text: string | undefined | null): string {
  if (!text) return text ?? '';
  if (!/[\u4e00-\u9fff]/.test(text)) return text;
  if (Object.prototype.hasOwnProperty.call(en, text)) return en[text] as string;
  let prefix = text;
  for (;;) {
    const idx = Math.max(prefix.lastIndexOf(': '), prefix.lastIndexOf('：'));
    if (idx <= 0) break;
    prefix = prefix.slice(0, idx);
    if (Object.prototype.hasOwnProperty.call(en, prefix)) return en[prefix] as string;
  }
  return text;
}

interface I18nContextValue {
  lang: Language;
  setting: LanguageSetting;
}

const I18nContext = createContext<I18nContextValue>({
  lang: currentLang,
  setting: currentSetting,
});

/**
 * i18n Provider：语言变化时触发整棵子树重渲染。
 * 在 main.tsx 中包裹 AppRouter，覆盖主窗口与所有独立子窗口。
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [setting, setSettingState] = useState<LanguageSetting>(currentSetting);

  useEffect(() => {
    const unsubscribe = subscribeI18n(() => setSettingState(currentSetting));
    // 其他窗口修改了语言设置时同步本窗口（同一 origin 的 storage 事件）
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        currentSetting = readSetting();
        notify();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const lang = resolveLanguage(setting);
  const value = useMemo(() => ({ lang, setting }), [lang, setting]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** 组件内读取当前语言上下文；纯翻译请直接使用 t() */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
