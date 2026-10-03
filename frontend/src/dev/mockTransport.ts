/**
 * 开发用 Wails 后端 mock(纯浏览器模式)。
 *
 * 用法:npm run dev:mock (VITE_MOCK=1)
 * 原理:@wailsio/runtime 的 setTransport 会接管所有 runtime 调用,
 * objectID=0 是绑定方法调用,通过生成绑定的 AST 将 methodID 映射到名称。
 * 与真实后端对接时( wails3 dev )完全不加载本文件。
 */
import { setTransport } from '@wailsio/runtime'
import { bindingMethodNames } from './bindingMethods'

const bindingSources = import.meta.glob('../../bindings/ltools/**/*.ts', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>
const methodNames = bindingMethodNames(bindingSources)

/* ==================== 工具 ==================== */

export const PluginState = {
  PluginStateInstalled: 'installed',
  PluginStateEnabled: 'enabled',
  PluginStateDisabled: 'disabled',
  PluginStateError: 'error',
} as const

const ALL_PLUGIN_IDS = [
  'datetime.builtin',
  'calculator.builtin',
  'clipboard.builtin',
  'jsoneditor.builtin',
  'processmanager.builtin',
  'screenshot2.builtin',
  'sysinfo.builtin',
  'applauncher.builtin',
  'bookmark.builtin',
  'qrcode.builtin',
  'hosts.builtin',
  'tunnel.builtin',
  'kanban.builtin',
  'markdown.builtin',
  'imagebed.builtin',
  'imageprocessor.builtin',
  'sticky.builtin',
  'musicplayer.builtin',
  'vault.builtin',
  'ipinfo.builtin',
  'localtranslate.builtin',
  'password.builtin',
] as const

const PLUGIN_NAMES: Record<string, string> = {
  'datetime.builtin': '日期时间',
  'calculator.builtin': '计算器',
  'clipboard.builtin': '剪贴板历史',
  'jsoneditor.builtin': 'JSON 编辑器',
  'processmanager.builtin': '进程管理',
  'screenshot2.builtin': '截图',
  'sysinfo.builtin': '系统信息',
  'applauncher.builtin': '应用启动器',
  'bookmark.builtin': '书签',
  'qrcode.builtin': '二维码',
  'hosts.builtin': 'Hosts 编辑',
  'tunnel.builtin': '内网穿透',
  'kanban.builtin': '看板',
  'markdown.builtin': 'Markdown',
  'imagebed.builtin': '图床',
  'imageprocessor.builtin': '图片处理',
  'sticky.builtin': '便签',
  'musicplayer.builtin': '音乐播放',
  'vault.builtin': '密码库',
  'ipinfo.builtin': 'IP 信息',
  'localtranslate.builtin': '本地翻译',
  'password.builtin': '密码生成',
}

const PINNED = new Set(['clipboard.builtin', 'qrcode.builtin'])

function makePlugin(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: PLUGIN_NAMES[id] ?? id,
    version: '1.0.0',
    author: 'LTools',
    description: PLUGIN_NAMES[id] ? `${PLUGIN_NAMES[id]}工具` : '内置工具',
    type: 'builtin',
    state: PluginState.PluginStateEnabled,
    permissions: [],
    keywords: [],
    showInMenu: true,
    hasPage: true,
    pinned: PINNED.has(id),
    pinnedAt: PINNED.has(id) ? '2026-09-0' + ((id.length % 9) + 1) + 'T08:00:00Z' : '',
    score: (id.length * 7) % 40,
    lastUsedAt: ['clipboard.builtin', 'calculator.builtin', 'jsoneditor.builtin'].includes(id) ? '2026-10-03T09:30:00Z' : '',
    icon: '',
    homepage: '',
    ...overrides,
  }
}

function makePlugins(): Record<string, unknown>[] {
  return ALL_PLUGIN_IDS.map((id) => makePlugin(id))
}

const SYS_INFO = {
  cpuUsage: 23.5,
  cpuModel: 'Apple M2 Pro / 12C',
  memoryUsedPercent: 61.2,
  memoryTotal: 16.0,
  memoryUsed: 9.8,
  disks: [{ mount: '/', total: 512, used: 302, percent: 59.0 }],
  hostUptime: '3 天 4 小时',
  goVersion: 'go1.25.0',
  osInfo: 'Windows 11 Pro 26200',
}

/* ==================== handlers 表 ==================== */

const shortcuts = [
  { pluginId: 'search.window.builtin', keyCombo: 'ctrl+5', displayText: 'Ctrl+5', enabled: true },
  { pluginId: 'screenshot2.window.builtin', keyCombo: 'ctrl+shift+s', displayText: 'Ctrl+Shift+S', enabled: true },
]

const now = Date.now()

const processes = [
  { pid: 4104, name: 'explorer.exe', executablePath: 'C:\\Windows\\explorer.exe', cmdLine: 'explorer.exe', cpuPercent: 1.8, memoryPercent: 2.1, memoryBytes: 356 * 1024 * 1024, memoryMb: 356, status: 'running', username: 'Lee' },
  { pid: 8212, name: 'Code.exe', executablePath: 'C:\\Program Files\\Microsoft VS Code\\Code.exe', cmdLine: '"Code.exe"', cpuPercent: 6.4, memoryPercent: 8.7, memoryBytes: 1470 * 1024 * 1024, memoryMb: 1470, status: 'running', username: 'Lee' },
  { pid: 9340, name: 'ltools.exe', executablePath: 'C:\\Program Files\\ltools\\ltools.exe', cmdLine: 'ltools.exe', cpuPercent: 0.9, memoryPercent: 3.2, memoryBytes: 540 * 1024 * 1024, memoryMb: 540, status: 'running', username: 'Lee' },
  { pid: 2210, name: 'chrome.exe', executablePath: 'C:\\Program Files\\Google\\Chrome\\chrome.exe', cmdLine: '"chrome.exe" --type=renderer', cpuPercent: 12.3, memoryPercent: 11.4, memoryBytes: 1930 * 1024 * 1024, memoryMb: 1930, status: 'running', username: 'Lee' },
  { pid: 7788, name: 'Weixin.exe', executablePath: 'C:\\Program Files\\Tencent\\Weixin\\Weixin.exe', cmdLine: '"Weixin.exe"', cpuPercent: 2.2, memoryPercent: 4.4, memoryBytes: 745 * 1024 * 1024, memoryMb: 745, status: 'running', username: 'Lee' },
]

const hostsScenarios = [
  { id: 'h1', name: '本地开发', description: '开发环境域名映射', enabled: true, entries: [{ id: 'e1', ip: '127.0.0.1', hostname: 'dev.local', enabled: true, comment: '' }, { id: 'e2', ip: '192.168.1.10', hostname: 'api.dev.local', enabled: true, comment: '后端' }], updatedAt: '2026-09-30T10:00:00Z' },
  { id: 'h2', name: '屏蔽广告', description: '常见广告域名', enabled: false, entries: [{ id: 'e3', ip: '0.0.0.0', hostname: 'ads.example.com', enabled: true, comment: '' }], updatedAt: '2026-09-28T10:00:00Z' },
]

const kanbanBoard = {
  id: 'b1',
  name: 'LTools 开发',
  description: '主开发看板',
  createdAt: '2026-09-01T08:00:00Z',
  updatedAt: '2026-10-02T08:00:00Z',
  labels: [
    { id: 'l1', name: '功能', color: '#0A84FF' },
    { id: 'l2', name: '缺陷', color: '#FF453A' },
    { id: 'l3', name: '优化', color: '#30D158' },
  ],
  columns: [
    { id: 'col1', name: '待办', position: 0, cards: [{ id: 'c1', title: '重写设置页布局', description: '左导航右表单', position: 0, labels: ['l1'], checklists: [], createdAt: now, updatedAt: now, dueDate: '' }, { id: 'c2', title: '修 kanban 拖拽偶发失效', description: '', position: 1, labels: ['l2'], checklists: [], createdAt: now, updatedAt: now, dueDate: '' }] },
    { id: 'col2', name: '进行中', position: 1, cards: [{ id: 'c3', title: '设计系统 v2', description: '石墨+钴蓝,克制用色', position: 0, labels: ['l1', 'l3'], checklists: [{ id: 'k1', text: 'tokens', completed: true }, { id: 'k2', text: 'UI kit', completed: false }], createdAt: now, updatedAt: now, dueDate: '' }] },
    { id: 'col3', name: '已完成', position: 2, cards: [{ id: 'c4', title: '移除紫色主题', description: '', position: 0, labels: ['l3'], checklists: [], createdAt: now, updatedAt: now, completedAt: now, dueDate: '' }] },
  ],
}

const vaultEntries = [
  { id: 'v1', title: 'GitHub', website: 'https://github.com', username: 'lee@example.com', password: 'mock', notes: '', category: '开发', tags: ['代码'], favorite: true, createdAt: now, updatedAt: now },
  { id: 'v2', title: '公司邮箱', website: 'https://mail.example.com', username: 'lee', password: 'mock', notes: '', category: '工作', tags: [], favorite: false, createdAt: now, updatedAt: now },
]

const bookmarks = [
  { id: 'bm1', title: 'Wails v3 文档', url: 'https://v3.wails.io/', folder: '开发', favicon: '' },
  { id: 'bm2', title: 'React', url: 'https://react.dev', folder: '开发', favicon: '' },
  { id: 'bm3', title: 'Tailwind CSS', url: 'https://tailwindcss.com', folder: '设计', favicon: '' },
]

const stickyNotes = [
  { id: 'n1', content: '记得 review PR #42', color: 'yellow', pinned: false, updatedAt: now },
]

const ipInfo = {
  ip: '203.0.113.42',
  country: '中国',
  region: '上海',
  city: '上海',
  isp: 'China Telecom',
  timezone: 'Asia/Shanghai',
  latitude: 31.23,
  longitude: 121.47,
}

const tunnels = [
  { id: 't1', name: '开发服务器', protocol: 'tcp', localPort: 8080, remotePort: 6000, serverAddr: 'dev.example.com', status: 'running', autoStart: true },
  { id: 't2', name: '内网 NAS', protocol: 'tcp', localPort: 5000, remotePort: 7000, serverAddr: 'dev.example.com', status: 'stopped', autoStart: false },
]

const handlers: Record<string, (args: any) => unknown> = {
  /* --- 插件服务(真实方法面见 bindings/ltools/internal/plugins/pluginservice.ts) --- */
  'ltools/internal/plugins.PluginService.List': () => makePlugins(),
  'ltools/internal/plugins.PluginService.Get': (args) =>
    makePlugins().find((p) => p.id === args?.[0]) ?? makePlugin('calculator.builtin'),
  'ltools/internal/plugins.PluginService.Search': () => makePlugins(),
  'ltools/internal/plugins.PluginService.TogglePin': () => null,
  'ltools/internal/plugins.PluginService.RecordUsage': () => null,
  'ltools/internal/plugins.PluginService.GetAvailablePermissions': () =>
    ['filesystem', 'network', 'clipboard', 'notification', 'process'],
  'ltools/internal/plugins.PluginService.GetPermissions': () => [],
  'ltools/internal/plugins.PluginService.CheckPermission': () => true,

  /* --- 系统信息 --- */
  'ltools/plugins/sysinfo.SysInfoService.GetSystemInfo': () => SYS_INFO,
  'ltools/plugins/sysinfo.SysInfoService.GetCPUInfo': () => ({ cpuUsage: SYS_INFO.cpuUsage, cpuModel: SYS_INFO.cpuModel, cores: 12 }),
  'ltools/plugins/sysinfo.SysInfoService.GetMemoryInfo': () => ({ memoryUsed: '9.8 GB', memoryTotal: '16.0 GB', memoryUsedPercent: SYS_INFO.memoryUsedPercent }),
  'ltools/plugins/sysinfo.SysInfoService.GetDiskInfo': () => [
    { path: 'C:\\', total: '476 GB', used: '281 GB', free: '195 GB', usedPercent: 59.0 },
  ],
  'ltools/plugins/sysinfo.SysInfoService.GetNetworkInfo': () => [
    { name: 'Ethernet', addrs: ['192.168.1.100'] },
  ],
  'ltools/plugins/sysinfo.SysInfoService.GetHostInfo': () => ({ hostname: 'DESKTOP-LEE', os: SYS_INFO.osInfo, platform: 'windows', uptime: SYS_INFO.hostUptime }),
  'ltools/plugins/sysinfo.SysInfoService.GetGoVersion': () => 'go1.25.0',
  'ltools/plugins/sysinfo.SysInfoService.GetUptime': () => SYS_INFO.hostUptime,

  /* --- 快捷键 --- */
  'ltools/internal/plugins.ShortcutService.GetAllShortcuts': () => shortcuts,
  'ltools/internal/plugins.ShortcutService.SetShortcut': (args) => {
    const [keyCombo, pluginId] = args;
    if (shortcuts.some(item => item.keyCombo === keyCombo && item.pluginId !== pluginId)) throw new Error('快捷键冲突');
    shortcuts.push({ pluginId, keyCombo, displayText: keyCombo, enabled: true });
    return null;
  },
  'ltools/internal/plugins.ShortcutService.RemoveShortcut': (args) => {
    const index = shortcuts.findIndex(item => item.keyCombo === args[0]);
    if (index >= 0) shortcuts.splice(index, 1);
    return null;
  },
  'ltools/internal/plugins.ShortcutService.CheckConflict': () => null,

  /* --- 搜索窗口 --- */
  'ltools/internal/plugins.SearchWindowService.Search': (args) => makePlugins()
    .filter(item => `${item.name} ${item.id}`.toLowerCase().includes(String(args[0]).toLowerCase()))
    .map(item => ({ ...item, pluginId: item.id, type: 'plugin', icon: '' })),
  'ltools/internal/plugins.SearchWindowService.Hide': () => null,
  'ltools/internal/plugins.SearchWindowService.ShowWithQuery': () => null,
  'ltools/internal/plugins.SearchWindowService.OpenPlugin': () => null,
  'ltools/internal/plugins.SearchWindowService.OpenApp': () => null,
  'ltools/internal/plugins.SearchWindowService.OpenPath': () => null,
  'ltools/internal/plugins.SearchWindowService.OpenMainWindow': () => null,
  'ltools/internal/plugins.SearchWindowService.SearchFiles': (args) => ({
    results: String(args[0]).includes('报告') ? Array.from({ length: 12 }, (_, index) => ({
      name: index === 0 ? '报告.docx' : `项目报告 ${index}.pdf`, path: `C:\\Users\\Lee\\Documents\\项目报告 ${index}.pdf`,
      description: `C:\\Users\\Lee\\Documents\\项目报告 ${index}.pdf`, type: 'file', icon: '',
    })) : [], indexing: false, limited: false,
  }),
  'ltools/plugins/applauncher.AppLauncherService.Search': (args) =>
    ['Python 3.12', 'IDLE (Python 3.12)', 'Windows PowerShell', 'Visual Studio Code']
      .filter(name => name.toLowerCase().includes(String(args[0]).toLowerCase()))
      .map(name => ({ id: name, name, description: name, iconData: '' })),
  'ltools/plugins/applauncher.AppLauncherService.GetApps': () => [],

  /* --- 剪贴板(Windows 下 timestamp 为字符串) --- */
  'ltools/plugins/clipboard.ClipboardService.GetHistory': () => [
    { id: 'c1', type: 'text', content: 'npx create-vite@latest my-app --template react-ts', timestamp: new Date(now - 60_000).toISOString() },
    { id: 'c2', type: 'text', content: 'const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) } }', timestamp: new Date(now - 3600_000).toISOString() },
    { id: 'c3', type: 'text', content: 'https://v3.wails.io/learn/guides', timestamp: new Date(now - 7200_000).toISOString() },
  ],
  'ltools/plugins/clipboard.ClipboardService.SearchHistory': () => [],
  'ltools/plugins/clipboard.ClipboardService.GetMaxHistory': () => 100,
  'ltools/plugins/clipboard.ClipboardService.GetLastItem': () => null,

  /* --- 设置(登录启动相关) --- */
  'ltools/internal/settings.Service.IsLaunchAtLoginSupported': () => true,
  'ltools/internal/settings.Service.GetLaunchAtLogin': () => true,
  'ltools/internal/settings.Service.SetLaunchAtLogin': () => null,

  /* --- 进程管理 --- */
  'ltools/plugins/processmanager.ProcessManagerService.GetProcesses': () => [processes, processes.length],
  'ltools/plugins/processmanager.ProcessManagerService.GetSystemInfo': () => SYS_INFO,
  'ltools/plugins/processmanager.ProcessManagerService.EnterView': () => null,
  'ltools/plugins/processmanager.ProcessManagerService.LeaveView': () => null,
  'ltools/plugins/processmanager.ProcessManagerService.KillProcess': () => null,
  'ltools/plugins/processmanager.ProcessManagerService.ForceKillProcess': () => null,

  /* --- Hosts --- */
  'ltools/plugins/hosts.HostsService.GetScenarios': () => hostsScenarios,
  'ltools/plugins/hosts.HostsService.ListBackups': () => [],

  /* --- 看板 --- */
  'ltools/plugins/kanban.KanbanService.GetBoards': () => [kanbanBoard],
  'ltools/plugins/kanban.KanbanService.GetBoard': () => kanbanBoard,
  'ltools/plugins/kanban.KanbanService.CreateBoard': () => kanbanBoard,
  'ltools/plugins/kanban.KanbanService.UpdateBoard': () => kanbanBoard,
  'ltools/plugins/kanban.KanbanService.CreateCard': () => null,
  'ltools/plugins/kanban.KanbanService.UpdateCard': () => null,

  /* --- 密码库 --- */
  'ltools/plugins/vault.VaultService.Status': () => ({ initialized: true, locked: false, entryCount: vaultEntries.length }),
  'ltools/plugins/vault.VaultService.IsInitialized': () => true,
  'ltools/plugins/vault.VaultService.IsLocked': () => false,
  'ltools/plugins/vault.VaultService.ListEntries': () => vaultEntries,
  'ltools/plugins/vault.VaultService.GetEntry': (args) => vaultEntries.find((e) => e.id === args?.[0]),
  'ltools/plugins/vault.VaultService.GetCategories': () => ['开发', '工作'],

  /* --- 书签 --- */
  'ltools/plugins/bookmark.BookmarkService.Search': () => bookmarks,
  'ltools/plugins/bookmark.BookmarkService.GetCacheStatus': () => ({ total: bookmarks.length, lastSync: new Date(now).toISOString() }),

  /* --- 便签 --- */
  'ltools/plugins/sticky.StickyService.ListNotes': () => stickyNotes,
  'ltools/plugins/sticky.StickyService.GetAvailableColors': () => ['yellow', 'green', 'blue', 'pink'],

  /* --- IP 信息 --- */
  'ltools/plugins/ipinfo.Service.GetIPInfo': () => ipInfo,
  'ltools/plugins/ipinfo.Service.GetLocalIPs': () => ['192.168.1.100'],
  'ltools/plugins/ipinfo.Service.GetHostname': () => 'DESKTOP-LEE',
  'ltools/plugins/ipinfo.Service.GetMACAddress': () => 'AA-BB-CC-DD-EE-FF',

  /* --- 内网穿透 --- */
  'ltools/plugins/tunnel.TunnelService.GetTunnels': () => tunnels,
  'ltools/plugins/tunnel.TunnelService.GetInstallationStatus': () => ({ installed: true, version: '0.5.0' }),

  /* --- 二维码 --- */
  'ltools/plugins/qrcode.QrcodeService.GetSaveDir': () => 'C:\\Users\\Lee\\Pictures\\LTools',
  'ltools/plugins/qrcode.QrcodeService.ListSavedFiles': () => [],

  /* --- 日期时间 --- */
  'ltools/plugins/datetime.DateTimeService.GetCurrentTime': () => new Date().toISOString(),
  'ltools/plugins/datetime.DateTimeService.GetTimezone': () => 'Asia/Shanghai (CST, +8)',

  /* --- 更新 --- */
  'ltools/internal/update.Service.CheckForUpdates': () => null,
  'ltools/internal/update.Service.GetCurrentVersion': () => '0.1.0',
  'ltools/plugins/musicplayer.ServiceLX.GetRandomSongs': () => [],
  'ltools/plugins/musicplayer.ServiceLX.GetLikeList': () => [],
  'ltools/plugins/musicplayer.ServiceLX.GetLikeListPaginated': () => ({ songs: [], total: 0, hasMore: false }),
  'ltools/plugins/musicplayer.ServiceLX.GetHotSongs': () => ({ songs: [], total: 0, hasMore: false }),
  'ltools/plugins/musicplayer.ServiceLX.Search': () => [],
  'ltools/plugins/musicplayer.ServiceLX.PlayLikeList': () => [],
  'ltools/plugins/musicplayer.ServiceLX.PlayHotSongs': () => [],
  'ltools/plugins/musicplayer.ServiceLX.GetLyric': () => '',
  'ltools/plugins/musicplayer.ServiceLX.GetPicURL': () => '',
  'ltools/plugins/musicplayer.ServiceLX.GetSongURLWithMetadata': () => { throw new Error('Mock 模式不提供真实音频'); },
  'ltools/plugins/markdown.MarkdownService.GetStats': (args) => ({
    characters: args[0].length, words: args[0].split(/\s+/).length,
    lines: args[0].split('\n').length, readTime: '1 分钟',
  }),
}

/* ==================== transport 接入 ==================== */

function fallback(name: string): (args: any) => unknown {
  return () => {
    console.warn(`[wailsMock] 未配置的调用: ${name},返回 null`)
    throw new Error(`Mock 未配置方法: ${name}`)
  }
}

export function enableWailsMock() {
  setTransport({
    async call(objectID: number, _method: number, _windowName: string, args: any) {
      // objectID 0 = Call(绑定方法)
      if (objectID === 0) {
        const name: string = args?.methodName ?? methodNames.get(args?.methodID) ?? ''
        if (!name) throw new Error(`Mock 未识别 methodID: ${args?.methodID}`)
        const handler = handlers[name] ?? fallback(name)
        return handler(args?.args)
      }
      // Events / Window / Dialog 等运行时调用:静默空实现
      return null
    },
  })
  console.info('[wailsMock] 已启用 Wails 后端 mock(纯前端模式)')
}
