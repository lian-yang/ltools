//go:build windows

package plugins

import (
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"

	"golang.design/x/hotkey"
)

type windowsHotkeyBinding struct {
	key  *hotkey.Hotkey
	stop chan struct{}
}

type GlobalHotkeyManager struct {
	registeredHotkeys map[string]string
	bindings          map[string]*windowsHotkeyBinding
	onHotkeyTriggered func(pluginID string)
	started           bool
	mu                sync.RWMutex
}

func NewGlobalHotkeyManager() *GlobalHotkeyManager {
	return &GlobalHotkeyManager{registeredHotkeys: make(map[string]string), bindings: make(map[string]*windowsHotkeyBinding)}
}

func parseWindowsHotkey(combo string) (*hotkey.Hotkey, error) {
	var mods []hotkey.Modifier
	var key hotkey.Key
	for _, part := range strings.Split(normalizeKeyCombo(combo), "+") {
		switch part {
		case "ctrl", "control":
			mods = append(mods, hotkey.ModCtrl)
		case "shift":
			mods = append(mods, hotkey.ModShift)
		case "alt", "option":
			mods = append(mods, hotkey.ModAlt)
		case "cmd", "meta", "command", "win":
			mods = append(mods, hotkey.ModWin)
		default:
			if key != 0 {
				return nil, fmt.Errorf("shortcut must contain one main key")
			}
			if len(part) == 1 && ((part[0] >= 'a' && part[0] <= 'z') || (part[0] >= '0' && part[0] <= '9')) {
				key = hotkey.Key(strings.ToUpper(part)[0])
			} else if strings.HasPrefix(part, "f") {
				number, err := strconv.Atoi(part[1:])
				if err != nil || number < 1 || number > 20 {
					return nil, fmt.Errorf("unsupported shortcut key: %s", part)
				}
				key = hotkey.Key(int(hotkey.KeyF1) + number - 1)
			} else {
				key = map[string]hotkey.Key{"space": hotkey.KeySpace, "enter": hotkey.KeyReturn, "return": hotkey.KeyReturn, "tab": hotkey.KeyTab, "escape": hotkey.KeyEscape, "esc": hotkey.KeyEscape, "delete": hotkey.KeyDelete, "arrowleft": hotkey.KeyLeft, "arrowright": hotkey.KeyRight, "arrowup": hotkey.KeyUp, "arrowdown": hotkey.KeyDown}[part]
				if key == 0 {
					return nil, fmt.Errorf("unsupported shortcut key: %s", part)
				}
			}
		}
	}
	if key == 0 || len(mods) == 0 {
		return nil, fmt.Errorf("shortcut requires a modifier and main key")
	}
	return hotkey.New(mods, key), nil
}

// Caller holds m.mu. The library owns the Windows thread and message loop.
func (m *GlobalHotkeyManager) registerNative(combo, pluginID string) error {
	key, err := parseWindowsHotkey(combo)
	if err != nil {
		return err
	}
	if err := key.Register(); err != nil {
		return fmt.Errorf("cannot register %s (possibly in use by another application): %w", combo, err)
	}
	binding := &windowsHotkeyBinding{key: key, stop: make(chan struct{})}
	m.bindings[combo] = binding
	go func() {
		for {
			select {
			case <-binding.stop:
				return
			case <-key.Keydown():
				m.mu.RLock()
				callback := m.onHotkeyTriggered
				active := m.bindings[combo] == binding && m.started
				m.mu.RUnlock()
				if active && callback != nil {
					callback(pluginID)
				}
			}
		}
	}()
	return nil
}

func (m *GlobalHotkeyManager) Register(combo, pluginID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	combo = normalizeKeyCombo(combo)
	if owner, exists := m.registeredHotkeys[combo]; exists {
		if owner != pluginID {
			return fmt.Errorf("shortcut %s already registered to %s", combo, owner)
		}
		if !m.started || m.bindings[combo] != nil {
			return nil
		}
	}
	if _, err := parseWindowsHotkey(combo); err != nil {
		return err
	}
	if m.started {
		if err := m.registerNative(combo, pluginID); err != nil {
			return err
		}
	}
	m.registeredHotkeys[combo] = pluginID
	return nil
}

func (m *GlobalHotkeyManager) Unregister(combo string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	combo = normalizeKeyCombo(combo)
	if binding := m.bindings[combo]; binding != nil {
		if err := binding.key.Unregister(); err != nil {
			return err
		}
		close(binding.stop)
		delete(m.bindings, combo)
	}
	delete(m.registeredHotkeys, combo)
	return nil
}

func (m *GlobalHotkeyManager) SetCallback(callback func(pluginID string)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.onHotkeyTriggered = callback
}

func (m *GlobalHotkeyManager) Start() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.started {
		return nil
	}
	m.started = true
	for combo, pluginID := range m.registeredHotkeys {
		if err := m.registerNative(combo, pluginID); err != nil {
			log.Printf("[WindowsHotkey] %v", err)
		}
	}
	return nil
}

func (m *GlobalHotkeyManager) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.started = false
	for combo, binding := range m.bindings {
		if err := binding.key.Unregister(); err != nil {
			log.Printf("[WindowsHotkey] unregister %s: %v", combo, err)
		}
		close(binding.stop)
		delete(m.bindings, combo)
	}
}

func (m *GlobalHotkeyManager) IsStarted() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.started
}

func (m *GlobalHotkeyManager) GetRegisteredHotkeys() map[string]string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make(map[string]string)
	for combo, owner := range m.registeredHotkeys {
		if !m.started || m.bindings[combo] != nil {
			result[combo] = owner
		}
	}
	return result
}
