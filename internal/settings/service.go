package settings

import (
	"fmt"
	"runtime"
)

// Service provides general settings functionality to the frontend.
type Service struct{}

// NewService creates a new settings service.
func NewService() *Service {
	return &Service{}
}

// IsLaunchAtLoginSupported reports whether the current platform supports login startup.
func (s *Service) IsLaunchAtLoginSupported() bool {
	return isLaunchAtLoginSupported()
}

// GetLaunchAtLogin returns whether LTools is set to launch at login.
func (s *Service) GetLaunchAtLogin() (bool, error) {
	if !isLaunchAtLoginSupported() {
		return false, nil
	}
	return isLaunchAtLoginEnabled()
}

// SetLaunchAtLogin enables or disables launching at login.
func (s *Service) SetLaunchAtLogin(enabled bool) error {
	if !isLaunchAtLoginSupported() {
		return fmt.Errorf("launch at login is not supported on %s", runtime.GOOS)
	}

	if enabled {
		return enableLaunchAtLogin()
	}

	return disableLaunchAtLogin()
}
