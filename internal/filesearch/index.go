package filesearch

import (
	"context"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"ltools/internal/searchmatch"
)

const maxEntries = 100000

type Entry struct {
	Name        string
	Path        string
	IsDirectory bool
}

type Index struct {
	mu       sync.RWMutex
	roots    []string
	entries  []Entry
	updating bool
	updated  time.Time
	limited  bool
}

var Default = &Index{}

func userRoots() []string {
	home, _ := os.UserHomeDir()
	roots := []string{}
	for _, name := range []string{"Desktop", "Documents", "Downloads", "Pictures", "Music", "Videos"} {
		roots = append(roots, filepath.Join(home, name))
	}
	for _, key := range []string{"OneDrive", "OneDriveConsumer", "OneDriveCommercial"} {
		if root := os.Getenv(key); root != "" {
			roots = append(roots, root)
		}
	}
	return append(roots, platformRoots()...)
}

func (index *Index) Start() {
	index.mu.Lock()
	if index.updating || (!index.updated.IsZero() && time.Since(index.updated) < time.Minute) {
		index.mu.Unlock()
		return
	}
	index.updating = true
	roots := index.roots
	if roots == nil {
		roots = userRoots()
	}
	index.mu.Unlock()
	go index.refresh(roots)
}

func (index *Index) refresh(roots []string) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	entries := make([]Entry, 0)
	seen := make(map[string]bool)
	add := func(path string, isDir bool) {
		key := strings.ToLower(filepath.Clean(path))
		if seen[key] || len(entries) >= maxEntries {
			return
		}
		seen[key] = true
		entries = append(entries, Entry{Name: filepath.Base(path), Path: path, IsDirectory: isDir})
	}
	// Scan breadth first so one large directory cannot starve the other roots.
	queue := append([]string(nil), roots...)
	visited := make(map[string]bool)
	for next := 0; next < len(queue) && ctx.Err() == nil && len(entries) < maxEntries; next++ {
		root := queue[next]
		key := strings.ToLower(filepath.Clean(root))
		if visited[key] {
			continue
		}
		visited[key] = true
		children, err := os.ReadDir(root)
		if err != nil {
			continue
		}
		for _, entry := range children {
			if ctx.Err() != nil || len(entries) >= maxEntries {
				break
			}
			if entry.IsDir() {
				switch strings.ToLower(entry.Name()) {
				case "node_modules", ".git", ".gitnexus", ".agents", ".build-tools", ".cache", "vendor", "dist", "__pycache__", "$recycle.bin":
					continue
				}
			}
			if entry.Type()&os.ModeSymlink != 0 {
				continue
			}
			path := filepath.Join(root, entry.Name())
			add(path, entry.IsDir())
			if entry.IsDir() {
				queue = append(queue, path)
			}
		}
	}
	// Publish personal files before querying the optional system index.
	index.mu.Lock()
	index.entries = append([]Entry(nil), entries...)
	index.mu.Unlock()
	for _, path := range systemPaths(context.Background()) {
		add(path, false)
	}
	index.mu.Lock()
	index.entries = entries
	index.limited = len(entries) >= maxEntries || ctx.Err() != nil
	index.updated = time.Now()
	index.updating = false
	index.mu.Unlock()
}

func (index *Index) Search(query string, limit int) ([]Entry, bool, bool) {
	index.Start()
	index.mu.RLock()
	entries, updating, limited := index.entries, index.updating, index.limited
	index.mu.RUnlock()
	if strings.TrimSpace(query) == "" {
		return []Entry{}, updating, limited
	}
	type match struct {
		entry Entry
		score int
	}
	var matches []match
	for _, entry := range entries {
		score := searchmatch.Score(entry.Name, query)
		if score > 0 {
			matches = append(matches, match{entry, score})
		}
	}
	sort.Slice(matches, func(i, j int) bool {
		if matches[i].score == matches[j].score {
			return matches[i].entry.Path < matches[j].entry.Path
		}
		return matches[i].score > matches[j].score
	})
	results := []Entry{}
	for _, match := range matches {
		if len(results) >= limit {
			limited = true
			break
		}
		if _, err := os.Stat(match.entry.Path); err == nil {
			results = append(results, match.entry)
		}
	}
	return results, updating, limited
}
