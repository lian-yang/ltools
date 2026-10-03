//go:build windows

package plugins

import (
	"os"
	"testing"
	"time"

	"golang.design/x/hotkey"
	"golang.org/x/sys/windows"
)

func TestWindowsHotkeyParsing(t *testing.T) {
	for _, combo := range []string{"ctrl+5", "alt+space", "ctrl+shift+f19", "win+a"} {
		if _, err := parseWindowsHotkey(combo); err != nil {
			t.Errorf("%s: %v", combo, err)
		}
	}
	for _, combo := range []string{"ctrl", "ctrl+a+b", "ctrl+unknown", "f21", "a"} {
		if _, err := parseWindowsHotkey(combo); err == nil {
			t.Errorf("accepted invalid combo %s", combo)
		}
	}
}

func TestWindowsNativeHotkeyLifecycle(t *testing.T) {
	if os.Getenv("LTOOLS_TEST_NATIVE_HOTKEY") != "1" {
		t.Skip("native key injection requires explicit opt-in")
	}
	m := NewGlobalHotkeyManager()
	triggered := make(chan string, 2)
	m.SetCallback(func(id string) { triggered <- id })
	if err := m.Register("ctrl+shift+f19", "search.window.builtin"); err != nil {
		t.Fatal(err)
	}
	if err := m.Start(); err != nil {
		t.Fatal(err)
	}
	defer m.Stop()
	if len(m.GetRegisteredHotkeys()) != 1 {
		t.Fatal("native registration failed")
	}
	conflict := hotkey.New([]hotkey.Modifier{hotkey.ModCtrl, hotkey.ModShift}, hotkey.KeyF19)
	if err := conflict.Register(); err == nil {
		conflict.Unregister()
		t.Fatal("OS accepted conflicting registration")
	}
	keyEvent := windows.NewLazySystemDLL("user32.dll").NewProc("keybd_event")
	keyEvent.Call(0x11, 0, 0, 0)
	keyEvent.Call(0x10, 0, 0, 0)
	keyEvent.Call(uintptr(hotkey.KeyF19), 0, 0, 0)
	time.Sleep(100 * time.Millisecond)
	keyEvent.Call(uintptr(hotkey.KeyF19), 0, 2, 0)
	keyEvent.Call(0x10, 0, 2, 0)
	keyEvent.Call(0x11, 0, 2, 0)
	select {
	case id := <-triggered:
		if id != "search.window.builtin" {
			t.Fatalf("wrong target: %s", id)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("background hotkey did not trigger")
	}
	if err := m.Unregister("ctrl+shift+f19"); err != nil {
		t.Fatal(err)
	}
	if err := conflict.Register(); err != nil {
		t.Fatalf("OS registration was not released: %v", err)
	}
	conflict.Unregister()
	if err := m.Register("ctrl+shift+f19", "search.window.builtin"); err != nil {
		t.Fatal(err)
	}
	m.Stop()
	if err := conflict.Register(); err != nil {
		t.Fatalf("Stop leaked registration: %v", err)
	}
	conflict.Unregister()
}
