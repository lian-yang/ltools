package localtranslate

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOllamaModelDiscoveryWithoutCORS(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/tags" {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		fmt.Fprint(w, `{"models":[{"name":"qwen:4b","size":123,"modified_at":"2026-10-03"}]}`)
	}))
	defer server.Close()
	models, err := (&LocalTranslateService{}).DetectOllamaModels(server.URL)
	if err != nil || len(models) != 1 || models[0].Name != "qwen:4b" {
		t.Fatalf("models=%#v err=%v", models, err)
	}
	for _, input := range []string{"file:///etc/passwd", "javascript:alert(1)", "http://user:pass@localhost/"} {
		if _, err := (&LocalTranslateService{}).DetectOllamaModels(input); err == nil {
			t.Errorf("accepted invalid URL %q", input)
		}
	}
}
