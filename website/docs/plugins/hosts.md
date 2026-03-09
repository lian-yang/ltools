# 🌐 Hosts 管理

编辑和管理系统 hosts 文件的工具，方便开发者和运维人员。

## 功能特性

- ✅ 可视化编辑 hosts
- ✅ 快速开关规则
- ✅ 分组管理
- ✅ 备份恢复
- ✅ DNS 刷新

## 使用方法

### 打开工具

1. 全局搜索 (`Cmd/Ctrl+5`)
2. 输入 `hosts`
3. 打开 Hosts 管理工具

### 添加规则

1. 点击「添加规则」
2. 输入 IP 地址（如 `127.0.0.1`）
3. 输入域名（如 `example.com`）
4. 添加备注（可选）
5. 保存

### 启用/禁用规则

- **单条规则**：点击规则前的开关
- **批量操作**：选择多条规则后批量启用/禁用

### 分组管理

创建分组组织 hosts 规则：
- 开发环境
- 测试环境
- 生产环境
- 自定义分组

## 编辑功能

### 在线编辑

- 直接在界面上修改
- 支持批量编辑
- 实时语法检查

### 外部编辑

1. 点击「用编辑器打开」
2. 使用系统默认编辑器
3. 保存后自动刷新

## 权限说明

### macOS

首次使用需要输入管理员密码：
- 授权修改 `/etc/hosts`
- 授权刷新 DNS 缓存

### Windows

需要管理员权限：
- 右键以管理员身份运行
- 授权修改 `C:\Windows\System32\drivers\etc\hosts`

### Linux

需要 sudo 权限：
- 输入用户密码授权

## DNS 刷新

修改 hosts 后自动刷新 DNS：

**macOS**:
```bash
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

**Windows**:
```bash
ipconfig /flushdns
```

**Linux**:
```bash
sudo systemd-resolve --flush-caches
```

## 备份与恢复

### 备份

1. 点击「导出备份」
2. 选择保存位置
3. 保存为 `.hosts` 文件

### 恢复

1. 点击「导入备份」
2. 选择备份文件
3. 确认导入

## 常用示例

### 本地开发

```
127.0.0.1  localhost
127.0.0.1  myapp.local
127.0.0.1  api.myapp.local
```

### 屏蔽广告

```
127.0.0.1  ad.example.com
127.0.0.1  tracker.example.com
```

### 测试环境

```
192.168.1.100  dev.example.com
192.168.1.101  test.example.com
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd/Ctrl+N` | 新建规则 |
| `Cmd/Ctrl+S` | 保存 |
| `Cmd/Ctrl+F` | 搜索 |
| `Delete` | 删除选中规则 |

## 注意事项

- ⚠️ 修改 hosts 可能影响网络访问
- ⚠️ 建议修改前先备份
- ⚠️ 某些域名可能需要 HTTPS 证书
- ⚠️ 浏览器可能缓存 DNS，需要清除缓存
