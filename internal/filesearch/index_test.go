package filesearch

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestSearchRankingDeletedFilesAndLimit(t *testing.T) {
	root := t.TempDir()
	var entries []Entry
	for _, name := range []string{"季度报告.pdf", "报告.txt", "报告附件.docx", "node_modules"} {
		path := filepath.Join(root, name)
		if err := os.WriteFile(path, []byte("test"), 0600); err != nil { t.Fatal(err) }
		entries = append(entries, Entry{Name:name, Path:path})
	}
	index := &Index{entries:entries, updated:time.Now()}
	results, indexing, limited := index.Search("报告", 2)
	if indexing || !limited || len(results) != 2 || results[0].Name != "报告.txt" {
		t.Fatalf("unexpected ranking/limit: %#v, indexing=%v limited=%v", results, indexing, limited)
	}
	results, _, _ = index.Search("baogao", 100)
	if len(results) != 3 { t.Fatalf("pinyin search: %d", len(results)) }
	if err := os.Remove(entries[1].Path); err != nil { t.Fatal(err) }
	results, _, _ = index.Search("报告", 100)
	if len(results) != 2 { t.Fatalf("deleted file was returned: %#v", results) }
}
