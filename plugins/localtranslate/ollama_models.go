package localtranslate

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type OllamaModel struct {
	Name     string `json:"name"`
	Size     int64  `json:"size"`
	Modified string `json:"modified"`
}

// DetectOllamaModels keeps model discovery independent of browser CORS policy.
func (s *LocalTranslateService) DetectOllamaModels(baseURL string) ([]OllamaModel, error) {
	endpoint, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil || endpoint.Host == "" || (endpoint.Scheme != "http" && endpoint.Scheme != "https") || endpoint.User != nil {
		return nil, fmt.Errorf("invalid Ollama HTTP URL")
	}
	endpoint.Path = strings.TrimRight(endpoint.Path, "/") + "/api/tags"
	endpoint.RawQuery, endpoint.Fragment = "", ""
	client := &http.Client{Timeout: 5 * time.Second}
	response, err := client.Get(endpoint.String())
	if err != nil {
		return nil, fmt.Errorf("Ollama is unavailable: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Ollama returned HTTP %d", response.StatusCode)
	}
	const limit = 2 * 1024 * 1024
	data, err := io.ReadAll(io.LimitReader(response.Body, limit+1))
	if err != nil {
		return nil, err
	}
	if len(data) > limit {
		return nil, fmt.Errorf("Ollama model response is too large")
	}
	var payload struct {
		Models []struct {
			Name     string `json:"name"`
			Size     int64  `json:"size"`
			Modified string `json:"modified_at"`
		} `json:"models"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("invalid Ollama model response: %w", err)
	}
	models := []OllamaModel{}
	for _, model := range payload.Models {
		models = append(models, OllamaModel(model))
	}
	return models, nil
}
