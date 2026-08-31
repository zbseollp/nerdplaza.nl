import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const configUrl = new URL('../astropayload.config.json', import.meta.url);
const config = JSON.parse(readFileSync(configUrl, 'utf8'));

export const BLOG_DIR = fileURLToPath(
  new URL(`../${config.blogContentPath ?? 'src/content/blog'}/`, import.meta.url),
);

export const TENANT_SLUG = config.tenantSlug ?? 'nerdplaza';

/** Every markdown file in the blog directory, recursively. */
export function listBlogFiles(dir = BLOG_DIR) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listBlogFiles(full));
    } else if (/\.mdx?$/i.test(entry)) {
      files.push(full);
    }
  }
  return files.sort();
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function splitFrontmatter(raw) {
  const match = raw.match(FRONTMATTER);
  if (!match) return { frontmatter: '', body: raw, hasFrontmatter: false };
  return { frontmatter: match[1], body: match[2], hasFrontmatter: true };
}

export function joinFrontmatter(frontmatter, body) {
  return `---\n${frontmatter}\n---\n\n${body.replace(/^\n+/, '')}`;
}

/** Minimal scalar lookup — enough for title/date checks, not a YAML parser. */
export function frontmatterValue(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}\\s*:\\s*(.*)$`, 'm'));
  if (!match) return '';
  return match[1].trim().replace(/^["']|["']$/g, '').trim();
}

export function slugOf(file) {
  return file.slice(BLOG_DIR.length).replace(/\.mdx?$/i, '');
}
