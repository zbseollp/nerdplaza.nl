/**
 * Fix WordPress HTML for MDX compatibility
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function fixBody(body) {
  let result = body;

  // Remove duplicate h1 (layout renders title)
  result = result.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '');

  // Collapse multiline heading tags
  result = result.replace(/<(h[2-6])([^>]*)>\s*([\s\S]*?)\s*<\/\1>/gi, (_, tag, attrs, text) => {
    const clean = text.replace(/\s+/g, ' ').trim();
    return `<${tag}${attrs}>${clean}</${tag}>`;
  });

  // Remove chat/scrape artifact wrappers
  result = result.replace(/<div class="flex max-w-full flex-col flex-grow">[\s\S]*?<div class="markdown prose[^"]*">([\s\S]*?)<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/gi, '$1');
  result = result.replace(/<div class="min-h-8 text-message[^"]*"[^>]*>/gi, '');
  result = result.replace(/<div class="flex w-full flex-col gap-1[^"]*"[^>]*>/gi, '');
  result = result.replace(/<div class="markdown prose[^"]*"[^>]*>/gi, '');
  result = result.replace(/<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/gi, '');

  // Strip inline styles from category link blocks (layout CSS handles it)
  result = result.replace(/<style[^>]*>[\s\S]*?zbmp-category-links[\s\S]*?<\/style>/gi, '');

  // Remove WordPress HTML comments
  result = result.replace(/<!--[\s\S]*?-->/g, '');

  // Fix remaining external wp-content srcset references
  result = result.replace(/\/wp-content\/uploads\//g, '/images/wp/');

  // Remove data-* attributes that break MDX parsing
  result = result.replace(/\sdata-[a-z-]+="[^"]*"/gi, '');

  // Remove aria-level attributes
  result = result.replace(/\saria-level="[^"]*"/gi, '');

  // Clean orphaned closing tags / whitespace-only lines
  result = result.replace(/^\s+Inhoud\s+$/gm, '');
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim() + '\n';
}

function processDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.mdx') && !file.endsWith('.md')) continue;
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const parts = content.split('---');
    if (parts.length < 3) continue;
    const frontmatter = parts.slice(0, 2).join('---') + '---';
    const body = parts.slice(2).join('---');
    fs.writeFileSync(filePath, frontmatter + '\n\n' + fixBody(body));
    console.log('Fixed', file);
  }
}

processDir(path.join(ROOT, 'src/content/blog'));
processDir(path.join(ROOT, 'src/content/pages'));
