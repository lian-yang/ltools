package settings

import (
	"fmt"
	"os"
	"path/filepath"
)

const linuxDesktopFileName = "ltools.desktop"

func isLaunchAtLoginSupported() bool {
	return true
}

func isLaunchAtLoginEnabled() (bool, error) {
	path, err := linuxAutostartPath()
	if err != nil {
		return false, err
	}
	_, err = os.Stat(path)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

func enableLaunchAtLogin() error {
	exePath, err := os.Executable()
	if err != nil {
		return err
	}
	exePath, err = filepath.Abs(exePath)
	if err != nil {
		return err
	}

	path, err := linuxAutostartPath()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	content := fmt.Sprintf(`[Desktop Entry]
Type=Application
Name=LTools
Exec="%s"
X-GNOME-Autostart-enabled=true
Terminal=false
`, exePath)

	return os.WriteFile(path, []byte(content), 0644)
}

func disableLaunchAtLogin() error {
	path, err := linuxAutostartPath()
	if err != nil {
		return err
	}

	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}

	return nil
}

func linuxAutostartPath() (string, error) {
	configHome := os.Getenv("XDG_CONFIG_HOME")
	if configHome == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		configHome = filepath.Join(home, ".config")
	}

	return filepath.Join(configHome, "autostart", linuxDesktopFileName), nil
}
