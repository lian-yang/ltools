# macOS 安全性问题快速参考

> 首次运行未签名应用时可能遇到的问题及解决方案

## 🚨 常见问题

### 1. "已损坏，无法打开"

**症状：**
```
"LTools" 已损坏，无法打开。你应该推出磁盘映像。
```

**一键解决：**
```bash
sudo xattr -rd com.apple.quarantine /Applications/LTools.app
```

### 2. "无法验证开发者"

**症状：**
```
无法打开 "LTools"，因为无法验证开发者。
```

**解决方案：**

**方式 A: 右键打开（推荐）**
1. 右键点击 LTools.app
2. 选择"打开"
3. 点击"打开"确认

**方式 B: 系统设置**
1. 系统设置 → 隐私与安全性
2. 找到 "仍要打开" 按钮
3. 点击并确认

**方式 C: 命令行**
```bash
# 移除隔离属性
sudo xattr -rd com.apple.quarantine /Applications/LTools.app

# 或允许任何来源（不推荐）
sudo spctl --master-disable
```

### 3. 全局快捷键不工作

**原因：** 需要辅助功能权限

**解决方案：**
1. 系统设置 → 隐私与安全性 → 辅助功能
2. 点击锁图标解锁
3. 勾选或添加 LTools
4. 重启应用

### 4. 应用闪退或无响应

**检查日志：**
```bash
# 查看系统日志
log show --predicate 'process == "LTools"' --last 1h

# 查看崩溃报告
ls ~/Library/Logs/DiagnosticReports/ | grep LTools
```

**修复权限：**
```bash
# 授予执行权限
chmod +x /Applications/LTools.app/Contents/MacOS/LTools

# 移除隔离属性
sudo xattr -rd com.apple.quarantine /Applications/LTools.app
```

## 🛠️ 诊断命令

```bash
# 检查应用签名状态
codesign --verify --verbose /Applications/LTools.app

# 查看应用的扩展属性
xattr -l /Applications/LTools.app

# 检查 Gatekeeper 状态
spctl --status

# 查看辅助功能权限
# 需要在系统设置中手动检查
```

## 🔐 安全设置说明

### Gatekeeper

macOS 的安全功能，用于阻止未经验证的应用。

```bash
# 查看状态
spctl --status

# 允许特定应用
sudo spctl --add /Applications/LTools.app

# 临时禁用（不推荐）
sudo spctl --master-disable

# 重新启用
sudo spctl --master-enable
```

### 隔离属性 (Quarantine)

macOS 对下载文件添加的扩展属性。

```bash
# 查看是否有隔离属性
xattr /Applications/LTools.app
# 如果输出包含 com.apple.quarantine，说明有隔离属性

# 移除隔离属性（推荐）
sudo xattr -rd com.apple.quarantine /Applications/LTools.app

# 完全移除所有扩展属性
sudo xattr -c /Applications/LTools.app
```

### 辅助功能

允许应用控制其他应用或接收系统事件。

**需要此权限的功能：**
- 全局快捷键（Cmd+5 打开搜索）
- 系统级快捷键监听

**授予权限：**
1. 系统设置 → 隐私与安全性 → 辅助功能
2. 解锁（点击锁图标）
3. 点击 "+" 添加 LTools.app
4. 勾选 LTools

## 📋 完整解决流程

如果应用无法正常打开，按顺序执行：

```bash
# 1. 移除隔离属性（最常见的问题）
sudo xattr -rd com.apple.quarantine /Applications/LTools.app

# 2. 授予执行权限
chmod +x /Applications/LTools.app/Contents/MacOS/LTools

# 3. 尝试打开
open /Applications/LTools.app

# 4. 如果还是不行，尝试右键打开
# 在 Finder 中右键点击 LTools.app → 打开

# 5. 检查日志（如果以上都不行）
log show --predicate 'process == "LTools"' --last 1h
```

## ⚠️ 安全警告

**不推荐的操作：**
- ❌ `sudo spctl --master-disable` - 允许所有未签名应用（安全风险）
- ❌ 关闭 SIP (System Integrity Protection) - 系统完整性保护

**推荐的操作：**
- ✅ 只对特定应用移除隔离属性
- ✅ 使用右键打开的方式
- ✅ 在系统设置中明确允许

## 🆘 仍然无法解决？

1. **查看完整日志**
   ```bash
   log show --predicate 'process == "LTools"' --last 1h --info
   ```

2. **检查崩溃报告**
   ```bash
   cat ~/Library/Logs/DiagnosticReports/LTools_*.crash
   ```

3. **重新下载并安装**
   ```bash
   # 删除旧版本
   rm -rf /Applications/LTools.app

   # 重新下载
   curl -LO https://github.com/lian-yang/ltools/releases/latest/download/ltools-latest-darwin-arm64.tar.gz

   # 解压并安装
   tar xzf ltools-latest-darwin-arm64.tar.gz
   mv LTools.app /Applications/

   # 移除隔离属性
   sudo xattr -rd com.apple.quarantine /Applications/LTools.app

   # 打开
   open /Applications/LTools.app
   ```

4. **提交 Issue**
   - 访问：https://github.com/lian-yang/ltools/issues
   - 附上系统版本：`sw_vers`
   - 附上日志输出

## 📚 相关文档

- [完整发布说明](RELEASE.md)
- [安装指南](docs/INSTALLATION.md)
- [故障排查](docs/TROUBLESHOOTING.md)

---

**最后更新**: 2026-03-06
