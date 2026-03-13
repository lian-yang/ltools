package settings

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"

	"howett.net/plist"
)

const launchAtLoginLabel = "com.ltools.LTools"

type launchAgent struct {
	Label            string   `plist:"Label"`
	ProgramArguments []string `plist:"ProgramArguments"`
	RunAtLoad        bool     `plist:"RunAtLoad"`
}

func isLaunchAtLoginSupported() bool {
	return true
}

func isLaunchAtLoginEnabled() (bool, error) {
	path, err := launchAgentPath()
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

	agentPath, err := launchAgentPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(agentPath), 0755); err != nil {
		return err
	}

	data, err := plist.Marshal(launchAgent{
		Label:            launchAtLoginLabel,
		ProgramArguments: []string{exePath},
		RunAtLoad:        true,
	}, plist.XMLFormat)
	if err != nil {
		return err
	}

	if err := os.WriteFile(agentPath, data, 0644); err != nil {
		return err
	}

	_ = runLaunchctl("bootout", agentPath)
	if err := runLaunchctl("bootstrap", agentPath); err != nil {
		return err
	}

	return nil
}

func disableLaunchAtLogin() error {
	agentPath, err := launchAgentPath()
	if err != nil {
		return err
	}

	_ = runLaunchctl("bootout", agentPath)
	if err := os.Remove(agentPath); err != nil && !os.IsNotExist(err) {
		return err
	}

	return nil
}

func launchAgentPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "Library", "LaunchAgents", fmt.Sprintf("%s.plist", launchAtLoginLabel)), nil
}

func runLaunchctl(action, agentPath string) error {
	if action != "bootstrap" && action != "bootout" {
		return fmt.Errorf("unsupported launchctl action: %s", action)
	}

	uid := strconv.Itoa(os.Getuid())
	cmd := exec.Command("launchctl", action, fmt.Sprintf("gui/%s", uid), agentPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("launchctl %s failed: %s", action, string(output))
	}

	return nil
}
