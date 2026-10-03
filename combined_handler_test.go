package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"ltools/internal/proxy"
)

func TestMusicProxyPreservesRangeAndImageWithoutBrowserBypass(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/cover" {
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write([]byte{137, 80, 78, 71})
			return
		}
		w.Header().Set("Content-Type", "audio/mpeg")
		http.ServeContent(w, r, "sample.mp3", time.Time{}, bytes.NewReader([]byte("0123456789")))
	}))
	defer upstream.Close()
	config := proxy.DefaultProxyConfig()
	config.EnableCache, config.EnableLogging = false, false
	manager := proxy.NewProxyManager(config)
	handler := NewCombinedAssetHandler(manager, http.NotFoundHandler())
	for _, sample := range []struct {
		path, contentType, body string
		status                  int
	}{
		{manager.RegisterAudio("music", "test", upstream.URL+"/audio"), "audio/mpeg", "2345", http.StatusPartialContent},
		{manager.RegisterImage("music", "cover", upstream.URL+"/cover"), "image/png", string([]byte{137, 80, 78, 71}), http.StatusOK},
	} {
		request := httptest.NewRequest(http.MethodGet, sample.path, nil)
		if sample.status == http.StatusPartialContent {
			request.Header.Set("Range", "bytes=2-5")
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != sample.status || response.Header().Get("Content-Type") != sample.contentType || response.Body.String() != sample.body {
			t.Fatalf("proxy response: status=%d headers=%v body=%q", response.Code, response.Header(), response.Body.String())
		}
		if sample.status == http.StatusPartialContent && response.Header().Get("Content-Range") != "bytes 2-5/10" {
			t.Fatalf("seek range was lost: %v", response.Header())
		}
	}
}
