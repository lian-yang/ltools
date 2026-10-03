import { useState, useEffect, useCallback } from 'react'
import { Settings as SettingsComponent } from '../components/Settings'
import * as ShortcutService from '../../bindings/ltools/internal/plugins/shortcutservice'

/**
 * 设置页面组件
 */
function Settings() {
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({})

  // 加载快捷键配置
  const reloadShortcuts = useCallback(async () => {
    try {
      console.log('[Settings] Loading shortcuts from backend...')
      const data = await ShortcutService.GetAllShortcuts()
      console.log('[Settings] Raw shortcuts data:', data)

      const shortcutMap: Record<string, string> = {}
      data.forEach(s => {
        if (s.enabled) {
          shortcutMap[s.keyCombo] = s.pluginId
        }
      })

      setShortcuts(shortcutMap)
      console.log('[Settings] Shortcuts loaded successfully:', shortcutMap)
    } catch (error) {
      console.error('[Settings] Failed to load shortcuts:', error)
    }
  }, [])

  useEffect(() => {
    reloadShortcuts()
  }, [reloadShortcuts])

  // 设置快捷键
  const handleSetShortcut = async (pluginId: string, keyCombo: string) => {
    console.log('[Settings] SetShortcut called:', { pluginId, keyCombo })
    try {
      await ShortcutService.SetShortcut(keyCombo, pluginId)
      // Register the replacement before removing old bindings so failures keep the old key usable.
      for (const [oldKey, owner] of Object.entries(shortcuts)) {
        if (owner === pluginId && oldKey !== keyCombo) await ShortcutService.RemoveShortcut(oldKey)
      }
      await reloadShortcuts()
    } catch (error) {
      console.error('[Settings] Failed to set shortcut:', error)
      throw error
    }
  }

  // 移除快捷键
  const handleRemoveShortcut = async (keyCombo: string) => {
    console.log('[Settings] RemoveShortcut called:', { keyCombo })
    try {
      await ShortcutService.RemoveShortcut(keyCombo)
      await reloadShortcuts()
    } catch (error) {
      console.error('[Settings] Failed to remove shortcut:', error)
      throw error
    }
  }

  return (
    <SettingsComponent
      shortcuts={shortcuts}
      onSetShortcut={handleSetShortcut}
      onRemoveShortcut={handleRemoveShortcut}
    />
  )
}

export default Settings
