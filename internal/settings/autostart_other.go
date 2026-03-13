//go:build !darwin && !windows && !linux

package settings

import (
	"fmt"
	"runtime"
)

func isLaunchAtLoginSupported() bool {
	return false
}

func isLaunchAtLoginEnabled() (bool, error) {
	return false, nil
}

func enableLaunchAtLogin() error {
	return fmt.Errorf("launch at login is not supported on %s", runtime.GOOS)
}

func disableLaunchAtLogin() error {
	return fmt.Errorf("launch at login is not supported on %s", runtime.GOOS)
}
