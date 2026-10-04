import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { getLanguage, getLanguageSetting, setLanguageSetting, t, type LanguageSetting } from '@/i18n';
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
  const [language, setLanguageState] = useState<LanguageSetting>(getLanguageSetting());
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

  const handleLanguageChange = (value: string) => {
    const setting = value as LanguageSetting;
    const prevLang = getLanguage();
    setLanguageState(setting);
    const changed = setLanguageSetting(setting);
    if (!changed) return;
    if (getLanguage() !== prevLang) {
      // 模块级常量中存在 t() 调用，切换语言后整页刷新确保全部生效
      window.location.reload();
    } else {
      info(t('语言设置已保存'));
    }
  };

  const handleThemeChange = () => {
    info(t('正在开发中'));
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
      showError(err?.message || t('启动项设置失败'));
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
          {t('通用设置')}
        </h2>
        <p className="text-white/50 text-sm mt-1">
          {t('配置应用的基础行为和外观')}
        </p>
      </div>

      {/* 语言设置 */}
      <div className="glass-light rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium">{t('语言')}</h3>
            <p className="text-white/40 text-sm mt-0.5">{t('选择应用的显示语言')}</p>
          </div>
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("选择语言")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{t('跟随系统')}</SelectItem>
              <SelectItem value="zh">{t('简体中文')}</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 主题设置 */}
      <div className="glass-light rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium">{t('主题')}</h3>
            <p className="text-white/40 text-sm mt-0.5">{t('选择应用的外观主题')}</p>
          </div>
          <Select value={theme} onValueChange={handleThemeChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("选择主题")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">{t('深色模式')}</SelectItem>
              <SelectItem value="light">{t('浅色模式')}</SelectItem>
              <SelectItem value="system">{t('跟随系统')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 启动设置 */}
      <div className="glass-light rounded-xl p-5 space-y-4">
        <h3 className="text-white font-medium">{t('启动行为')}</h3>

        {/* 登录时启动 */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-white/80 text-sm">{t('登录时启动')}</p>
            <p className="text-white/40 text-xs mt-0.5">{t('开机后自动运行 LTools')}</p>
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
            <p className="text-white/80 text-sm">{t('显示在菜单栏')}</p>
            <p className="text-white/40 text-xs mt-0.5">{t('在系统菜单栏显示图标')}</p>
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
