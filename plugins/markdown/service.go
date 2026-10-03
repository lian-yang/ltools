package markdown

import (
	"fmt"
	"html/template"
	"os"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// MarkdownService exposes Markdown Editor functionality to the frontend
type MarkdownService struct {
	plugin *MarkdownPlugin
	app    *application.App
}

func NewMarkdownService(plugin *MarkdownPlugin, app *application.App) *MarkdownService {
	return &MarkdownService{
		plugin: plugin,
		app:    app,
	}
}

// SetApp sets the application instance for file operations
func (s *MarkdownService) SetApp(app *application.App) {
	s.app = app
}

// GetStats 获取 Markdown 统计信息
func (s *MarkdownService) GetStats(content string) MarkdownStats {
	return s.plugin.GetStats(content)
}

// ImportFileResult 导入文件结果
type ImportFileResult struct {
	FilePath string `json:"filePath"`
	Content  string `json:"content"`
	Filename string `json:"filename"`
}

// ImportFile 打开文件选择对话框并读取 Markdown 文件
func (s *MarkdownService) ImportFile() (*ImportFileResult, error) {
	if s.app == nil {
		return nil, os.ErrInvalid
	}

	path, err := s.app.Dialog.OpenFile().
		SetTitle("选择 Markdown 文件").
		AddFilter("Markdown Files", "*.md;*.markdown").
		AddFilter("Text Files", "*.txt").
		AddFilter("All Files", "*.*").
		PromptForSingleSelection()

	if err != nil || path == "" {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	// 提取文件名
	filename := path
	if idx := len(path) - 1; idx > 0 {
		for i := idx; i >= 0; i-- {
			if path[i] == '/' || path[i] == '\\' {
				filename = path[i+1:]
				break
			}
		}
	}

	return &ImportFileResult{
		FilePath: path,
		Content:  string(data),
		Filename: filename,
	}, nil
}

// OpenFileAtPath 打开指定路径的 Markdown 文件（用于文件关联）
func (s *MarkdownService) OpenFileAtPath(filePath string) (*ImportFileResult, error) {
	if s.app == nil {
		return nil, os.ErrInvalid
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	// 提取文件名
	filename := filePath
	if idx := len(filePath) - 1; idx > 0 {
		for i := idx; i >= 0; i-- {
			if filePath[i] == '/' || filePath[i] == '\\' {
				filename = filePath[i+1:]
				break
			}
		}
	}

	return &ImportFileResult{
		FilePath: filePath,
		Content:  string(data),
		Filename: filename,
	}, nil
}

// SaveFile 保存 Markdown 文件
func (s *MarkdownService) SaveFile(content string, defaultFilename string) (filePath string, err error) {
	if s.app == nil {
		return "", os.ErrInvalid
	}

	if defaultFilename == "" {
		defaultFilename = "untitled.md"
	}

	path, err := s.app.Dialog.SaveFile().
		SetMessage("保存 Markdown 文件").
		SetFilename(defaultFilename).
		AddFilter("Markdown Files", "*.md").
		AddFilter("All Files", "*.*").
		PromptForSingleSelection()

	if err != nil || path == "" {
		return "", err
	}

	err = os.WriteFile(path, []byte(content), 0644)
	return path, err
}

// ExportHTML 导出为 HTML 文件（带完整样式）
func (s *MarkdownService) ExportHTML(markdownContent string, renderedHTML string, title string) (filePath string, err error) {
	if s.app == nil {
		return "", os.ErrInvalid
	}

	if title == "" {
		title = "Markdown Document"
	}

	defaultFilename := title
	if len(title) > 20 {
		defaultFilename = title[:20]
	}
	defaultFilename = sanitizeFilename(defaultFilename) + ".html"

	path, err := s.app.Dialog.SaveFile().
		SetMessage("导出为 HTML").
		SetFilename(defaultFilename).
		AddFilter("HTML Files", "*.html").
		AddFilter("All Files", "*.*").
		PromptForSingleSelection()

	if err != nil || path == "" {
		return "", err
	}

	// 生成完整的 HTML 文档
	htmlContent := generateHTMLDocument(title, renderedHTML)

	err = os.WriteFile(path, []byte(htmlContent), 0644)
	return path, err
}

// HTMLTemplate 用于生成完整的 HTML 文档
const htmlTemplate = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; img-src https: http: data:; style-src 'unsafe-inline' https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{.Title}}</title>
    <style>
        :root {
            --bg-color: #1a1a2e;
            --text-color: #eaeaea;
            --accent-color: #7c3aed;
            --code-bg: #16213e;
            --border-color: #2a2a4a;
        }
        @media (prefers-color-scheme: light) {
            :root {
                --bg-color: #ffffff;
                --text-color: #1a1a1a;
                --code-bg: #f5f5f5;
                --border-color: #e0e0e0;
            }
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: var(--text-color);
            background-color: var(--bg-color);
            padding: 2rem;
            max-width: 900px;
            margin: 0 auto;
        }
        h1, h2, h3, h4, h5, h6 {
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            font-weight: 600;
            line-height: 1.3;
        }
        h1 { font-size: 2em; border-bottom: 2px solid var(--accent-color); padding-bottom: 0.3em; }
        h2 { font-size: 1.5em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
        h3 { font-size: 1.25em; }
        h4 { font-size: 1em; }
        p { margin: 1em 0; }
        a { color: var(--accent-color); text-decoration: none; }
        a:hover { text-decoration: underline; }
        code {
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
            background-color: var(--code-bg);
            padding: 0.2em 0.4em;
            border-radius: 4px;
            font-size: 0.9em;
        }
        pre {
            background-color: var(--code-bg);
            padding: 1em;
            border-radius: 8px;
            overflow-x: auto;
            margin: 1em 0;
        }
        pre code {
            background: none;
            padding: 0;
        }
        blockquote {
            border-left: 4px solid var(--accent-color);
            margin: 1em 0;
            padding: 0.5em 1em;
            background-color: var(--code-bg);
            border-radius: 0 8px 8px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
        }
        th, td {
            border: 1px solid var(--border-color);
            padding: 0.5em 1em;
            text-align: left;
        }
        th {
            background-color: var(--code-bg);
            font-weight: 600;
        }
        img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 1em 0;
        }
        ul, ol {
            margin: 1em 0;
            padding-left: 2em;
        }
        li { margin: 0.25em 0; }
        hr {
            border: none;
            border-top: 1px solid var(--border-color);
            margin: 2em 0;
        }
    </style>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.33/dist/katex.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github-dark.min.css">
</head>
<body>
{{.Content}}
</body>
</html>`

// generateHTMLDocument 生成完整的 HTML 文档
func generateHTMLDocument(title, content string) string {
	content = exportHTMLPolicy.Sanitize(content)
	tmpl, err := template.New("html").Parse(htmlTemplate)
	if err != nil {
		return fmt.Sprintf("<!DOCTYPE html><html><body>%s</body></html>", content)
	}

	data := struct {
		Title   string
		Content template.HTML
	}{
		Title:   title,
		Content: template.HTML(content),
	}

	var result string
	writer := &stringWriter{}
	if err := tmpl.Execute(writer, data); err != nil {
		return fmt.Sprintf("<!DOCTYPE html><html><body>%s</body></html>", content)
	}
	result = writer.String()
	return result
}

// stringWriter 实现 io.Writer 接口
type stringWriter struct {
	builder []byte
}

func (w *stringWriter) Write(p []byte) (n int, err error) {
	w.builder = append(w.builder, p...)
	return len(p), nil
}

func (w *stringWriter) String() string {
	return string(w.builder)
}

// sanitizeFilename 清理文件名，移除非法字符
func sanitizeFilename(name string) string {
	result := make([]byte, 0, len(name))
	for i := 0; i < len(name); i++ {
		c := name[i]
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == ' ' {
			result = append(result, c)
		} else if c == ' ' {
			result = append(result, '-')
		}
	}
	return string(result)
}
