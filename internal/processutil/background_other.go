//go:build !windows

package processutil

import "os/exec"

func Background(cmd *exec.Cmd) {}
