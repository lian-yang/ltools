package markdown

import (
	"regexp"

	"github.com/microcosm-cc/bluemonday"
)

var exportHTMLPolicy = newExportHTMLPolicy()

func newExportHTMLPolicy() *bluemonday.Policy {
	p := bluemonday.UGCPolicy()
	p.AllowAttrs("class").Matching(regexp.MustCompile(`^[a-zA-Z0-9_\- ]+$`)).Globally()
	p.AllowAttrs("aria-hidden").Matching(regexp.MustCompile(`^(true|false)$`)).OnElements("span", "svg")
	// Keep the static MathML/SVG emitted by KaTeX without allowing active SVG or URLs.
	p.AllowElements("math", "semantics", "annotation", "mrow", "mi", "mn", "mo", "mtext", "msup", "msub", "msubsup", "mfrac", "msqrt", "mroot", "mover", "munder", "munderover", "mtable", "mtr", "mtd", "mspace", "menclose", "mpadded", "mstyle", "svg", "path", "line")
	p.AllowNoAttrs().OnElements("math", "semantics", "annotation", "mrow", "mi", "mn", "mo", "mtext", "msup", "msub", "msubsup", "mfrac", "msqrt", "mroot", "mover", "munder", "munderover", "mtable", "mtr", "mtd", "mspace", "menclose", "mpadded", "mstyle", "svg", "path", "line")
	p.AllowAttrs("xmlns", "display").OnElements("math", "svg")
	p.AllowAttrs("encoding").Matching(regexp.MustCompile(`^application/x-tex$`)).OnElements("annotation")
	p.AllowAttrs("stretchy", "fence", "separator", "mathvariant", "accent", "accentunder", "columnalign", "rowspacing", "columnspacing", "displaystyle", "scriptlevel", "mathcolor", "mathbackground").OnElements("mo", "mi", "mover", "munder", "munderover", "mtable", "mstyle")
	p.AllowAttrs("width", "height", "depth", "voffset", "viewBox", "preserveAspectRatio", "d", "x1", "x2", "y1", "y2").OnElements("mspace", "mpadded", "svg", "path", "line")
	p.AllowStyles("height", "width", "min-width", "top", "left", "margin-left", "margin-right", "padding-left", "vertical-align", "font-size", "border-bottom-width").
		Matching(regexp.MustCompile(`^-?[0-9]+(\.[0-9]+)?(em|ex|px|%)?$`)).OnElements("span", "svg")
	p.AllowStyles("color").Matching(regexp.MustCompile(`^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgb\([0-9 ,%]+\))$`)).OnElements("span")
	p.AllowStyles("position").Matching(regexp.MustCompile(`^relative$`)).OnElements("span")
	p.AllowAttrs("type").Matching(regexp.MustCompile(`^checkbox$`)).OnElements("input")
	p.AllowAttrs("disabled", "checked").OnElements("input")
	p.AllowElements("input")
	return p
}
