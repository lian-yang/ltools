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
    icon: 'folder',
    description: '调整质量和尺寸',
  },
  {
    id: 'crop',
    label: '裁剪',
    icon: 'pencil',
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
    <div className="glass-heavy rounded-2xl p-4 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-[#FAF5FF] mb-4 flex items-center gap-2">
        <Icon name="cog-6-tooth" className="w-5 h-5 text-[#A78BFA]" />
        处理功能
      </h3>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {functions.map((fn) => (
          <button
            key={fn.id}
            onClick={() => !disabled && onModeChange(fn.id as ProcessingMode)}
            disabled={disabled}
            className={`
              w-full text-left p-3 rounded-xl transition-all duration-200 group
              ${currentMode === fn.id
                ? 'bg-[#7C3AED]/30 border border-[#A78BFA]/50'
                : 'hover:bg-white/5 border border-transparent'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="flex items-center gap-3">
              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center
                ${currentMode === fn.id
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-white/10 text-[#A78BFA] group-hover:bg-white/20'
                }
              `}>
                <Icon name={fn.icon} className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[#FAF5FF] font-medium">{fn.label}</div>
                <div className="text-xs text-white/50 truncate">{fn.description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
