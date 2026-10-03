package searchmatch

import (
	"strings"
	"unicode"
	"sync"

	"github.com/mozillazg/go-pinyin"
	"github.com/sahilm/fuzzy"
)

var transliterations sync.Map

func nameKeys(name string) []string {
	if !strings.ContainsFunc(name, func(r rune) bool { return unicode.Is(unicode.Han, r) }) { return []string{name} }
	if cached, ok := transliterations.Load(name); ok { return cached.([]string) }
	args := pinyin.NewArgs()
	args.Heteronym = true
	args.Fallback = func(r rune, _ pinyin.Args) []string { return []string{string(r)} }
	type spelling struct{ full, initials string }
	variants := []spelling{{}}
	for _, syllables := range pinyin.Pinyin(name, args) {
		var next []spelling
		for _, variant := range variants {
			for _, syllable := range syllables {
				if syllable == "" { continue }
				next = append(next, spelling{variant.full + syllable, variant.initials + syllable[:1]})
				if len(next) >= 64 { break }
			}
			if len(next) >= 64 { break }
		}
		variants = next
	}
	keys := []string{name}
	for _, variant := range variants { keys = append(keys, variant.full, variant.initials) }
	transliterations.Store(name, keys)
	return keys
}

func normalize(value string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			return unicode.ToLower(r)
		}
		return -1
	}, value)
}

// Score ranks literal matches above transliteration and ordered fuzzy matches.
func Score(value, query string) int {
	name, needle := normalize(value), normalize(query)
	if name == "" || needle == "" {
		return 0
	}
	if name == needle {
		return 1000
	}
	if strings.HasPrefix(name, needle) {
		return 900
	}
	if strings.Contains(name, needle) {
		return 800
	}
	keys := nameKeys(name)
	score := 0
	for _, key := range keys {
		if key == needle {
			return 700
		}
		if strings.HasPrefix(key, needle) {
			score = max(score, 650)
		}
		if strings.Contains(key, needle) {
			score = max(score, 600)
		}
	}
	if score > 0 { return score }
	if len([]rune(needle)) < 2 {
		return 0
	}
	matches := fuzzy.Find(needle, keys)
	if len(matches) == 0 {
		return 0
	}
	return 100 + max(0, min(399, matches[0].Score))
}
