import { Icon, type IconName } from './Icon';

/**
 * 设置分类类型
 */
export type SettingsCategory = 'general' | 'shortcuts' | 'sync' | 'plugins' | 'about';

/**
 * 导航项配置
 */
interface NavItem {
  id: SettingsCategory;
  label: string;
  icon: IconName;
  description: string;
}

/**
 * 所有设置导航项
 */
const navItems: NavItem[] = [
  {
    id: 'general',
    label: '通用',
    icon: 'cog',
    description: '语言、主题、启动行为',
  },
  {
    id: 'shortcuts',
    label: '快捷键',
    icon: 'keyboard',
    description: '全局快捷键配置',
  },
  {
    id: 'sync',
    label: '同步',
    icon: 'cloud-arrow-up',
    description: '数据同步设置',
  },
  {
    id: 'plugins',
    label: '插件',
    icon: 'puzzle-piece',
    description: '插件启用/禁用、权限管理',
  },
  {
    id: 'about',
    label: '关于',
    icon: 'information-circle',
    description: '版本信息、更新检查',
  },
];

interface SettingsNavProps {
  activeCategory: SettingsCategory;
  onCategoryChange: (category: SettingsCategory) => void;
}

/**
 * 设置页面左侧导航组件
 */
export function SettingsNav({ activeCategory, onCategoryChange }: SettingsNavProps) {
  return (
    <nav className="sticky top-6 w-[176px] shrink-0 self-start" aria-label="设置分类">
      <div className="card-inset p-1.5">
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const active = activeCategory === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onCategoryChange(item.id)}
                  aria-current={active ? 'page' : undefined}
                  title={item.description}
                  className={`flex h-8 w-full items-center gap-2.5 rounded-[6px] px-2.5 text-left text-[12.5px] font-medium transition-colors duration-150 ${
                    active
                      ? 'bg-accent-subtle text-accent-text'
                      : 'text-text-2 hover:bg-white/[0.045] hover:text-text-1'
                  }`}
                >
                  <Icon name={item.icon} size={15} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
