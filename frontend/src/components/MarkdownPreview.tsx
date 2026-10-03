import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

const fixFragmentLinks = () => (tree: any) => {
  const ids = new Set<string>();
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.properties?.id) {
      const raw = String(node.properties.id);
      const normalized = raw.replace(/^user-content-user-content-/, 'user-content-');
      node.properties.id = normalized;
      ids.add(normalized);
    }
    node.children?.forEach(walk);
  };
  walk(tree);
  // Links can precede their target in the tree, so resolve fragments in a second pass.
  const rewrite = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.properties?.href?.startsWith?.('#')) {
      const fragment = node.properties.href.slice(1);
      if (ids.has(`user-content-${fragment}`)) node.properties.href = `#user-content-${fragment}`;
    }
    node.children?.forEach(rewrite);
  };
  rewrite(tree);
};

const markdownSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []),
      ['className', /^language-./, 'math-inline', 'math-display']],
  },
};

export function MarkdownPreview({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]}
    rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSchema],
      [rehypeKatex, { trust: false }], rehypeHighlight, fixFragmentLinks]}
    components={{ a: ({ node: _node, href, children, ...props }) =>
      <a {...props} href={href} target={href?.startsWith('#') ? undefined : '_blank'} rel="noopener noreferrer">{children}</a> }}>
    {content}
  </ReactMarkdown>;
}
