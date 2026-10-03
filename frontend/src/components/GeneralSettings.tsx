import { useEffect, useState } from 'react';
import * as SettingsService from '../../bindings/ltools/internal/settings/service';
import { useToast } from '../hooks/useToast';
import { useTheme, ThemePreference } from '../hooks/useTheme';
import { Field, PageHeader, SectionTitle, Toggle } from './ui';
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
  const { theme, setTheme } = useTheme();
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

  const handleThemeChange = (value: string) => {
    setTheme(value as ThemePreference);
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
    <div className="animate-fade-in">
      <PageHeader title="通用设置" description="配置应用的基础行为和外观" />

      {/* 语言与外观 */}
      <SectionTitle title="语言与外观" className="mb-2" />
      <div className="card-inset px-4">
        <Field horizontal className="hairline-b" label="语言" hint="选择应用的显示语言">
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="选择语言" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zh-CN">简体中文</SelectItem>
              <SelectItem value="en-US">English</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field horizontal label="主题" hint="选择应用的外观主题">
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
        </Field>
      </div>

      {/* 启动行为 */}
      <SectionTitle title="启动" className="mb-2 mt-5" />
      <div className="card-inset px-4">
        <Field
          horizontal
          className="hairline-b"
          label="登录时启动"
          hint={launchAtLoginSupported ? '开机后自动运行 LTools' : '当前平台不支持开机自启'}
        >
          <Toggle
            checked={launchAtLogin}
            onChange={handleLaunchAtLoginChange}
            disabled={!launchAtLoginSupported || isSettingLaunchAtLogin}
            label="登录时启动"
          />
        </Field>
        <Field horizontal label="显示在菜单栏" hint="在系统菜单栏显示图标">
          <Toggle
            checked={showInMenu}
            onChange={(checked) => setShowInMenu(checked)}
            label="显示在菜单栏"
          />
        </Field>
      </div>
    </div>
  );
}
