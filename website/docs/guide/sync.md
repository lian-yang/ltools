# 数据同步

基于 Git 仓库的用户数据同步功能，支持多设备数据同步和备份。

## 功能特性

- ✅ 基于 Git 仓库同步
- ✅ 自动定时同步
- ✅ HTTPS 和 SSH 认证
- ✅ Token 安全存储
- ✅ 冲突自动处理
- ✅ 自定义忽略规则

## 工作原理

### 同步架构

```
┌──────────────────────────────┐
│   本地数据目录                │
│   ~/.ltools/                 │
│   ├── plugins.json           │
│   ├── shortcuts.json         │
│   ├── sticky/                │
│   └── ...                    │
└──────────────────────────────┘
         ↓ 复制文件
┌──────────────────────────────┐
│   同步目录                    │
│   ~/.ltools/.sync/           │
│   └── (Git 仓库)             │
└──────────────────────────────┘
         ↓ Git Push
┌──────────────────────────────┐
│   远程 Git 仓库               │
│   (GitHub/GitLab/等)         │
└──────────────────────────────┘
```

### 同步流程

1. **复制文件**：将 `~/.ltools/` 中的文件复制到 `~/.ltools/.sync/`
2. **拉取更新**：从远程仓库拉取最新变更（`git pull`）
3. **暂存变更**：添加所有变更到暂存区（`git add`）
4. **创建提交**：创建同步提交（`git commit`）
5. **推送变更**：推送到远程仓库（`git push`）

### 冲突处理

自动处理推送冲突：
1. 首先尝试普通推送
2. 如果失败，拉取远程变更
3. 再次尝试推送
4. 如果仍失败，使用 `--force-with-lease` 强制推送

> **注意**：强制推送会覆盖远程变更，但使用 `--force-with-lease` 更安全

## 配置同步

### 前置要求

- **Git 已安装**：系统必须安装 Git
- **Git 仓库**：准备一个 Git 仓库（GitHub、GitLab、Gitee 等）
- **认证方式**：HTTPS（Token）或 SSH（密钥）

### 步骤 1：创建同步仓库

在 GitHub 或其他 Git 托管平台创建一个**私有仓库**：

```bash
# 示例：在 GitHub 创建私有仓库
# https://github.com/new
# 仓库名：ltools-sync
# 可见性：Private（推荐）
```

### 步骤 2：配置同步设置

1. 打开 LTools 设置
2. 进入"数据同步"标签页
3. 输入仓库 URL：
   - **HTTPS**：`https://github.com/用户名/ltools-sync.git`
   - **SSH**：`git@github.com:用户名/ltools-sync.git`
4. 选择同步间隔（默认：30 分钟）
5. 启用自动同步

### 步骤 3：配置认证

**方式 1：HTTPS + Token（推荐）**

1. 生成 GitHub Personal Access Token：
   - 访问 https://github.com/settings/tokens
   - 点击 "Generate new token (classic)"
   - 勾选 `repo` 权限
   - 生成并复制 Token

2. 在 LTools 中配置 Token：
   - 点击"配置 Token"
   - 粘贴 Token
   - 保存（Token 会安全存储到系统钥匙串）

**方式 2：SSH 密钥**

1. 生成 SSH 密钥：
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

2. 添加公钥到 GitHub：
   - 复制 `~/.ssh/id_ed25519.pub` 内容
   - GitHub → Settings → SSH and GPG keys → New SSH key

3. 测试 SSH 连接：
   ```bash
   ssh -T git@github.com
   ```

### 步骤 4：测试连接

点击"测试连接"按钮，验证配置是否正确。

### 步骤 5：首次同步

点击"立即同步"按钮，执行首次同步。

## 同步内容

### 同步的数据

以下数据会自动同步：

- **插件配置**：`plugins.json`
- **快捷键配置**：`shortcuts.json`
- **便利贴数据**：`sticky/sticky.json`
- **书签数据**：`bookmark/`
- **自定义设置**：其他插件配置

### 忽略的文件

以下文件**不会**同步：

- **临时文件**：`*.tmp`、`*.log`、`*.cache`
- **同步目录**：`.sync/`（避免递归）
- **缓存文件**：`cache/`、`node_modules/`
- **敏感文件**：包含密钥或 token 的文件

### 自定义忽略规则

可以添加自定义忽略规则：

1. 打开同步设置
2. 点击"高级设置"
3. 添加忽略模式（类似 `.gitignore`）：
   ```
   *.log
   secret/
   large-files/
   ```

## 自动同步

### 启用自动同步

1. 在同步设置中启用"自动同步"
2. 设置同步间隔（单位：分钟）
3. 保存配置

**同步间隔建议**：
- **频繁使用**：5-15 分钟
- **正常使用**：30-60 分钟
- **偶尔使用**：120-240 分钟

### 自动同步行为

- **应用启动时**：如果启用了自动同步，应用启动后自动开始定时同步
- **应用关闭时**：应用关闭前会执行最后一次同步（最多等待 10 秒）
- **冲突处理**：自动处理推送冲突，确保同步成功

## 手动同步

### 立即同步

点击"立即同步"按钮，立即执行一次同步：

1. 拉取远程变更
2. 复制本地文件
3. 提交变更
4. 推送到远程

### 查看同步状态

同步设置页面显示：

- **同步状态**：正在同步 / 空闲
- **最后同步时间**：上次同步的时间戳
- **最后提交哈希**：Git 提交的短哈希
- **是否有变更**：本地是否有未同步的变更
- **错误信息**：如果同步失败，显示错误详情

## 多设备同步

### 设置步骤

**设备 A（已有数据）**：
1. 配置同步功能
2. 执行首次同步
3. 等待同步完成

**设备 B（新设备）**：
1. 安装 LTools
2. 配置同步功能（使用相同的仓库）
3. 点击"立即同步"
4. 数据自动从远程拉取

### 同步冲突

如果多个设备同时修改数据：

1. **最后推送优先**：后推送的设备会覆盖先推送的
2. **自动合并**：Git 会尝试自动合并变更
3. **强制推送**：如果合并失败，会强制推送（使用 `--force-with-lease`）

> **建议**：避免在多个设备上同时编辑相同的数据

## 同步范围

### 支持同步的插件

以下插件的数据支持同步：

- **便利贴**：所有便利贴内容
- **书签**：保存的书签
- **快捷键**：自定义快捷键配置
- **插件状态**：插件的启用/禁用状态

### 不支持同步的数据

以下数据**不会**同步：

- **剪贴板历史**：临时数据，不建议同步
- **截图文件**：体积较大，不适合 Git 同步
- **图床图片**：已存储在 GitHub 仓库中
- **缓存数据**：临时缓存文件

## 安全性

### Token 安全存储

- **系统钥匙串**：Token 存储在操作系统的钥匙串中
  - macOS：Keychain
  - Windows：Credential Manager
  - Linux：Secret Service API
- **加密存储**：Token 不会明文保存在配置文件中
- **应用专属**：只有 LTools 可以访问存储的 Token

### SSH 密钥

- SSH 密钥存储在 `~/.ssh/` 目录
- 使用系统 SSH 客户端进行认证
- 支持 `ssh-agent` 密钥管理

### 仓库隐私

- **推荐使用私有仓库**：避免数据泄露
- **敏感数据**：不要在便利贴等同步内容中存储密码、密钥等敏感信息
- **访问控制**：只有拥有仓库访问权限的人才能同步数据

## 故障排查

### Git 未安装

**问题**：提示"未安装 Git"

**解决**：
```bash
# macOS
brew install git

# Ubuntu/Debian
sudo apt-get install git

# Windows
# 下载安装 https://git-scm.com/download/win
```

### Token 认证失败

**问题**：推送时提示认证失败

**解决**：
1. 检查 Token 是否有效
2. 确认 Token 有 `repo` 权限
3. 重新生成 Token 并更新
4. 检查仓库 URL 是否正确

### SSH 认证失败

**问题**：SSH 连接失败

**解决**：
1. 测试 SSH 连接：`ssh -T git@github.com`
2. 检查 SSH 密钥权限：`chmod 600 ~/.ssh/id_ed25519`
3. 添加 SSH 密钥到 ssh-agent：
   ```bash
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519
   ```
4. 确认公钥已添加到 GitHub

### 推送冲突

**问题**：推送时提示冲突

**解决**：
同步功能会自动处理冲突：
1. 自动拉取远程变更
2. 尝试合并
3. 如果合并失败，使用强制推送

如果仍然失败：
1. 手动检查远程仓库
2. 考虑重置同步目录：
   - 关闭 LTools
   - 删除 `~/.ltools/.sync/`
   - 重新打开 LTools，重新同步

### 同步慢

**问题**：同步速度很慢

**解决**：
1. 检查网络连接
2. 减少同步数据量（添加忽略规则）
3. 使用更快的 Git 托管平台
4. 考虑使用 SSH 而不是 HTTPS

### 数据丢失

**问题**：同步后数据丢失

**解决**：
1. **不要惊慌**：Git 有历史记录
2. 访问远程仓库，查看提交历史
3. 回滚到之前的提交：
   ```bash
   cd ~/.ltools/.sync
   git log  # 查找之前的提交
   git reset --hard <commit-hash>
   ```
4. 复制文件回数据目录

## 最佳实践

### 仓库管理

- ✅ 使用私有仓库
- ✅ 定期检查仓库大小
- ✅ 清理不需要的历史提交
- ✅ 添加仓库描述和 README

### 同步策略

- ✅ 设置合理的同步间隔（30-60 分钟）
- ✅ 在重大更改后手动同步
- ✅ 定期检查同步状态
- ✅ 保留一份本地备份

### 数据管理

- ✅ 不要在便利贴中存储敏感信息
- ✅ 定期清理不需要的数据
- ✅ 使用忽略规则排除大文件
- ✅ 在多个设备上保持数据一致

## API 参考

### 服务方法

**SyncService** 暴露的方法：

```typescript
// 获取配置
SyncService.GetConfig(): SyncConfig

// 设置配置
SyncService.SetConfig(config: SyncConfig): void

// 执行同步
SyncService.Sync(): SyncResult

// 获取状态
SyncService.GetStatus(): SyncStatus

// 测试连接
SyncService.TestConnection(url: string): ConnectionTestResult

// 启用/禁用自动同步
SyncService.EnableAutoSync(): void
SyncService.DisableAutoSync(): void

// Token 管理
SyncService.StoreToken(token: string): void
SyncService.HasToken(): boolean
SyncService.DeleteToken(): void

// 检查 Git
SyncService.IsGitInstalled(): boolean
SyncService.CheckSSHCredential(): boolean
```

### 数据结构

```typescript
interface SyncConfig {
  enabled: boolean       // 是否启用同步
  autoSync: boolean      // 是否自动同步
  syncInterval: number   // 同步间隔（分钟）
  repoURL: string        // 仓库 URL
  lastSyncTime?: string  // 最后同步时间
  lastSyncHash?: string  // 最后提交哈希
}

interface SyncResult {
  success: boolean       // 是否成功
  message?: string       // 成功消息
  error?: string         // 错误消息
  filesChanged: number   // 变更文件数
  commitHash?: string    // 提交哈希
}

interface SyncStatus {
  syncing: boolean       // 是否正在同步
  lastSyncTime?: string  // 最后同步时间
  lastSyncHash?: string  // 最后提交哈希
  enabled: boolean       // 是否启用
  autoSync: boolean      // 是否自动同步
  remoteURL: string      // 远程仓库 URL
  hasChanges: boolean    // 是否有未同步变更
  error?: string         // 错误信息
}
```

## 常见问题

### Q: 同步会影响应用性能吗？

**A**:
影响很小。同步在后台线程执行，不会阻塞主线程。如果同步大量文件，可能会短暂占用 CPU 和网络带宽。

### Q: 可以使用公共仓库吗？

**A**:
可以，但**强烈不推荐**。公共仓库的任何人都可见，可能导致数据泄露。建议使用私有仓库。

### Q: 同步的数据有大小限制吗？

**A**:
Git 仓库本身没有大小限制，但建议：
- 单个文件 < 100 MB
- 总仓库大小 < 1 GB
- 避免同步大型二进制文件

### Q: 如何在另一台电脑上恢复数据？

**A**:
1. 安装 LTools
2. 配置相同的 Git 仓库
3. 执行同步，数据会自动下载

### Q: 同步失败会丢失数据吗？

**A**:
不会。同步失败只影响远程备份，本地数据不受影响。可以重新尝试同步。

### Q: 可以使用多个仓库吗？

**A**:
目前不支持。每个 LTools 安装只能配置一个同步仓库。

### Q: 如何完全禁用同步？

**A**:
1. 在同步设置中禁用"启用同步"
2. 可选：删除 Token
3. 可选：删除本地同步目录 `~/.ltools/.sync/`

## 未来计划

- [ ] 增量同步（只同步变更部分）
- [ ] 同步加密（端到端加密）
- [ ] 多仓库支持
- [ ] 同步历史查看
- [ ] 冲突可视化解决
- [ ] 带宽限制
- [ ] 同步统计和分析

## 相关资源

- [Git 官方文档](https://git-scm.com/doc)
- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [SSH 密钥管理](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
