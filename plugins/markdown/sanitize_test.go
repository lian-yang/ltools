package markdown

import (
	"strings"
	"testing"
)

func TestExportRejectsActiveHTML(t *testing.T) {
	for _, payload := range []string{
		`<iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>`,
		`<script>alert(1)</script><object data="data:text/html,evil"></object><embed src="evil">`,
		`<img src="https://example.com/a.png" onerror="alert(1)"><a href="java&#x73;cript:alert(1)">link</a>`,
		`<svg onload="alert(1)"><a xlink:href="javascript:alert(1)">bad</a></svg>`,
		`<span style="background:url(javascript:alert(1));height:expression(alert(1))">bad</span>`,
	} {
		clean := exportHTMLPolicy.Sanitize(payload)
		for _, forbidden := range []string{"<iframe", "<script", "<object", "<embed", "srcdoc", "onerror", "onload", "javascript:", "expression("} {
			if strings.Contains(strings.ToLower(clean), forbidden) {
				t.Errorf("%s survived: %s", forbidden, clean)
			}
		}
		doc := generateHTMLDocument(`</title><script>alert(2)</script>`, payload)
		if strings.Contains(doc, "<script>") {
			t.Fatal("export document contains active script")
		}
		if !strings.Contains(doc, "script-src 'none'") {
			t.Fatal("export is missing CSP")
		}
	}
}

func TestExportPreservesMarkdownAndMath(t *testing.T) {
	content := `<h1>Heading</h1><table><tr><td>cell</td></tr></table><pre><code class="language-js hljs">code</code></pre><input type="checkbox" checked disabled><span class="katex" style="height:1.2em"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mfrac><mi>a</mi><mi>b</mi></mfrac><annotation encoding="application/x-tex">\frac{a}{b}</annotation></semantics></math><svg viewBox="0 0 10 10"><path d="M0 0 L10 10"></path></svg></span><a href="https://example.com">link</a>`
	clean := exportHTMLPolicy.Sanitize(content)
	for _, token := range []string{"<h1>", "<table>", "language-js hljs", "checkbox", "checked", "disabled", "katex", "<math", "<mfrac>", "<annotation", "<svg", "<path", "height: 1.2em", "https://example.com"} {
		if !strings.Contains(clean, token) {
			t.Errorf("legitimate content %q lost: %s", token, clean)
		}
	}
}

func TestExportPreservesKatexLayoutAndColor(t *testing.T) {
	content := `<span class="katex"><math><mstyle mathcolor="red"><mi>x</mi></mstyle></math><span style="color:red;padding-left:0.833em">x</span></span>`
	clean := exportHTMLPolicy.Sanitize(content)
	for _, token := range []string{`mathcolor="red"`, `color: red`, `padding-left: 0.833em`} {
		if !strings.Contains(clean, token) {
			t.Errorf("KaTeX formatting %q lost: %s", token, clean)
		}
	}
}
