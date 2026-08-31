/**
 * Central chokepoint for every media URL that reaches the browser.
 *
 * Payload writes hero/featured images as `/media/<file>` (and sometimes as an
 * absolute R2 URL that is missing the `tenants/<slug>/` folder). Neither form
 * exists under `public/`, so it has to be rewritten to the tenant's R2 key:
 *
 *   /media/hero.jpg -> https://pub-….r2.dev/tenants/nerdplaza/hero.jpg
 *
 * Everything already migrated from WordPress lives under `/images/…` in
 * `public/` and must pass through untouched.
 */

export const DEFAULT_TENANT_SLUG = 'nerdplaza';
export const DEFAULT_PAYLOAD_PUBLIC_BASE = 'https://pub-d4024ad3e57841448e0ee58a19abe46b.r2.dev';

/** Paths that are served from `public/` and must never be rewritten. */
const SITE_RELATIVE_PREFIXES = [
  '/images/',
  '/assets/',
  '/wp-content/',
  '/uploads/',
  '/fonts/',
  '/favicon',
  '/_astro/',
];

function envValue(env, key) {
  if (env && typeof env === 'object' && env[key]) return String(env[key]);
  try {
    if (import.meta.env && import.meta.env[key]) return String(import.meta.env[key]);
  } catch {
    /* not running under Vite */
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return String(process.env[key]);
  }
  return '';
}

export function getTenantSlug(env) {
  const slug = envValue(env, 'PUBLIC_TENANT_SLUG') || envValue(env, 'TENANT_SLUG');
  return (slug || DEFAULT_TENANT_SLUG).trim().replace(/^\/+|\/+$/g, '');
}

export function getPayloadPublicBase(env) {
  const base =
    envValue(env, 'R2_PUBLIC_URL') ||
    envValue(env, 'PUBLIC_R2_URL') ||
    envValue(env, 'PUBLIC_PAYLOAD_MEDIA_URL') ||
    DEFAULT_PAYLOAD_PUBLIC_BASE;
  return base.trim().replace(/\/+$/, '');
}

/**
 * Encode a path per segment, decoding first so an already-encoded `%20`
 * is not doubled into `%2520`. Payload media keys are sometimes the media
 * *title* rather than a filename, so they can contain spaces and no extension.
 */
function encodePath(path) {
  return path
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        decoded = segment;
      }
      return encodeURIComponent(decoded);
    })
    .join('/');
}

/** Pull a usable string out of the several shapes Payload emits. */
function toRawString(input) {
  if (!input) return '';
  if (typeof input === 'string') return input.trim();
  if (typeof input !== 'object') return '';
  const candidate =
    input.url ?? input.src ?? input.filename ?? input.path ?? input.thumbnailURL ?? '';
  return typeof candidate === 'string' ? candidate.trim() : '';
}

const MEDIA_EXTENSION = /\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?|ico|mp4|webm|mov|m4v|pdf)$/i;

/**
 * Is a bare string (no slash, no scheme) plausibly an R2 media key?
 *
 * Payload sometimes stores the media *title* rather than a filename, so a key
 * may have spaces and no extension ("Stijlvol en eigentijds wonen"). But some
 * scraped pages carry a whole paragraph of prose in a broken `<img src>`, and
 * turning that into an R2 URL would be worse than leaving it alone.
 */
function looksLikeMediaKey(value) {
  if (MEDIA_EXTENSION.test(value)) return true;
  if (value.length > 128) return false;
  // Reject prose, HTML fragments and WordPress shortcodes like `[zb_mp_Image]`.
  if (/[<>?!;:"'`\n\r\[\]{}|\\*]/.test(value)) return false;
  if (/\.\s/.test(value)) return false;
  if (value.trim().split(/\s+/).length > 8) return false;
  return true;
}

function isR2Host(hostname) {
  return /(^|\.)r2\.dev$/i.test(hostname) || /(^|\.)r2\.cloudflarestorage\.com$/i.test(hostname);
}

/**
 * Resolve any Payload/WordPress media reference to a URL that actually loads.
 * Idempotent: correct URLs, other hosts and local `public/` paths pass through.
 *
 * @param {string | Record<string, unknown> | null | undefined} input
 * @param {Record<string, string>} [env]
 * @returns {string} resolved URL, or '' when there is no image
 */
export function resolveMediaUrl(input, env) {
  const raw = toRawString(input);
  if (!raw) return '';
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;

  const base = getPayloadPublicBase(env);
  const slug = getTenantSlug(env);
  const tenantPrefix = `/tenants/${slug}/`;

  // Absolute (or protocol-relative) URLs.
  if (/^(https?:)?\/\//i.test(raw)) {
    let url;
    try {
      url = new URL(raw.startsWith('//') ? `https:${raw}` : raw);
    } catch {
      return raw;
    }
    if (!isR2Host(url.hostname)) return url.href;
    // The sync bot intermittently drops `tenants/<slug>/` from R2 URLs.
    if (!url.pathname.startsWith(tenantPrefix)) {
      const key = url.pathname.replace(/^\/+/, '');
      url.pathname = `${tenantPrefix}${key}`;
    }
    url.pathname = encodePath(url.pathname);
    return url.href;
  }

  // Payload media paths.
  const mediaMatch = raw.match(/^\/?media\/(.+)$/i);
  if (mediaMatch) {
    return `${base}${tenantPrefix}${encodePath(mediaMatch[1].replace(/^\/+/, ''))}`;
  }

  if (raw.startsWith('/')) {
    const lower = raw.toLowerCase();
    if (SITE_RELATIVE_PREFIXES.some((prefix) => lower.startsWith(prefix))) return raw;
    if (lower.startsWith(tenantPrefix)) return `${base}${encodePath(raw)}`;
    if (lower.startsWith('/tenants/')) return `${base}${encodePath(raw)}`;
    // Unknown absolute path — leave it site-relative rather than guessing.
    return raw;
  }

  if (raw.startsWith('./') || raw.startsWith('../') || raw.startsWith('#')) return raw;

  // A bare media key (Payload sometimes stores the media *title*, spaces and all).
  if (looksLikeMediaKey(raw)) return `${base}${tenantPrefix}${encodePath(raw)}`;

  // Not a media reference at all — report "no image" rather than inventing a URL.
  return '';
}

const ATTR_PATTERN = /\b(src|srcset|data-src|data-srcset)\s*=\s*(["'])(.*?)\2/gi;

function repairSrcset(value, env) {
  return value
    .split(',')
    .map((candidate) => {
      const trimmed = candidate.trim();
      if (!trimmed) return '';
      const [url, ...descriptors] = trimmed.split(/\s+/);
      const resolved = resolveMediaUrl(url, env);
      return [resolved || url, ...descriptors].join(' ');
    })
    .filter(Boolean)
    .join(', ');
}

/**
 * Rewrite every `src`/`srcset` inside an HTML body (WordPress posts are stored
 * as raw HTML and rendered with `set:html`, so the rehype plugin never sees them).
 */
export function repairMediaUrlsInHtml(html, env) {
  if (!html || typeof html !== 'string') return html ?? '';
  return html.replace(ATTR_PATTERN, (match, attr, quote, value) => {
    const isSrcset = /srcset$/i.test(attr);
    const resolved = isSrcset ? repairSrcset(value, env) : resolveMediaUrl(value, env);
    if (!resolved || resolved === value) return match;
    return `${attr}=${quote}${resolved}${quote}`;
  });
}
