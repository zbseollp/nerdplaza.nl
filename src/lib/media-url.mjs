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
function extractMediaPath(input) {
  if (!input) return '';
  if (typeof input === 'string') {
    return input.trim().replace(/\s+\\?["'].*$/, '').trim();
  }
  if (Array.isArray(input)) {
    for (const item of input) {
      const found = extractMediaPath(item);
      if (found) return found;
    }
    return '';
  }
  if (typeof input !== 'object') return '';

  const filename = typeof input.filename === 'string' ? input.filename.trim() : '';
  const prefix = typeof input.prefix === 'string' ? input.prefix.trim().replace(/^\/+|\/+$/g, '') : '';
  const rawUrl = typeof input.url === 'string' ? input.url.trim() : '';

  if (filename && prefix) {
    if (rawUrl && /^https?:\/\//i.test(rawUrl) && !rawUrl.includes(`/${prefix}/`)) {
      try {
        const u = new URL(rawUrl);
        u.pathname = `/${prefix}/${filename}`;
        return u.toString();
      } catch {
        /* fall through */
      }
    }
    if (rawUrl) return rawUrl;
    return `/${prefix}/${filename}`;
  }

  if (rawUrl) return rawUrl;
  if (typeof input.src === 'string' && input.src.trim()) return input.src.trim();
  if (typeof input.path === 'string' && input.path.trim()) return input.path.trim();
  if (typeof input.thumbnailURL === 'string' && input.thumbnailURL.trim()) return input.thumbnailURL.trim();
  if (filename) return `/media/${filename}`;
  if (input.value && typeof input.value === 'object') return extractMediaPath(input.value);
  return '';
}

const MEDIA_EXTENSION = /\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?|ico|mp4|webm|mov|m4v|pdf)$/i;

/** True when this URL/path can be a real <img src>, not a webpage dumped into the field. */
function looksLikeImageRef(value) {
  if (!value) return false;
  if (value.startsWith('data:image/')) return true;
  const path = value.split(/[?#]/)[0];
  if (/^\/(?:media|api\/media)\//i.test(path)) return true;
  if (/r2\.dev|cloudflarestorage\.com/i.test(value)) return true;
  if (SITE_RELATIVE_PREFIXES.some((prefix) => path.toLowerCase().startsWith(prefix))) return true;
  return MEDIA_EXTENSION.test(path);
}

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
  const raw = extractMediaPath(input);
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
      return looksLikeImageRef(raw) ? raw : '';
    }
    if (!isR2Host(url.hostname)) {
      return looksLikeImageRef(url.pathname) ? url.href : '';
    }
    const segments = url.pathname.split('/').filter(Boolean);
    // Bucket-root or /media/<file> on the R2 host — objects live under tenants/<slug>/.
    if (segments[0] !== 'tenants') {
      const file = segments[0] === 'media' && segments[1] ? segments.slice(1).join('/') : segments.join('/');
      url.pathname = `${tenantPrefix}${file}`;
    }
    url.pathname = encodePath(url.pathname);
    return url.href;
  }

  // Payload media paths (/media/x and /api/media/x).
  const mediaMatch = raw.match(/^\/?(?:api\/)?media\/(.+)$/i);
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
