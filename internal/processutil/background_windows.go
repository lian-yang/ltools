//go:build windows

package processutil

import (
	"os/exec"
	"syscall"
)

// Background prevents console windows for application-owned helper processes.
func Background(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.HideWindow = true
	cmd.SysProcAttr.CreationFlags |= 0x08000000 // CREATE_NO_WINDOW
}
