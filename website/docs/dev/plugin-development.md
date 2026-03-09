# 插件开发指南

本指南将帮助你开发 LTools 插件。

## 插件架构

### 核心接口

所有插件必须实现 `Plugin` 接口：

```go
package plugins

type Plugin interface {
    Metadata() *PluginMetadata
    Init(app *application.App) error
    ServiceStartup(app *application.App) error
    ServiceShutdown(app *application.App) error
    Enabled() bool
    SetEnabled(enabled bool) error
}
```

### 基础实现

使用 `BasePlugin` 简化开发：

```go
type MyPlugin struct {
    *plugins.BasePlugin
    app *application.App
}

func NewMyPlugin() *MyPlugin {
    metadata := &plugins.PluginMetadata{
        ID:          "myplugin.builtin",
        Name:        "我的插件",
        Version:     "1.0.0",
        Type:        plugins.PluginTypeBuiltIn,
        State:       plugins.PluginStateInstalled,
        Description: "插件功能描述",
        Keywords:    []string{"关键词1", "关键词2"},
        Permissions: []plugins.Permission{
            plugins.PermissionFileSystem,
        },
    }
    return &MyPlugin{
        BasePlugin: plugins.NewBasePlugin(metadata),
    }
}
```

## 创建新插件

### 1. 创建目录和文件

```
plugins/
└── myplugin/
    ├── myplugin.go      # 插件实现
    └── service.go       # 服务实现（可选）
```

### 2. 实现插件结构

```go
package myplugin

import (
    "github.com/wailsapp/wails/v3/pkg/application"
    "ltools/internal/plugins"
)

type MyPlugin struct {
    *plugins.BasePlugin
    app *application.App
}

func NewMyPlugin() *MyPlugin {
    return &MyPlugin{
        BasePlugin: plugins.NewBasePlugin(&plugins.PluginMetadata{
            ID:          "myplugin.builtin",
            Name:        "我的插件",
            Version:     "1.0.0",
            Description: "插件功能描述",
            Type:        plugins.PluginTypeBuiltIn,
            Keywords:    []string{"myplugin", "关键词"},
        }),
    }
}

func (p *MyPlugin) Init(app *application.App) error {
    p.app = app
    return nil
}

func (p *MyPlugin) ServiceStartup(app *application.App) error {
    // 应用启动时调用
    return nil
}

func (p *MyPlugin) ServiceShutdown(app *application.App) error {
    // 应用关闭时调用
    return nil
}
```

### 3. 创建服务

如果需要与前端交互，创建服务：

```go
package myplugin

import "github.com/wailsapp/wails/v3/pkg/application"

type MyPluginService struct {
    plugin *MyPlugin
    app    *application.App
}

func NewMyPluginService(plugin *MyPlugin, app *application.App) *MyPluginService {
    return &MyPluginService{plugin: plugin, app: app}
}

// DoSomething 导出给前端调用的方法
func (s *MyPluginService) DoSomething(input string) (string, error) {
    return "Result: " + input, nil
}

// GetData 获取数据
func (s *MyPluginService) GetData() ([]string, error) {
    return []string{"item1", "item2"}, nil
}
```

### 4. 注册插件

在 `main.go` 中注册：

```go
// 导入插件
import "ltools/plugins/myplugin"

func main() {
    // ...

    // 创建并注册插件
    myPlugin := myplugin.NewMyPlugin()
    pluginManager.Register(myPlugin)

    // 创建并注册服务
    myPluginService := myplugin.NewMyPluginService(myPlugin, app)
    app.RegisterService(application.NewService(myPluginService))

    // ...
}
```

## 前端组件

### 1. 创建组件

```tsx
// frontend/src/components/MyPluginWidget.tsx
import { useState, useEffect } from 'react'
import { MyPluginService } from '../bindings'

export function MyPluginWidget() {
  const [data, setData] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [result, setResult] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const items = await MyPluginService.GetData()
    setData(items)
  }

  const handleSubmit = async () => {
    const res = await MyPluginService.DoSomething(input)
    setResult(res)
  }

  return (
    <div className="p-4">
      <h2>我的插件</h2>

      <div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入内容"
        />
        <button onClick={handleSubmit}>提交</button>
      </div>

      {result && <p>结果: {result}</p>}

      <ul>
        {data.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
```

### 2. 添加到路由

```tsx
// 在适当的位置导入和注册组件
import { MyPluginWidget } from '../components/MyPluginWidget'

// 添加到路由配置
{
  path: '/plugins/myplugin',
  element: <MyPluginWidget />
}
```

## 事件系统

### 发送事件（后端）

```go
func init() {
    application.RegisterEvent[string]("myplugin:data")
}

func (s *MyPluginService) SendEvent(data string) {
    s.app.Event.Emit("myplugin:data", data)
}
```

### 监听事件（前端）

```tsx
import { Events } from '@wailsio/runtime'

useEffect(() => {
  const unsubscribe = Events.On('myplugin:data', (ev: { data: string }) => {
    console.log('收到数据:', ev.data)
  })

  return () => unsubscribe()
}, [])
```

## 最佳实践

### 1. 错误处理

```go
func (s *MyPluginService) RiskyOperation() error {
    if err := s.validate(); err != nil {
        return fmt.Errorf("validation failed: %w", err)
    }
    // ...
    return nil
}
```

### 2. 资源清理

```go
func (p *MyPlugin) ServiceShutdown(app *application.App) error {
    // 关闭文件句柄
    // 停止 goroutines
    // 清理临时文件
    return nil
}
```

### 3. 配置管理

```go
type MyPluginConfig struct {
    Enabled bool   `json:"enabled"`
    ApiKey  string `json:"apiKey"`
}

func (p *MyPlugin) LoadConfig() (*MyPluginConfig, error) {
    // 从文件加载配置
}
```

### 4. 日志记录

```go
import "log"

func (s *MyPluginService) DoWork() {
    log.Println("[MyPlugin] Starting work...")
    // ...
}
```

## 调试技巧

### 后端调试

```bash
# 打印详细日志
task dev

# 查看插件加载日志
grep "MyPlugin" /tmp/gohook_debug.log
```

### 前端调试

1. 打开开发者工具：`Cmd+Option+I` (macOS) / `Ctrl+Shift+I` (Windows/Linux)
2. 查看 Console 标签
3. 检查 Network 请求

### 常见问题

**插件未加载**：
- 检查 `main.go` 是否正确注册
- 查看启动日志

**前端无法调用后端方法**：
- 重新生成绑定：`task common:generate:bindings`
- 检查方法名拼写
- 确认服务已注册

**事件未收到**：
- 确认事件名一致
- 检查事件类型注册

## 示例插件

参考现有插件实现：

- [计算器](../../plugins/calculator) - 简单功能插件
- [剪贴板](../../plugins/clipboard) - 带状态管理的插件
- [截图工具](../../plugins/screenshot2) - 复杂功能插件
