/**
 * Convert broken Elementor HTML in review/stream pages to clean product cards.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PAGES_DIR = path.join(ROOT, 'src/content/pages');

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function sanitizeInlineHtml(html) {
  if (!html) return '';

  return html
    .replace(/<p>([\s\S]*?)<\/p>/gi, (_, inner) => {
      const parts = inner
        .split(/\n\s*\n/)
        .map((part) => part.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

      if (parts.length <= 1) {
        return `<p>${inner.replace(/\s+/g, ' ').trim()}</p>`;
      }

      return parts.map((part) => `<p>${part}</p>`).join('');
    })
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

function sanitizeIntroHtml(html) {
  return html
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => (block.startsWith('<p>') ? sanitizeInlineHtml(block) : block.replace(/\s+/g, ' ').trim()))
    .join('\n');
}

function cleanIntro(html) {
  let intro = html.trim();
  intro = intro.replace(/<\/div>\s*$/gi, '');
  intro = intro.replace(/<div class="flex max-w-full[\s\S]*$/gi, '');
  intro = intro.replace(/\sdata-[a-z-]+="[^"]*"/gi, '');
  return sanitizeIntroHtml(intro);
}

function extractProducts(body) {
  const $ = cheerio.load(`<root>${body}</root>`, { xml: false }, false);
  const products = [];

  $('section.elementor-inner-section').each((_, section) => {
    const $s = $(section);
    const img = $s.find('img').first().attr('src') || '';
    const title = $s.find('h2').first().text().trim();
    const descEl = $s.find('.elementor-widget-text-editor .elementor-widget-container').first();
    const desc = descEl.html()?.trim() || descEl.text().trim();
    const link = $s.find('a.elementor-button').first().attr('href') || '';
    const btnText =
      $s.find('.elementor-button-text').first().text().trim() || 'Bekijk prijs bij Bol.com';

    if (title && link) {
      products.push({ img, title, desc, link, btnText });
    }
  });

  if (products.length === 0) {
    $('.elementor-widget-button').each((_, widget) => {
      const $w = $(widget).closest('.elementor-inner-section, .elementor-column, section');
      const scope = $w.length ? $w.first() : $(widget).parent();
      const img = scope.find('img').first().attr('src') || '';
      const title = scope.find('h2').first().text().trim();
      const desc = scope.find('.elementor-widget-text-editor p').first().html()?.trim() || '';
      const link = $(widget).find('a').first().attr('href') || '';
      const btnText = $(widget).find('.elementor-button-text').first().text().trim() || 'Bekijk prijs bij Bol.com';
      if (title && link) products.push({ img, title, desc, link, btnText });
    });
  }

  return products;
}

function buildProductCards(products) {
  if (!products.length) return '';

  const cards = products
    .map((product) => {
      const media = product.img
        ? `<div class="product-card-media"><img src="${escapeAttr(product.img)}" alt="${escapeAttr(product.title)}" width="400" height="400" loading="lazy" decoding="async" /></div>`
        : '';

      const desc = sanitizeInlineHtml(product.desc);

      return `<article class="product-card">
${media}
<div class="product-card-body">
<h2>${product.title}</h2>
<div class="product-card-desc">${desc}</div>
<a class="product-card-btn" href="${escapeAttr(product.link)}" target="_blank" rel="nofollow noopener">${product.btnText}</a>
</div>
</article>`;
    })
    .join('\n');

  return `<div class="product-reviews">\n${cards}\n</div>`;
}

function stripElementorProse(body) {
  const $ = cheerio.load(`<root>${body}</root>`, { xml: false }, false);
  const chunks = [];
  const seen = new Set();

  $('.zbmp-breadcrumb').remove();

  $('.elementor-widget-text-editor, .elementor-widget-heading, .elementor-widget-theme-post-content').each(
    (_, widget) => {
      const container = $(widget).find('.elementor-widget-container').first();
      const html = container.html()?.trim();
      if (!html || html.length < 12) return;
      if (html.includes('zbmp-breadcrumb')) return;
      if (seen.has(html)) return;
      seen.add(html);
      chunks.push(html);
    },
  );

  if (!chunks.length) return null;

  return chunks
    .join('\n\n')
    .replace(/\sdata-[a-z-]+="[^"]*"/gi, '')
    .replace(/\sclass="[^"]*wp-elements-[^"]*"/gi, '')
    .replace(/\sclass="has-white-color has-text-color has-link-color"/gi, '')
    .trim();
}

function fixExistingProductReviews(body) {
  if (!body.includes('product-reviews')) return null;

  const marker = body.indexOf('<div class="product-reviews">');
  const intro = marker > 0 ? cleanIntro(body.slice(0, marker)) : '';
  const reviewsHtml = body.slice(marker);

  const $ = cheerio.load(reviewsHtml, { xml: false }, false);
  const products = [];

  $('.product-card').each((_, card) => {
    const $card = $(card);
    products.push({
      img: $card.find('.product-card-media img').attr('src') || '',
      title: $card.find('.product-card-body h2').first().text().trim(),
      desc: sanitizeInlineHtml($card.find('.product-card-desc').html()?.trim() || ''),
      link: $card.find('.product-card-btn').attr('href') || '',
      btnText: $card.find('.product-card-btn').text().trim() || 'Bekijk prijs bij Bol.com',
    });
  });

  if (!products.length) return null;

  const parts = [];
  if (intro) parts.push(intro);
  parts.push(buildProductCards(products));
  return parts.join('\n\n') + '\n';
}

function normalizePageBody(body, pageType) {
  if (body.includes('product-reviews')) {
    return fixExistingProductReviews(body);
  }

  if (pageType === 'review' || pageType === 'stream') {
    const review = normalizeReviewBody(body);
    if (review) return review;
  }

  if (body.includes('elementor')) {
    const prose = stripElementorProse(body);
    if (prose) return prose + '\n';
  }

  return null;
}

function normalizeReviewBody(body) {
  const marker = body.search(
    /<div class="elementor-widget-wrap|<section class="elementor-section elementor-inner-section|<div class="elementor-element elementor-element/,
  );

  const intro = marker > 0 ? cleanIntro(body.slice(0, marker)) : cleanIntro(body);
  const productHtml = marker > 0 ? body.slice(marker) : '';
  const products = extractProducts(productHtml);

  if (!products.length) return null;

  const parts = [];
  if (intro) parts.push(intro);
  parts.push(buildProductCards(products));
  return parts.join('\n\n') + '\n';
}

function parseFrontmatter(content) {
  const parts = content.split('---');
  if (parts.length < 3) return null;
  return {
    frontmatter: parts.slice(0, 2).join('---') + '---',
    body: parts.slice(2).join('---'),
  };
}

function getPageType(frontmatter) {
  const match = frontmatter.match(/pageType:\s*"?(review|stream|category|page)"?/);
  return match?.[1];
}

function main() {
  let updated = 0;
  let skipped = 0;

  for (const file of fs.readdirSync(PAGES_DIR)) {
    if (!file.endsWith('.md')) continue;

    const filePath = path.join(PAGES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = parseFrontmatter(content);
    if (!parsed) continue;

    const pageType = getPageType(parsed.frontmatter) || 'page';

    if (!parsed.body.includes('elementor') && !parsed.body.includes('product-reviews')) {
      skipped++;
      continue;
    }

    if (!parsed.body.includes('elementor') && parsed.body.includes('product-reviews')) {
      const fixed = fixExistingProductReviews(parsed.body);
      if (fixed && fixed !== parsed.body.trim() + '\n') {
        fs.writeFileSync(filePath, `${parsed.frontmatter}\n\n${fixed}`);
        updated++;
      } else {
        skipped++;
      }
      continue;
    }

    if (!parsed.body.includes('elementor')) {
      skipped++;
      continue;
    }

    const normalized = normalizePageBody(parsed.body, pageType);
    if (!normalized) {
      console.warn('Skip (could not normalize):', file);
      skipped++;
      continue;
    }

    fs.writeFileSync(filePath, `${parsed.frontmatter}\n\n${normalized}`);
    updated++;
  }

  console.log(`Normalized ${updated} pages (${skipped} skipped)`);
}

main();
