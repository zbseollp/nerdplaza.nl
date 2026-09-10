#!/usr/bin/env node
/**
 * Strip injected markup from blog bodies, and blank featured-image fields that
 * are not images (Payload sometimes stores a webpage URL there, which renders
 * as a broken <img> on every card).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { listBlogFiles, splitFrontmatter, joinFrontmatter } from './blog-files.mjs';
import { resolveMediaUrl } from '../src/lib/media-url.mjs';

const dryRun = process.argv.includes('--dry-run');
const IMAGE_FIELDS = ['featuredImage', 'heroImage', 'image', 'ogImage', 'coverImage', 'thumbnail'];

function looksLikeImage(value) {
  if (!value) return false;
  if (value.startsWith('data:image/')) return true;
  if (/^\/(?:media|api\/media)\//i.test(value)) return true;
  if (/r2\.dev|cloudflarestorage\.com/i.test(value)) return true;
  const path = value.split(/[?#]/)[0];
  if (/^\/(?:images|assets|wp-content|uploads)\//i.test(path)) return true;
  return /\.(?:jpe?g|png|gif|webp|avif|svg|bmp|tiff?|ico)$/i.test(path);
}

/** [pattern, replacement, label] */
const RULES = [
  [/<script\b[^>]*>[\s\S]*?<\/script>/gi, '', 'inline <script>'],
  [/<script\b[^>]*\/?>/gi, '', 'stray <script>'],
  [/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '', '<noscript>'],
  [/<iframe\b[^>]*\bsrc\s*=\s*["']https?:\/\/(?!(?:www\.)?(?:youtube|youtube-nocookie|vimeo|google|spotify|open\.spotify)\.)[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi, '', 'third-party <iframe>'],
  // Match a single <style> block (no intervening </style>) that mentions elementor,
  // so a preceding unrelated block is never swallowed along with the content between.
  [/<style\b[^>]*>(?:(?!<\/style>)[\s\S])*?elementor(?:(?!<\/style>)[\s\S])*?<\/style>/gi, '', 'Elementor <style>'],
  [/^\s*document\s*\.\s*write\s*\([\s\S]*?\)\s*;?\s*$/gim, '', 'document.write'],
  [/\son(?:error|load|click|mouseover)\s*=\s*(["'])[\s\S]*?\1/gi, '', 'inline event handler'],
  [/\shref\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, ' href="#"', 'javascript: href'],
];

let changedCount = 0;

for (const file of listBlogFiles()) {
  const raw = readFileSync(file, 'utf8');
  const { frontmatter, body, hasFrontmatter } = splitFrontmatter(raw);
  if (!hasFrontmatter) continue;

  let nextFrontmatter = frontmatter;
  const imageFixes = [];
  for (const field of IMAGE_FIELDS) {
    nextFrontmatter = nextFrontmatter.replace(
      new RegExp(`^(${field}:[ \\t]*)([^\\n]*)(\\n|$)([ \\t]+\\S)?`, 'gm'),
      (match, head, rawValue, newline, nextIndented) => {
        const value = rawValue.trim();
        if (!value && nextIndented) return match;
        const unquoted = value.replace(/^["']|["']$/g, '');
        if (!unquoted) return match;
        const resolved = resolveMediaUrl(unquoted);
        if (resolved && looksLikeImage(resolved)) {
          if (resolved === unquoted) return match;
          imageFixes.push(field);
          return `${head}"${resolved}"${newline}${nextIndented ?? ''}`;
        }
        imageFixes.push(field);
        return `${head}""${newline}${nextIndented ?? ''}`;
      },
    );
  }

  let cleaned = body;
  const applied = [];
  for (const [pattern, replacement, label] of RULES) {
    if (pattern.test(cleaned)) {
      applied.push(label);
      cleaned = cleaned.replace(pattern, replacement);
    }
    pattern.lastIndex = 0;
  }

  if (!applied.length && !imageFixes.length) continue;
  changedCount += 1;
  const labels = [...applied, ...imageFixes.map((f) => `${f} not an image`)];
  console.log(`[sanitize-blog] ${relative(process.cwd(), file)}: ${labels.join(', ')}`);
  if (!dryRun) writeFileSync(file, joinFrontmatter(nextFrontmatter, cleaned), 'utf8');
}

console.log(
  changedCount === 0
    ? '[sanitize-blog] nothing to sanitize'
    : `[sanitize-blog] ${dryRun ? 'would clean' : 'cleaned'} ${changedCount} file(s)`,
);
