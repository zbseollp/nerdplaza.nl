#!/usr/bin/env node
/**
 * Strip injected markup from blog bodies without touching legitimate content.
 * Only removes things that can never belong in an article.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { listBlogFiles, splitFrontmatter, joinFrontmatter } from './blog-files.mjs';

const dryRun = process.argv.includes('--dry-run');

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

  let cleaned = body;
  const applied = [];
  for (const [pattern, replacement, label] of RULES) {
    if (pattern.test(cleaned)) {
      applied.push(label);
      cleaned = cleaned.replace(pattern, replacement);
    }
    pattern.lastIndex = 0;
  }

  if (!applied.length) continue;
  changedCount += 1;
  console.log(`[sanitize-blog] ${relative(process.cwd(), file)}: ${applied.join(', ')}`);
  if (!dryRun) writeFileSync(file, joinFrontmatter(frontmatter, cleaned), 'utf8');
}

console.log(
  changedCount === 0
    ? '[sanitize-blog] nothing to sanitize'
    : `[sanitize-blog] ${dryRun ? 'would clean' : 'cleaned'} ${changedCount} file(s)`,
);
