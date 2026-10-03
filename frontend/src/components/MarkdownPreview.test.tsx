import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownPreview } from './MarkdownPreview';

const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const malicious = [
  '<iframe srcdoc="&lt;script&gt;parent.__markdownScriptRan=1&lt;/script&gt;"></iframe>',
  '<script>window.__markdownScriptRan=1</script><object data="data:text/html,evil"></object><embed src="evil">',
  '<img src="https://example.com/a.png" onerror="alert(1)"><a href="javascript:alert(1)">link</a>',
  '<svg><a xlink:href="javascript:alert(1)">bad</a></svg><form action="/wails/runtime"><input></form>',
];
for (const payload of malicious) {
  const html = renderToStaticMarkup(<MarkdownPreview content={payload} />);
  assert(!/<(?:iframe|script|object|embed|form)\b|srcdoc=|onerror=|javascript:/i.test(html), `Active HTML survived: ${html}`);
}
const ordinary = renderToStaticMarkup(<MarkdownPreview content={'# Heading\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n\n[link](https://example.com)\n\n```javascript\nconst x = 1;\n```\n\nInline $E=mc^2$\n\n$$\n\\frac{a}{b}\n$$\n\n<strong>safe HTML</strong>'} />);
for (const token of ['<h1>', '<table>', 'type="checkbox"', 'https://example.com', 'hljs', 'katex', '<math', '<strong>safe HTML</strong>']) {
  assert(ordinary.includes(token), `Legitimate Markdown lost: ${token}`);
}
console.log('Markdown preview security and compatibility tests passed');

const fragments = renderToStaticMarkup(<MarkdownPreview content={'Footnote[^a]\n\n[^a]: detail\n\n<h2 id="section">Section</h2>\n\n[Go](#section)'} />);
for (const match of fragments.matchAll(/href="#([^"]+)"/g)) {
  assert(fragments.includes(`id="${match[1]}"`), `Fragment target missing: ${match[1]}`);
}
assert(fragments.includes('id="user-content-section"'), 'User IDs must retain clobber protection');
assert(!/href="#.+?" target="_blank"/.test(fragments), 'Fragments must stay in current document');
