import { FunctionItem } from './types';
import { Icon } from '../Icon';
import type { ProcessingMode } from '../../../bindings/ltools/plugins/imageprocessor/models';

interface FunctionPanelProps {
  currentMode: ProcessingMode;
  onModeChange: (mode: ProcessingMode) => void;
  disabled?: boolean;
}

const functions: FunctionItem[] = [
  {
    id: 'compress',
    label: '压缩',
    icon: 'funnel',
    description: '调整质量和尺寸',
  },
  {
    id: 'crop',
    label: '裁剪',
    icon: 'rectangle',
    description: '按尺寸或比例裁剪',
  },
  {
    id: 'watermark',
    label: '水印',
    icon: 'photo',
    description: '添加图片或文字水印',
  },
  {
    id: 'steganography',
    label: '版权',
    icon: 'lock',
    description: '嵌入/提取数字水印',
  },
  {
    id: 'favicon',
    label: 'Favicon',
    icon: 'globe',
    description: '生成网站图标',
  },
];

export function FunctionPanel({ currentMode, onModeChange, disabled }: FunctionPanelProps): JSX.Element {
  return (
    <div className="card-inset flex h-full flex-col p-2">
      <h3 className="section-title px-2 pb-2 pt-1.5">处理功能</h3>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto scrollbar-hide">
        {functions.map((fn) => {
          const active = currentMode === fn.id;
          return (
            <button
              key={fn.id}
              onClick={() => !disabled && onModeChange(fn.id as ProcessingMode)}
              disabled={disabled}
              aria-pressed={active}
              className={`row row-clickable w-full text-left ${active ? 'row-selected hover:bg-accent-subtle' : ''} ${
                disabled ? 'cursor-not-allowed opacity-45' : ''
              }`}
            >
              <Icon
                name={fn.icon}
                size={15}
                className={`shrink-0 ${active ? 'text-accent-text' : 'text-text-3'}`}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[12.5px] font-medium ${
                    active ? 'text-accent-text' : 'text-text-1'
                  }`}
                >
                  {fn.label}
                </span>
                <span className="block truncate text-[11px] text-text-3">{fn.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
