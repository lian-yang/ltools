package searchmatch

import "testing"

func TestChineseAndMixedNames(t *testing.T) {
	for _, tc := range []struct {
		name, query string
		matches     bool
	}{
		{"微信", "微信", true}, {"微信", "weixin", true}, {"微信", "wx", true},
		{"网易云音乐", "wangyiyunyinyue", true}, {"网易云音乐", "wyyyy", true},
		{"网易云音乐", "wyy", true}, {"中文 Code", "zhongwen code", true},
		{"ChatGPT", "cgt", true}, {"ChatGPT", "chat gpt", true},
		{"计算器", "jisuanqi", true}, {"计算器", "jsq", true},
		{"微信", "xyz", false}, {"微信", "", false}, {"微信", "[", false},
	} {
		if got := Score(tc.name, tc.query) > 0; got != tc.matches {
			t.Errorf("Score(%q, %q) = %v, want %v", tc.name, tc.query, got, tc.matches)
		}
	}
}

func TestRanking(t *testing.T) {
	if Score("ChatGPT", "chat") <= Score("Some Chat App", "chat") {
		t.Fatal("prefix must outrank substring")
	}
	if Score("微信", "微信") <= Score("微信", "wx") {
		t.Fatal("literal must outrank initials")
	}
	if Score("网易云音乐", "wyyyy") <= Score("网易云音乐", "wyy") {
		t.Fatal("complete initials must outrank fuzzy")
	}
}
