/**
 * Validate migrated site: compare sitemap URLs against built output.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const REPORT_PATH = path.join(ROOT, 'src/data/validation-report.json');

const LIVE_SITE = 'https://nerdplaza.nl';
const PREVIEW_BASE = process.env.PREVIEW_URL || 'http://localhost:4321';

const SKIP_PATHS = new Set(['', 'blog', 'contact']);

async function fetchSitemapUrls() {
  const sitemaps = [
    `${LIVE_SITE}/zb_mp-sitemap.xml`,
    `${LIVE_SITE}/page-sitemap.xml`,
    `${LIVE_SITE}/post-sitemap.xml`,
  ];

  const urls = new Set();
  for (const sm of sitemaps) {
    const res = await fetch(sm);
    const xml = await res.text();
    for (const match of xml.matchAll(/<loc>(https:\/\/nerdplaza\.nl[^<]+)<\/loc>/g)) {
      const slug = new URL(match[1]).pathname.replace(/^\/|\/$/g, '');
      if (!SKIP_PATHS.has(slug)) urls.add(match[1]);
    }
  }
  return [...urls];
}

function localPathFromUrl(url) {
  const slug = new URL(url).pathname.replace(/^\/|\/$/g, '');
  if (!slug) return path.join(DIST, 'index.html');
  return path.join(DIST, slug, 'index.html');
}

async function validateBuiltFiles(urls) {
  const missing = [];
  const present = [];

  for (const url of urls) {
    const filePath = localPathFromUrl(url);
    if (fs.existsSync(filePath)) {
      present.push(url);
    } else {
      missing.push(url);
    }
  }

  return { missing, present };
}

async function validateWithPlaywright(urls, sampleSize = 20) {
  if (!fs.existsSync(DIST)) {
    return { skipped: true, reason: 'dist/ not found — run npm run build first' };
  }

  const sample = urls.slice(0, sampleSize);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  for (const liveUrl of sample) {
    const slug = new URL(liveUrl).pathname;
    const localUrl = `${PREVIEW_BASE}${slug}`;

    try {
      const [liveRes, localRes] = await Promise.all([
        page.goto(liveUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }),
        page.goto(localUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null),
      ]);

      const liveTitle = liveRes ? await page.title() : '';
      await page.goto(localUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
      const localTitle = (await page.title()) || '';

      const liveH1 = await page.goto(liveUrl, { waitUntil: 'domcontentloaded' })
        .then(() => page.locator('h1').first().textContent())
        .catch(() => '');

      await page.goto(localUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
      const localH1 = await page.locator('h1').first().textContent().catch(() => '');

      results.push({
        url: slug,
        liveTitle: liveTitle?.slice(0, 80),
        localTitle: localTitle?.slice(0, 80),
        h1Match: liveH1?.trim().slice(0, 60) === localH1?.trim().slice(0, 60),
        localOk: !!localRes || fs.existsSync(localPathFromUrl(liveUrl)),
      });
    } catch (err) {
      results.push({ url: slug, error: err.message });
    }
  }

  await browser.close();
  return { sample: results };
}

async function main() {
  console.log('Fetching sitemap URLs...');
  const urls = await fetchSitemapUrls();
  console.log(`Found ${urls.length} URLs to validate`);

  const fileCheck = await validateBuiltFiles(urls);
  console.log(`Built files: ${fileCheck.present.length} present, ${fileCheck.missing.length} missing`);

  let playwrightCheck = { skipped: true };
  if (process.env.PREVIEW_URL) {
    console.log('Running Playwright sample validation...');
    playwrightCheck = await validateWithPlaywright(urls, 15);
  }

  const report = {
    validatedAt: new Date().toISOString(),
    totalUrls: urls.length,
    builtPresent: fileCheck.present.length,
    builtMissing: fileCheck.missing.length,
    missingUrls: fileCheck.missing.slice(0, 50),
    playwright: playwrightCheck,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`Report written to ${REPORT_PATH}`);

  if (fileCheck.missing.length > 0) {
    console.error(`Validation failed: ${fileCheck.missing.length} pages missing from build`);
    process.exit(1);
  }

  console.log('Validation passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
