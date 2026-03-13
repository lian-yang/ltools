import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { useToast } from '../hooks/useToast';
import * as SettingsService from '../../bindings/ltools/internal/settings/service';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

/**
 * 通用设置组件
 * 包含语言、主题、启动行为等基础设置
 */
export function GeneralSettings() {
  const [language] = useState('zh-CN');
  const [theme] = useState('dark');
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [launchAtLoginSupported, setLaunchAtLoginSupported] = useState(true);
  const [isSettingLaunchAtLogin, setIsSettingLaunchAtLogin] = useState(false);
  const [showInMenu, setShowInMenu] = useState(true);
  const { info, error: showError } = useToast();

  useEffect(() => {
    let alive = true;

    const loadLaunchAtLogin = async () => {
      try {
        const supported = await SettingsService.IsLaunchAtLoginSupported();
        if (!alive) return;
        setLaunchAtLoginSupported(supported);
        if (!supported) return;

        const enabled = await SettingsService.GetLaunchAtLogin();
        if (!alive) return;
        setLaunchAtLogin(enabled);
      } catch (err) {
        console.error('[GeneralSettings] Failed to load launch-at-login status:', err);
      }
    };

    loadLaunchAtLogin();

    return () => {
      alive = false;
    };
  }, []);

  const handleLanguageChange = () => {
    info('正在开发中');
  };

  const handleThemeChange = () => {
    info('正在开发中');
  };

  const handleLaunchAtLoginChange = async (checked: boolean) => {
    if (!launchAtLoginSupported) return;
    setIsSettingLaunchAtLogin(true);
    const previous = launchAtLogin;
    setLaunchAtLogin(checked);
    try {
      await SettingsService.SetLaunchAtLogin(checked);
    } catch (err: any) {
      console.error('[GeneralSettings] Failed to set launch-at-login:', err);
      setLaunchAtLogin(previous);
      showError(err?.message || '启动项设置失败');
    } finally {
      setIsSettingLaunchAtLogin(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Icon name="cog" size={20} color="#A78BFA" />
          通用设置
        </h2>
        <p className="text-white/50 text-sm mt-1">
          配置应用的基础行为和外观
        </p>
      </div>

      {/* 语言设置 */}
      <div className="glass-light rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium">语言</h3>
            <p className="text-white/40 text-sm mt-0.5">选择应用的显示语言</p>
          </div>
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="选择语言" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zh-CN">简体中文</SelectItem>
              <SelectItem value="en-US">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 主题设置 */}
      <div className="glass-light rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium">主题</h3>
            <p className="text-white/40 text-sm mt-0.5">选择应用的外观主题</p>
          </div>
          <Select value={theme} onValueChange={handleThemeChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="选择主题" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">深色模式</SelectItem>
              <SelectItem value="light">浅色模式</SelectItem>
              <SelectItem value="system">跟随系统</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 启动设置 */}
      <div className="glass-light rounded-xl p-5 space-y-4">
        <h3 className="text-white font-medium">启动行为</h3>

        {/* 登录时启动 */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-white/80 text-sm">登录时启动</p>
            <p className="text-white/40 text-xs mt-0.5">开机后自动运行 LTools</p>
          </div>
          <label
            className={`relative inline-flex items-center ${launchAtLoginSupported ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
          >
            <input
              type="checkbox"
              checked={launchAtLogin}
              onChange={(e) => handleLaunchAtLoginChange(e.target.checked)}
              className="sr-only peer"
              disabled={!launchAtLoginSupported || isSettingLaunchAtLogin}
            />
            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7C3AED]"></div>
          </label>
        </div>

        {/* 显示在菜单栏 */}
        <div className="flex items-center justify-between py-2 border-t border-white/10">
          <div>
            <p className="text-white/80 text-sm">显示在菜单栏</p>
            <p className="text-white/40 text-xs mt-0.5">在系统菜单栏显示图标</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showInMenu}
              onChange={(e) => setShowInMenu(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7C3AED]"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
