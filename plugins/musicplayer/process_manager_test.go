package musicplayer

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

func TestProcessLifecycle(t *testing.T) {
	node, err := exec.LookPath("node")
	if err != nil { t.Skip("Node.js unavailable") }
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "server.js"), []byte("setInterval(()=>{},1000)"), 0600); err != nil { t.Fatal(err) }
	pm := &ProcessManager{nodePath:node, serviceDir:dir}
	for range 2 {
		if err := pm.Start(); err != nil { t.Fatal(err) }
		if !pm.IsRunning() { t.Fatal("process not running") }
		if err := pm.Stop(); err != nil { t.Fatal(err) }
		if pm.IsRunning() { t.Fatal("process remained running") }
		if err := pm.Stop(); err != nil { t.Fatal(err) }
	}
	if err := os.WriteFile(filepath.Join(dir,"server.js"), []byte("process.exit(0)"), 0600); err != nil { t.Fatal(err) }
	if err := pm.Start(); err != nil { t.Fatal(err) }
	done := make(chan error, 1)
	go func(){ done <- pm.WaitForExit() }()
	select {
	case err := <-done: if err != nil { t.Fatal(err) }
	case <-time.After(3*time.Second): t.Fatal("exit was not observed")
	}
	if pm.IsRunning() { t.Fatal("exit did not clear running state") }
}
