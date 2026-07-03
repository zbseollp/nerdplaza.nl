/**
 * WordPress WXR → Astro content migration
 * Usage: node scripts/migrate-wordpress.mjs [path-to-xml]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const XML_PATH = process.argv[2] || 'C:/Users/Nilesh rana/Downloads/nerdplazanl.WordPress.2026-06-30.xml';
const WP_UPLOADS = 'https://nerdplaza.nl/wp-content/uploads/';
const PUBLIC_WP = path.join(ROOT, 'public/images/wp');
const BLOG_DIR = path.join(ROOT, 'src/content/blog');
const PAGES_DIR = path.join(ROOT, 'src/content/pages');
const AUTHORS_DIR = path.join(ROOT, 'src/content/authors');
const CATEGORIES_DIR = path.join(ROOT, 'src/content/categories');
const TAGS_DIR = path.join(ROOT, 'src/content/tags');

const FALLBACK_IMAGE = '/images/blog/gaming-fallback.jpg';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function getCdata(block, tag) {
  const cdataRe = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i');
  const m = block.match(cdataRe);
  if (m) return m[1].trim();
  const plainRe = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
  const p = block.match(plainRe);
  return p ? p[1].trim() : '';
}

function getAllMeta(block) {
  const meta = {};
  const re = /<wp:postmeta>[\s\S]*?<wp:meta_key><!\[CDATA\[([\s\S]*?)\]\]><\/wp:meta_key>[\s\S]*?<wp:meta_value><!\[CDATA\[([\s\S]*?)\]\]><\/wp:meta_value>[\s\S]*?<\/wp:postmeta>/gi;
  let m;
  while ((m = re.exec(block))) {
    meta[m[1]] = m[2];
  }
  return meta;
}

function getCategories(block) {
  const cats = [];
  const re = /<category domain="category" nicename="([^"]*)"><!\[CDATA\[([\s\S]*?)\]\]><\/category>/gi;
  let m;
  while ((m = re.exec(block))) cats.push({ nicename: m[1], name: m[2].trim() });
  return cats;
}

function getTags(block) {
  const tags = [];
  const re = /<category domain="post_tag" nicename="([^"]*)"><!\[CDATA\[([\s\S]*?)\]\]><\/category>/gi;
  let m;
  while ((m = re.exec(block))) tags.push({ nicename: m[1], name: m[2].trim() });
  return tags;
}

function yamlString(value) {
  if (value == null || value === '') return '""';
  const str = String(value);
  if (/[:#\[\]{}|>&*!?,]/.test(str) || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  }
  return `"${str}"`;
}

function yamlArray(arr) {
  if (!arr?.length) return '[]';
  return `[${arr.map((v) => yamlString(v)).join(', ')}]`;
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function wpUrlToLocalPath(url) {
  if (!url) return null;
  const normalized = url.replace(/&amp;/g, '&').split('?')[0];
  if (!normalized.includes('/wp-content/uploads/')) return null;
  const rel = normalized.split('/wp-content/uploads/')[1];
  if (!rel) return null;
  return { rel, local: `/images/wp/${rel}`, disk: path.join(PUBLIC_WP, rel) };
}

const downloaded = new Map();

async function downloadImage(url) {
  const mapped = wpUrlToLocalPath(url);
  if (!mapped) return url;

  if (downloaded.has(mapped.local)) return mapped.local;

  ensureDir(path.dirname(mapped.disk));

  if (fs.existsSync(mapped.disk) && fs.statSync(mapped.disk).size > 0) {
    downloaded.set(mapped.local, true);
    return mapped.local;
  }

  try {
    const res = await fetch(normalizedUrl(url), { redirect: 'follow' });
    if (!res.ok) {
      console.warn(`  ⚠ Failed to download (${res.status}): ${url}`);
      return FALLBACK_IMAGE;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(mapped.disk, buf);
    downloaded.set(mapped.local, true);
    return mapped.local;
  } catch (err) {
    console.warn(`  ⚠ Download error: ${url}`, err.message);
    return FALLBACK_IMAGE;
  }
}

function normalizedUrl(url) {
  return url.replace(/&amp;/g, '&');
}

async function replaceContentImages(html) {
  if (!html) return '';

  let result = html.replace(/&amp;/g, '&');

  const srcRe = /src=["'](https?:\/\/[^"']+\/wp-content\/uploads\/[^"']+)["']/gi;
  const urls = [...result.matchAll(srcRe)].map((m) => m[1]);

  for (const url of [...new Set(urls)]) {
    const local = await downloadImage(url);
    result = result.split(url).join(local);
  }

  // Replace internal nerdplaza.nl links to relative paths
  result = result.replace(/https?:\/\/nerdplaza\.nl\//gi, '/');
  result = result.replace(/href="\/\/nerdplaza\.nl\//gi, 'href="/');

  return result;
}

function parseAuthors(xml) {
  const authors = {};
  const re =
    /<wp:author>[\s\S]*?<wp:author_login><!\[CDATA\[([\s\S]*?)\]\]><\/wp:author_login>[\s\S]*?<wp:author_display_name><!\[CDATA\[([\s\S]*?)\]\]><\/wp:author_display_name>[\s\S]*?<wp:author_email><!\[CDATA\[([\s\S]*?)\]\]><\/wp:author_email>/gi;
  let m;
  while ((m = re.exec(xml))) {
    authors[m[1]] = { login: m[1], name: m[2], email: m[3] };
  }
  return authors;
}

function parseTaxonomies(xml) {
  const categories = [];
  const catRe =
    /<wp:category>[\s\S]*?<wp:term_id>(\d+)<\/wp:term_id>[\s\S]*?<wp:category_nicename><!\[CDATA\[([\s\S]*?)\]\]><\/wp:category_nicename>[\s\S]*?<wp:cat_name><!\[CDATA\[([\s\S]*?)\]\]><\/wp:cat_name>/gi;
  let m;
  while ((m = catRe.exec(xml))) {
    categories.push({ id: m[1], slug: m[2], name: m[3] });
  }
  return categories;
}

function parseNavMenu(xml, postsById) {
  const items = [];
  const itemBlocks = xml.split(/\s*<item>/).slice(1);

  for (const block of itemBlocks) {
    if (getCdata(block, 'wp:post_type') !== 'nav_menu_item') continue;
    if (getCdata(block, 'wp:status') !== 'publish') continue;

    const meta = getAllMeta(block);
    const objectId = meta['_menu_item_object_id'];
    const object = meta['_menu_item_object'];
    const type = meta['_menu_item_type'];
    const url = meta['_menu_item_url'];
    const parentId = meta['_menu_item_menu_item_parent'] || '0';
    const order = parseInt(getCdata(block, 'wp:menu_order') || '0', 10);
    const postId = getCdata(block, 'wp:post_id');

    let label = getCdata(block, 'title');
    let href = url || '#';

    if (type === 'post_type' && objectId && postsById[objectId]) {
      const target = postsById[objectId];
      label = target.title || label;
      href = `/${target.slug}/`;
    } else if (type === 'custom' && url) {
      href = url.replace('https://nerdplaza.nl', '').replace(/\/$/, '') + '/';
      if (href === '//') href = '/';
    }

    items.push({ postId, parentId, order, label, href, type, object });
  }

  items.sort((a, b) => a.order - b.order);

  const byId = Object.fromEntries(items.map((i) => [i.postId, { ...i, children: [] }]));
  const roots = [];

  for (const item of items) {
    const node = byId[item.postId];
    if (item.parentId === '0' || !byId[item.parentId]) {
      roots.push(node);
    } else {
      byId[item.parentId].children.push(node);
    }
  }

  return roots;
}

async function main() {
  console.log('Reading WordPress export...');
  const xml = fs.readFileSync(XML_PATH, 'utf8');
  const authors = parseAuthors(xml);
  const wpCategories = parseTaxonomies(xml);

  ensureDir(BLOG_DIR);
  ensureDir(PAGES_DIR);
  ensureDir(AUTHORS_DIR);
  ensureDir(CATEGORIES_DIR);
  ensureDir(TAGS_DIR);
  ensureDir(PUBLIC_WP);

  // Clear old generated blog mdx (keep nothing from manual data)
  for (const f of fs.readdirSync(BLOG_DIR)) {
    if (f.endsWith('.mdx') || f.endsWith('.md')) fs.unlinkSync(path.join(BLOG_DIR, f));
  }
  for (const f of fs.readdirSync(PAGES_DIR)) {
    if (f.endsWith('.mdx') || f.endsWith('.md')) fs.unlinkSync(path.join(PAGES_DIR, f));
  }

  const items = xml.split(/\s*<item>/).slice(1);
  const attachments = new Map();
  const postsById = {};
  const posts = [];
  const pages = [];
  const allTags = new Map();

  // First pass: attachments
  for (const item of items) {
    const postType = getCdata(item, 'wp:post_type');
    const postId = getCdata(item, 'wp:post_id');
    if (postType !== 'attachment') continue;

    const meta = getAllMeta(item);
    const url =
      getCdata(item, 'wp:attachment_url') ||
      getCdata(item, 'guid') ||
      '';
    attachments.set(postId, {
      url,
      alt: meta['_wp_attachment_image_alt'] || getCdata(item, 'title'),
      title: getCdata(item, 'title'),
    });
  }

  console.log(`Found ${attachments.size} attachments`);

  // Second pass: posts and pages
  for (const item of items) {
    const postType = getCdata(item, 'wp:post_type');
    const status = getCdata(item, 'wp:status');
    const postId = getCdata(item, 'wp:post_id');
    if (!['post', 'page'].includes(postType)) continue;

    const slug = getCdata(item, 'wp:post_name');
    const title = getCdata(item, 'title');
    const entry = {
      id: postId,
      title,
      slug,
      link: getCdata(item, 'link'),
      content: getCdata(item, 'content:encoded'),
      excerpt: getCdata(item, 'excerpt:encoded'),
      pubDate: getCdata(item, 'wp:post_date'),
      modified: getCdata(item, 'wp:post_modified'),
      author: getCdata(item, 'dc:creator'),
      authorName: authors[getCdata(item, 'dc:creator')]?.name || getCdata(item, 'dc:creator'),
      categories: getCategories(item).map((c) => c.name),
      categorySlugs: getCategories(item).map((c) => c.nicename),
      tags: getTags(item).map((t) => t.name),
      tagSlugs: getTags(item).map((t) => t.nicename),
      meta: getAllMeta(item),
      status,
      postType,
    };

    postsById[postId] = entry;

    for (const tag of getTags(item)) {
      allTags.set(tag.nicename, tag.name);
    }

    if (status === 'publish') {
      if (postType === 'post') posts.push(entry);
      if (postType === 'page') pages.push(entry);
    }
  }

  console.log(`Migrating ${posts.length} posts and ${pages.length} pages...`);

  // Download featured images for all attachments referenced
  for (const [, att] of attachments) {
    if (att.url) await downloadImage(att.url);
  }

  // Write authors
  for (const [login, author] of Object.entries(authors)) {
    fs.writeFileSync(
      path.join(AUTHORS_DIR, `${login}.json`),
      JSON.stringify({ slug: login, name: author.name, email: author.email }, null, 2),
    );
  }

  // Write categories
  for (const cat of wpCategories) {
    fs.writeFileSync(
      path.join(CATEGORIES_DIR, `${cat.slug}.json`),
      JSON.stringify({ slug: cat.slug, name: cat.name, id: cat.id }, null, 2),
    );
  }

  // Write tags
  for (const [slug, name] of allTags) {
    fs.writeFileSync(path.join(TAGS_DIR, `${slug}.json`), JSON.stringify({ slug, name }, null, 2));
  }

  // Migrate blog posts to MDX
  for (const post of posts) {
    if (!post.slug) {
      console.warn(`Skipping post without slug: ${post.title}`);
      continue;
    }

    let featuredImage = FALLBACK_IMAGE;
    let imageAlt = post.title;

    const thumbId = post.meta['_thumbnail_id'];
    if (thumbId && attachments.has(thumbId)) {
      const att = attachments.get(thumbId);
      if (att.url) {
        featuredImage = await downloadImage(att.url);
        imageAlt = att.alt || att.title || post.title;
      }
    }

    const description =
      stripHtml(post.excerpt) ||
      stripHtml(post.content).slice(0, 280) ||
      post.title;

    const body = await replaceContentImages(post.content);

    const frontmatter = `---
title: ${yamlString(post.title)}
description: ${yamlString(description)}
pubDate: ${yamlString(new Date(post.pubDate).toISOString())}
updatedDate: ${yamlString(new Date(post.modified).toISOString())}
author: ${yamlString(post.authorName)}
categories: ${yamlArray(post.categories)}
tags: ${yamlArray(post.tags)}
featuredImage: ${yamlString(featuredImage)}
imageAlt: ${yamlString(imageAlt)}
---

`;

    const filename = `${post.slug}.md`;
    fs.writeFileSync(path.join(BLOG_DIR, filename), frontmatter + (body || `<p>${description}</p>\n`));
    console.log(`  ✓ blog/${filename}`);
  }

  // Migrate pages (skip home/contact/blog - handled by Astro pages)
  const skipPages = new Set(['home', 'contact', '']);
  for (const page of pages) {
    if (!page.slug || skipPages.has(page.slug)) continue;

    const body = await replaceContentImages(page.content);
    const description = stripHtml(page.excerpt) || stripHtml(page.content).slice(0, 280) || page.title;

    let featuredImage = '';
    const thumbId = page.meta['_thumbnail_id'];
    if (thumbId && attachments.has(thumbId)) {
      const att = attachments.get(thumbId);
      if (att.url) featuredImage = await downloadImage(att.url);
    }

    const frontmatter = `---
title: ${yamlString(page.title)}
description: ${yamlString(description)}
pubDate: ${yamlString(new Date(page.pubDate).toISOString())}
updatedDate: ${yamlString(new Date(page.modified).toISOString())}
author: ${yamlString(page.authorName)}
featuredImage: ${yamlString(featuredImage)}
---

`;

    fs.writeFileSync(path.join(PAGES_DIR, `${page.slug}.md`), frontmatter + (body || `<p>${description}</p>\n`));
    console.log(`  ✓ pages/${page.slug}.mdx`);
  }

  // Navigation
  const navigation = parseNavMenu(xml, postsById);
  fs.writeFileSync(
    path.join(ROOT, 'src/data/navigation.migrated.json'),
    JSON.stringify(navigation, null, 2),
  );

  // Migration manifest
  fs.writeFileSync(
    path.join(ROOT, 'src/data/migration-manifest.json'),
    JSON.stringify(
      {
        migratedAt: new Date().toISOString(),
        posts: posts.length,
        pages: pages.length,
        attachments: attachments.size,
        imagesDownloaded: downloaded.size,
        authors: Object.keys(authors).length,
        categories: wpCategories.length,
        tags: allTags.size,
      },
      null,
      2,
    ),
  );

  console.log(`\nDone! ${downloaded.size} images stored locally.`);
  console.log(`Navigation exported to src/data/navigation.migrated.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
