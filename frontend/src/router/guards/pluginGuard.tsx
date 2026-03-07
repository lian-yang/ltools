import { useEffect, useRef } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import * as ProcessManagerService from '../../../bindings/ltools/plugins/processmanager/processmanagerservice'
import * as PluginService from '../../../bindings/ltools/internal/plugins/pluginservice'
import type { PluginLifecycleHandler } from '../types'

/**
 * 插件生命周期处理映射
 * 每个插件可以注册自己的进入/离开处理函数
 */
const pluginEnterHandlers: Record<string, PluginLifecycleHandler> = {
  'processmanager.builtin': async () => {
    await ProcessManagerService.EnterView()
  },
  // 未来可扩展其他插件
}

const pluginLeaveHandlers: Record<string, PluginLifecycleHandler> = {
  'processmanager.builtin': async () => {
    await ProcessManagerService.LeaveView()
  },
  // 未来可扩展其他插件
}

/**
 * 插件守卫组件
 * 统一管理插件的进入/离开生命周期
 */
export function PluginGuard({ children }: { children: React.ReactNode }) {
  const { pluginId } = useParams<{ pluginId: string }>()
  const location = useLocation()
  const previousPluginIdRef = useRef<string | null>(null)

  useEffect(() => {
    const currentPluginId = pluginId || null
    const previousPluginId = previousPluginIdRef.current

    // 如果插件 ID 没有变化，不做处理
    if (currentPluginId === previousPluginId) {
      return
    }

    // 处理离开上一个插件
    if (previousPluginId && pluginLeaveHandlers[previousPluginId]) {
      pluginLeaveHandlers[previousPluginId](previousPluginId).catch(err => {
        console.error(`Failed to leave plugin ${previousPluginId}:`, err)
      })
    }

    // 处理进入新插件
    if (currentPluginId && pluginEnterHandlers[currentPluginId]) {
      pluginEnterHandlers[currentPluginId](currentPluginId).catch(err => {
        console.error(`Failed to enter plugin ${currentPluginId}:`, err)
      })
    }

    // 记录使用（fire-and-forget）
    if (currentPluginId) {
      PluginService.RecordUsage(currentPluginId).catch(err => {
        console.error(`Failed to record usage for ${currentPluginId}:`, err)
      })
    }

    // 更新上一个插件 ID
    previousPluginIdRef.current = currentPluginId
  }, [pluginId, location.pathname])

  return <>{children}</>
}

/**
 * 注册插件生命周期处理函数
 */
export function registerPluginLifecycle(
  pluginId: string,
  onEnter?: PluginLifecycleHandler,
  onLeave?: PluginLifecycleHandler
) {
  if (onEnter) {
    pluginEnterHandlers[pluginId] = onEnter
  }
  if (onLeave) {
    pluginLeaveHandlers[pluginId] = onLeave
  }
}
