package main

import (
	"os"
	"regexp"
	"testing"
)

func TestMainUsesOnWindowEventForFileDrop(t *testing.T) {
	data, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatalf("read main.go: %v", err)
	}

	content := string(data)
	onRe := regexp.MustCompile(`(?s)\bOnWindowEvent\s*\(\s*events\.Common\.WindowFilesDropped\b`)
	if !onRe.MatchString(content) {
		t.Fatalf("main.go should use OnWindowEvent(events.Common.WindowFilesDropped, ...) to receive file drop events")
	}

	hookRe := regexp.MustCompile(`(?s)\bRegisterHook\s*\(\s*events\.Common\.WindowFilesDropped\b`)
	if hookRe.MatchString(content) {
		t.Fatalf("main.go should not use RegisterHook for WindowFilesDropped; hooks are not invoked for drag-and-drop")
	}
}
