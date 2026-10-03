package plugins

import "testing"

func TestSearchShortcutReplacementPersists(t *testing.T) {
	dir := t.TempDir()
	m, err := NewShortcutManager(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := m.Set("ctrl+5", "search.window.builtin", true); err != nil {
		t.Fatal(err)
	}
	if err := m.Set("alt+space", "search.window.builtin", true); err != nil {
		t.Fatal(err)
	}
	if err := m.Remove("ctrl+5"); err != nil {
		t.Fatal(err)
	}
	reloaded, err := NewShortcutManager(dir)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := reloaded.Get("ctrl+5"); ok {
		t.Fatal("old search shortcut persisted")
	}
	items := reloaded.GetByPluginID("search.window.builtin")
	if len(items) != 1 || items[0].KeyCombo != "alt+space" || !items[0].Enabled {
		t.Fatalf("custom search shortcut lost: %+v", items)
	}
}
