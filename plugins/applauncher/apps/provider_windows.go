//go:build windows

package apps

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/lxn/win"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
	"ltools/internal/processutil"
)

// windowsProvider Windows 应用提供者
type windowsProvider struct{}

// NewProvider 创建 Windows 应用提供者
func NewProvider() (AppProvider, error) {
	return &windowsProvider{}, nil
}

// ListApps 列出所有已安装的应用程序
// Windows 应用信息存储在注册表中
func (p *windowsProvider) ListApps() ([]*AppInfo, error) {
	// 注册表路径列表
	registryPaths := []string{
		`HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`,
		`HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`,
		`HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`,
	}

	apps := make(map[string]*AppInfo)

	for _, regPath := range registryPaths {
		p.readRegistryApps(regPath, apps)
	}
	p.readStartApps(apps)

	// 转换为切片
	result := make([]*AppInfo, 0, len(apps))
	for _, app := range apps {
		result = append(result, app)
	}

	return result, nil
}

// readRegistryApps 从注册表路径读取应用信息
func (p *windowsProvider) readRegistryApps(regPath string, apps map[string]*AppInfo) {
	root := registry.LOCAL_MACHINE
	if strings.HasPrefix(regPath, "HKCU") {
		root = registry.CURRENT_USER
	}
	key, err := registry.OpenKey(root, strings.SplitN(regPath, `\`, 2)[1], registry.READ)
	if err != nil {
		return
	}
	defer key.Close()
	names, _ := key.ReadSubKeyNames(-1)
	for _, subName := range names {
		sub, err := registry.OpenKey(key, subName, registry.QUERY_VALUE)
		if err != nil {
			continue
		}
		name, _, _ := sub.GetStringValue("DisplayName")
		icon, _, _ := sub.GetStringValue("DisplayIcon")
		location, _, _ := sub.GetStringValue("InstallLocation")
		version, _, _ := sub.GetStringValue("DisplayVersion")
		sub.Close()
		if name == "" {
			continue
		}
		if icon == "" {
			icon = p.findIconInDir(location)
		}
		executable, _ := parseWindowsIconPath(icon)
		if !strings.EqualFold(filepath.Ext(executable), ".exe") {
			continue
		}
		id := regPath + `\` + subName
		apps[id] = &AppInfo{ID: id, Name: name, Description: strings.TrimSpace(name + " " + version),
			IconPath: icon, ExecutablePath: executable, RegistryKey: id, Type: ResultTypeApp}
	}
}

// findIconInDir 在目录中查找图标
func (p *windowsProvider) findIconInDir(dir string) string {
	if dir == "" {
		return ""
	}

	// 常见的图标文件名
	iconNames := []string{
		"app.ico",
		"icon.ico",
		"main.ico",
		"program.ico",
		"app.exe",
		"main.exe",
	}

	for _, iconName := range iconNames {
		iconPath := filepath.Join(dir, iconName)
		if _, err := os.Stat(iconPath); err == nil {
			return iconPath
		}
	}

	return ""
}

// LaunchApp 启动应用程序
func (p *windowsProvider) LaunchApp(appInfo *AppInfo) error {
	if strings.HasPrefix(appInfo.ExecutablePath, "shell:") {
		file, err := windows.UTF16PtrFromString(appInfo.ExecutablePath)
		if err != nil {
			return err
		}
		verb, _ := windows.UTF16PtrFromString("open")
		if !win.ShellExecute(0, verb, file, nil, nil, win.SW_SHOWNORMAL) {
			return fmt.Errorf("failed to launch application: %s", appInfo.Name)
		}
		return nil
	}
	var exePath string

	if appInfo.ExecutablePath != "" {
		exePath = appInfo.ExecutablePath
	} else if appInfo.IconPath != "" {
		exePath = appInfo.IconPath
	} else {
		return fmt.Errorf("no executable path for app: %s", appInfo.Name)
	}

	exePath, _ = parseWindowsIconPath(exePath)
	if !strings.EqualFold(filepath.Ext(exePath), ".exe") {
		return fmt.Errorf("application does not have an executable path: %s", appInfo.Name)
	}
	file, err := windows.UTF16PtrFromString(exePath)
	if err != nil {
		return err
	}
	verb, _ := windows.UTF16PtrFromString("open")
	if !win.ShellExecute(0, verb, file, nil, nil, win.SW_SHOWNORMAL) {
		return fmt.Errorf("failed to launch application: %s", appInfo.Name)
	}
	return nil
}

// readStartApps includes Start Menu shortcuts and Microsoft Store apps. The
// command returns the canonical shell AppsFolder identifier, which can be
// launched without resolving a fragile shortcut target ourselves.
func (p *windowsProvider) readStartApps(apps map[string]*AppInfo) {
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); @(Get-StartApps) | ConvertTo-Json -Compress")
	processutil.Background(cmd)
	output, err := cmd.Output()
	if err != nil || len(output) == 0 {
		return
	}
	var entries []struct {
		Name  string `json:"Name"`
		AppID string `json:"AppID"`
	}
	if err := json.Unmarshal(output, &entries); err != nil {
		var entry struct {
			Name  string `json:"Name"`
			AppID string `json:"AppID"`
		}
		if json.Unmarshal(output, &entry) == nil {
			entries = append(entries, entry)
		}
	}
	for _, entry := range entries {
		name := strings.TrimSpace(entry.Name)
		id := strings.TrimSpace(entry.AppID)
		if name == "" || id == "" {
			continue
		}
		key := "startapp:" + id
		if _, exists := apps[key]; exists {
			continue
		}
		// Prefer the Shell entry, which has an actual launch target.
		for oldID, app := range apps {
			if strings.EqualFold(app.Name, name) {
				delete(apps, oldID)
			}
		}
		apps[key] = &AppInfo{
			ID:             key,
			Name:           name,
			Description:    name,
			ExecutablePath: "shell:AppsFolder\\" + id,
			IconData:       startAppIcon(id),
			Type:           ResultTypeApp,
		}
	}
}

// RefreshCache 刷新缓存
func (p *windowsProvider) RefreshCache() error {
	return nil
}
