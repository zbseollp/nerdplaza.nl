import { resolveMediaUrl } from './media-url.mjs';

type ImageLike =
  | string
  | { url?: string; src?: string; filename?: string; alt?: string; [key: string]: unknown }
  | null
  | undefined;

type FrontmatterLike = Record<string, unknown> | null | undefined;

/** Frontmatter keys that have carried the hero image on this fleet, in priority order. */
const IMAGE_FIELDS = [
  'featuredImage',
  'heroImage',
  'image',
  'coverImage',
  'thumbnail',
  'ogImage',
] as const;

const ALT_FIELDS = [
  'featuredImageAlt',
  'imageAlt',
  'heroImageAlt',
  'altText',
  'alt',
] as const;

const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)/;
const HTML_IMAGE = /<img[^>]+src\s*=\s*["']([^"']+)["']/i;

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function pick(data: FrontmatterLike, keys: readonly string[]): unknown {
  if (!data) return undefined;
  for (const key of keys) {
    const value = (data as Record<string, unknown>)[key];
    if (!isBlank(value)) return value;
  }
  const extra = (data as Record<string, unknown>).extra;
  if (extra && typeof extra === 'object') {
    for (const key of keys) {
      const value = (extra as Record<string, unknown>)[key];
      if (!isBlank(value)) return value;
    }
  }
  return undefined;
}

/** First image referenced in the body, used only when no frontmatter field has one. */
function firstBodyImage(body?: string | null): string {
  if (!body) return '';
  const markdown = body.match(MARKDOWN_IMAGE);
  if (markdown) return markdown[1];
  const html = body.match(HTML_IMAGE);
  if (html) return html[1];
  return '';
}

/**
 * Resolve the hero/card image for a post to a URL that actually loads.
 * Returns '' when the post genuinely has no image — callers must not render
 * an `<img>` in that case.
 */
export function resolveFeaturedImage(data: FrontmatterLike, body?: string | null): string {
  const candidate = pick(data, IMAGE_FIELDS) as ImageLike;
  const resolved = resolveMediaUrl(candidate);
  if (resolved) return resolved;
  return resolveMediaUrl(firstBodyImage(body));
}

export function resolveFeaturedImageAlt(data: FrontmatterLike, fallback = ''): string {
  const explicit = pick(data, ALT_FIELDS);
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();

  const candidate = pick(data, IMAGE_FIELDS);
  if (candidate && typeof candidate === 'object') {
    const alt = (candidate as Record<string, unknown>).alt;
    if (typeof alt === 'string' && alt.trim()) return alt.trim();
  }

  const title = data && (data as Record<string, unknown>).title;
  if (typeof title === 'string' && title.trim()) return title.trim();
  return fallback;
}
