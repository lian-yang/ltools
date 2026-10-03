import { JSX } from 'react';
import { LocalTranslateWidget } from '../components/LocalTranslateWidget';

/**
 * LocalTranslateWindow - 独立翻译窗口
 * 用于全局快捷键快速打开
 */
export default function LocalTranslateWindow(): JSX.Element {
  return (
    <div className="flex h-screen w-screen justify-center overflow-y-auto bg-surface-0 p-8">
      <div className="my-auto flex w-full max-w-2xl min-w-0 flex-col">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="page-title">智能翻译</h1>
            <p className="page-subtitle">多供应商 AI 翻译</p>
          </div>
        </header>
        <div className="min-w-0">
          <LocalTranslateWidget />
        </div>
      </div>
    </div>
  );
}
