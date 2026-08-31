/**
 * Shared spam/junk detector for blog posts.
 *
 * Used both at build time (`getAllPosts()` filters defensively, so a spam post
 * that lands via a Payload sync never reaches the site) and by
 * `scripts/remove-spam-blog.mjs`, which deletes the files.
 *
 * Deliberately narrow. Nerd Plaza publishes about gaming, tech and gadgets, so
 * a detector that fires on ordinary product words would delete real articles.
 * Only unambiguous injected spam and WordPress boilerplate are matched.
 */

/** Casino / gambling affiliate spam — the dominant injection on this fleet. */
const GAMBLING_PATTERNS = [
  /\bonline\s+casino'?s?\b/i,
  /\bcasino\s?(bonus|spelen|sites?|reviews?|zonder\s+cruks)\b/i,
  /\bgokkast(en)?\b/i,
  /\bgokken\s+(online|met\s+echt\s+geld)\b/i,
  /\bcruks\b/i,
  /\bbookmakers?\b/i,
  /\bwedden\s+op\s+sport\b/i,
  /\bfree\s?spins?\b/i,
  /\bno\s?deposit\s+bonus\b/i,
];

/** Pharma / adult spam. */
const PHARMA_PATTERNS = [
  /\bviagra\b/i,
  /\bcialis\b/i,
  /\bkamagra\b/i,
  /\bpotentiemiddel(en)?\b/i,
  /\bescort(service|bureau)?\b/i,
];

/** Script injection left behind by a compromised WordPress install. */
const INJECTION_PATTERNS = [
  /document\s*\.\s*write\s*\(/i,
  /eval\s*\(\s*(atob|unescape|String\.fromCharCode)/i,
  /<script[^>]*\bsrc\s*=\s*["']https?:\/\/(?!(?:www\.)?(?:youtube|vimeo|google|gstatic|cloudflare)\.)/i,
  /\bwindow\s*\.\s*location\s*(\.\s*href\s*)?=\s*["']https?:\/\//i,
];

/** WordPress' own placeholder post, shipped with every fresh install. */
const WP_BOILERPLATE_BODY = /Welcome to WordPress\.\s*This is your first post\./i;
const WP_BOILERPLATE_TITLE = /^\s*hello\s+world!?\s*$/i;

function matchesAny(patterns, ...haystacks) {
  return patterns.some((pattern) => haystacks.some((text) => text && pattern.test(text)));
}

/**
 * WordPress' default "Hello world!" post. Kept separate from spam so it can be
 * disabled independently — it is junk, not an injection.
 */
export function isWordPressBoilerplatePost(id = '', body = '', title = '') {
  return WP_BOILERPLATE_TITLE.test(title) && WP_BOILERPLATE_BODY.test(body);
}

/**
 * @param {string} id    entry id / slug
 * @param {string} body  raw body (markdown or html)
 * @param {string} title post title
 * @returns {boolean}
 */
export function isSpamBlogPost(id = '', body = '', title = '') {
  const slug = String(id).replace(/[-_/]+/g, ' ');
  if (matchesAny(INJECTION_PATTERNS, body)) return true;
  if (matchesAny(GAMBLING_PATTERNS, slug, title, body)) return true;
  if (matchesAny(PHARMA_PATTERNS, slug, title, body)) return true;
  if (isWordPressBoilerplatePost(id, body, title)) return true;
  return false;
}

/** Human-readable reason, for the removal script's log. */
export function spamReason(id = '', body = '', title = '') {
  const slug = String(id).replace(/[-_/]+/g, ' ');
  if (matchesAny(INJECTION_PATTERNS, body)) return 'script injection';
  if (matchesAny(GAMBLING_PATTERNS, slug, title, body)) return 'gambling spam';
  if (matchesAny(PHARMA_PATTERNS, slug, title, body)) return 'pharma/adult spam';
  if (isWordPressBoilerplatePost(id, body, title)) return 'WordPress placeholder post';
  return '';
}
