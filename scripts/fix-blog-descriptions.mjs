#!/usr/bin/env node
/**
 * Repair blog descriptions polluted by the WordPress migration.
 *
 * Some posts had an Elementor <style> block at the top of the body, so the
 * generated excerpt is a wall of CSS. That excerpt now feeds <meta description>,
 * og:description and the BlogPosting JSON-LD, so it has to be cleaned.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { listBlogFiles, splitFrontmatter, joinFrontmatter, frontmatterValue } from './blog-files.mjs';

const dryRun = process.argv.includes('--dry-run');
const DESCRIPTION_KEYS = ['description', 'excerpt', 'metaDescription'];
const MIN_LENGTH = 60;
const TARGET_LENGTH = 200;

function stripCss(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/[.#][A-Za-z][\w-]*(?:[^{}]*)\{[^{}]*\}/g, ' ')
    .replace(/[A-Za-z-]+\s*:\s*[^;{}]+;/g, ' ');
}

function plainTextFromBody(body) {
  return body
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}

function cleanValue(value) {
  return stripCss(value).replace(/\s+/g, ' ').trim();
}

let changed = 0;

for (const file of listBlogFiles()) {
  const raw = readFileSync(file, 'utf8');
  const { frontmatter, body, hasFrontmatter } = splitFrontmatter(raw);
  if (!hasFrontmatter) continue;

  let nextFrontmatter = frontmatter;
  const fixed = [];

  for (const key of DESCRIPTION_KEYS) {
    const original = frontmatterValue(frontmatter, key);
    if (!original) continue;

    let cleaned = cleanValue(original);
    if (cleaned === original.replace(/\s+/g, ' ').trim()) continue;

    if (cleaned.length < MIN_LENGTH) {
      cleaned = truncate(plainTextFromBody(body), TARGET_LENGTH);
    } else {
      cleaned = truncate(cleaned, TARGET_LENGTH);
    }
    if (!cleaned) continue;

    nextFrontmatter = nextFrontmatter.replace(
      new RegExp(`^${key}\\s*:.*$`, 'm'),
      `${key}: ${JSON.stringify(cleaned)}`,
    );
    fixed.push(key);
  }

  if (!fixed.length) continue;
  changed += 1;
  console.log(`[fix-blog-descriptions] ${relative(process.cwd(), file)}: ${fixed.join(', ')}`);
  if (!dryRun) writeFileSync(file, joinFrontmatter(nextFrontmatter, body), 'utf8');
}

console.log(
  changed === 0
    ? '[fix-blog-descriptions] nothing to fix'
    : `[fix-blog-descriptions] ${dryRun ? 'would fix' : 'fixed'} ${changed} file(s)`,
);
