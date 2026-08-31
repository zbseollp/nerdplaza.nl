import { resolveMediaUrl, repairMediaUrlsInHtml } from './media-url.mjs';

function repairSrcset(value) {
  return value
    .split(',')
    .map((candidate) => {
      const trimmed = candidate.trim();
      if (!trimmed) return '';
      const [url, ...descriptors] = trimmed.split(/\s+/);
      return [resolveMediaUrl(url) || url, ...descriptors].join(' ');
    })
    .filter(Boolean)
    .join(', ');
}

function repairElement(node, ctx) {
  const props = node.properties ?? {};

  if (typeof props.src === 'string') {
    const resolved = resolveMediaUrl(props.src);
    if (resolved && resolved !== props.src) ctx.setProperty(node, 'src', resolved);
  }

  const srcSet = props.srcSet ?? props.srcset;
  if (typeof srcSet === 'string') {
    const resolved = repairSrcset(srcSet);
    if (resolved !== srcSet) ctx.setProperty(node, 'srcSet', resolved);
  }
}

/**
 * Sätteri hast plugin (Astro 7's default Markdown processor).
 *
 * Rewrites `<img src>` / `srcset` in rendered Markdown so Payload's `/media/…`
 * references resolve to the tenant's R2 URL. `raw` nodes are handled too:
 * the WordPress-migrated posts store their body as raw HTML inside the .md file,
 * so their images never become element nodes.
 */
export function satteriRepairMediaUrls() {
  return {
    name: 'repair-media-urls',
    element: {
      filter: ['img', 'source'],
      visit: repairElement,
    },
    raw(node, ctx) {
      if (typeof node.value !== 'string' || !node.value.includes('src')) return;
      const repaired = repairMediaUrlsInHtml(node.value);
      if (repaired !== node.value) ctx.replaceNode(node, { ...node, value: repaired });
    },
  };
}

/**
 * Equivalent plugin for the `unified` processor, kept so the pipeline survives a
 * switch to `markdown.processor: unified()` from `@astrojs/markdown-remark`.
 */
export default function rehypeRepairMediaUrls() {
  return (tree) => {
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'element' && (node.tagName === 'img' || node.tagName === 'source')) {
        const props = node.properties ?? (node.properties = {});
        if (typeof props.src === 'string') {
          const resolved = resolveMediaUrl(props.src);
          if (resolved) props.src = resolved;
        }
        if (typeof props.srcSet === 'string') props.srcSet = repairSrcset(props.srcSet);
      }
      if (node.type === 'raw' && typeof node.value === 'string') {
        node.value = repairMediaUrlsInHtml(node.value);
      }
      if (Array.isArray(node.children)) node.children.forEach(walk);
    };
    walk(tree);
  };
}
