package settings

import (
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

const windowsRunKey = `Software\\Microsoft\\Windows\\CurrentVersion\\Run`
const windowsRunValueName = "LTools"

func isLaunchAtLoginSupported() bool {
	return true
}

func isLaunchAtLoginEnabled() (bool, error) {
	key, err := registry.OpenKey(registry.CURRENT_USER, windowsRunKey, registry.QUERY_VALUE)
	if err != nil {
		if err == registry.ErrNotExist {
			return false, nil
		}
		return false, err
	}
	defer key.Close()

	_, _, err = key.GetStringValue(windowsRunValueName)
	if err == nil {
		return true, nil
	}
	if err == registry.ErrNotExist {
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

	key, _, err := registry.CreateKey(registry.CURRENT_USER, windowsRunKey, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer key.Close()

	return key.SetStringValue(windowsRunValueName, fmt.Sprintf("\"%s\"", exePath))
}

func disableLaunchAtLogin() error {
	key, err := registry.OpenKey(registry.CURRENT_USER, windowsRunKey, registry.SET_VALUE)
	if err != nil {
		if err == registry.ErrNotExist {
			return nil
		}
		return err
	}
	defer key.Close()

	if err := key.DeleteValue(windowsRunValueName); err != nil && err != registry.ErrNotExist {
		return err
	}

	return nil
}
