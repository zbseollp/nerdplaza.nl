/**
 * Scrape live nerdplaza.nl pages missing from WordPress XML export.
 * Uses zb_mp-sitemap.xml + page-sitemap.xml for URL discovery.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PAGES_DIR = path.join(ROOT, 'src/content/pages');
const IMAGES_DIR = path.join(ROOT, 'public/images/scraped');
const MANIFEST_PATH = path.join(ROOT, 'src/data/scrape-manifest.json');

const SITE = 'https://nerdplaza.nl';
const CONCURRENCY = 6;
const SKIP_PATHS = new Set(['', 'blog', 'contact']);

const CATEGORY_SLUGS = new Set([
  'gamen',
  'kantoorartikelen',
  'muziek',
  'wearables',
  'drones',
  'televisies',
  'streamen',
  'vermogen',
  'games',
]);

function decodeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}

function slugFromUrl(url) {
  return new URL(url).pathname.replace(/^\/|\/$/g, '');
}

function detectPageType(slug) {
  if (CATEGORY_SLUGS.has(slug)) return 'category';
  if (slug.startsWith('beste-')) return 'review';
  if (slug.endsWith('-streamen')) return 'stream';
  if (slug.startsWith('vermogen-van-')) return 'review';
  return 'page';
}

function yamlString(value) {
  const str = String(value ?? '');
  return JSON.stringify(str);
}

async function fetchText(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'NerdPlazaMigration/1.0' },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(1000 * attempt);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSitemap(url) {
  const xml = await fetchText(url);
  const urls = new Map();
  for (const match of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)) {
    urls.set(match[1], match[2] || null);
  }
  return urls;
}

function extractMetadata($) {
  const title = decodeHtml(
    $('h1.elementor-heading-title').first().text().trim() ||
      $('article h1').first().text().trim() ||
      $('h1').first().text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      $('title').text().trim(),
  );

  const description = decodeHtml(
    $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      '',
  ).slice(0, 320);

  return { title, description };
}

function extractContent($) {
  const postContent = $('.elementor-widget-theme-post-content .elementor-widget-container').first();
  if (postContent.length) {
    const html = postContent.html();
    if (html && html.trim().length > 40) return html;
  }

  const parts = [];

  const h1Section = $('h1').first().closest('.elementor-section');
  if (h1Section.length) {
    const introHtml = h1Section
      .find('.elementor-widget-text-editor .elementor-widget-container')
      .map((_, el) => $(el).html())
      .get()
      .join('\n');
    if (introHtml.trim()) parts.push(introHtml);
  }

  let bestCol = '';
  $('.elementor-col-66').each((_, el) => {
    const html = $(el).html() || '';
    if (html.length > bestCol.length) bestCol = html;
  });
  if (bestCol.length > 400) parts.push(bestCol);

  if (parts.length) return parts.join('\n');

  let fallback = '';
  $('.elementor-col-50, .elementor-col-100').each((_, el) => {
    const html = $(el).html() || '';
    if (html.length > fallback.length && html.length < 150000) fallback = html;
  });

  return fallback;
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 120);
}

async function localizeImages(html, slug) {
  const imageDir = path.join(IMAGES_DIR, slug);
  let result = html;
  const imgMatches = [...result.matchAll(/src="(https?:\/\/[^"]+)"/g)];

  for (const [, src] of imgMatches) {
    if (src.includes('nerdplaza.nl/wp-content/uploads/')) {
      const local = src.replace(/https?:\/\/nerdplaza\.nl\/wp-content\/uploads\//, '/images/wp/');
      result = result.split(src).join(local);
      continue;
    }

    if (!src.includes('myfreeimagehost.com') && !src.includes('nerdplaza.nl')) continue;

    try {
      const urlPath = new URL(src).pathname;
      const basename = sanitizeFilename(path.basename(urlPath) || 'image.jpg');
      const localRel = `/images/scraped/${slug}/${basename}`;
      const localAbs = path.join(ROOT, 'public', localRel);

      if (!fs.existsSync(localAbs)) {
        fs.mkdirSync(path.dirname(localAbs), { recursive: true });
        const res = await fetch(src, { signal: AbortSignal.timeout(20000) });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(localAbs, buf);
      }

      result = result.split(src).join(localRel);
    } catch {
      // Keep remote URL if download fails
    }
  }

  return result;
}

function cleanContent(html) {
  let result = html;
  result = result.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  result = result.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  result = result.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '');
  result = result.replace(/\[zb_mpx_category_links[^\]]*\]/gi, '');
  result = result.replace(/https?:\/\/nerdplaza\.nl\/wp-content\/uploads\//g, '/images/wp/');
  result = result.replace(/\/wp-content\/uploads\//g, '/images/wp/');
  result = result.replace(/https?:\/\/nerdplaza\.nl/g, '');
  result = result.replace(/\sdata-[a-z-]+="[^"]*"/gi, '');
  result = result.replace(/\sdata-e-type="[^"]*"/gi, '');
  result = result.replace(/<p[^>]*>\s*<\/p>/gi, '');
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

function buildMarkdown({ slug, title, description, pubDate, pageType, body }) {
  const fm = [
    '---',
    `title: ${yamlString(title)}`,
    `description: ${yamlString(description)}`,
    `pubDate: ${yamlString(pubDate)}`,
    `pageType: ${yamlString(pageType)}`,
    'author: "admin"',
    'featuredImage: ""',
    '---',
    '',
    body,
    '',
  ].join('\n');

  return fm;
}

async function scrapePage(url, lastmod) {
  const slug = slugFromUrl(url);
  if (SKIP_PATHS.has(slug)) return { slug, skipped: true };

  const html = await fetchText(url);
  const $ = cheerio.load(html);

  const { title, description } = extractMetadata($);
  let body = extractContent($);
  body = cleanContent(body);
  body = await localizeImages(body, slug);

  if (!title || body.length < 30) {
    return { slug, error: 'missing content', title, bodyLength: body.length };
  }

  const pageType = detectPageType(slug);
  const pubDate = lastmod || new Date().toISOString();

  const markdown = buildMarkdown({
    slug,
    title,
    description: description || title,
    pubDate,
    pageType,
    body,
  });

  fs.mkdirSync(PAGES_DIR, { recursive: true });
  fs.writeFileSync(path.join(PAGES_DIR, `${slug}.md`), markdown);

  return { slug, pageType, bodyLength: body.length };
}

async function runPool(items, worker, concurrency) {
  const results = [];
  let index = 0;

  async function next() {
    while (index < items.length) {
      const current = index++;
      try {
        results[current] = await worker(items[current]);
      } catch (err) {
        results[current] = { slug: slugFromUrl(items[current].url), error: err.message };
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, next));
  return results;
}

async function main() {
  console.log('Fetching sitemaps...');
  const zbMp = await fetchSitemap(`${SITE}/zb_mp-sitemap.xml`);
  const pages = await fetchSitemap(`${SITE}/page-sitemap.xml`);

  const allUrls = new Map([...pages, ...zbMp]);
  const targets = [...allUrls.entries()]
    .map(([url, lastmod]) => ({ url, lastmod }))
    .filter(({ url }) => !SKIP_PATHS.has(slugFromUrl(url)));

  console.log(`Scraping ${targets.length} pages (${zbMp.size} product/stream, ${pages.size} WP pages)...`);

  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const results = await runPool(
    targets,
    ({ url, lastmod }) => scrapePage(url, lastmod),
    CONCURRENCY,
  );

  const ok = results.filter((r) => r && !r.error && !r.skipped);
  const failed = results.filter((r) => r?.error);
  const skipped = results.filter((r) => r?.skipped);

  const manifest = {
    scrapedAt: new Date().toISOString(),
    total: targets.length,
    success: ok.length,
    failed: failed.length,
    skipped: skipped.length,
    pages: ok.map((r) => ({ slug: r.slug, pageType: r.pageType, bodyLength: r.bodyLength })),
    errors: failed.map((r) => ({ slug: r.slug, error: r.error, bodyLength: r.bodyLength })),
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log(`Done: ${ok.length} saved, ${failed.length} failed, ${skipped.length} skipped`);
  if (failed.length) {
    console.log('Failed slugs:', failed.slice(0, 10).map((f) => f.slug).join(', '), failed.length > 10 ? '...' : '');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
