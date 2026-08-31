#!/usr/bin/env node
/**
 * Fail the build on frontmatter that would silently drop a post:
 * a missing title, or no usable date at all.
 * Missing description / image are warnings — they degrade, they do not break.
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { listBlogFiles, splitFrontmatter, frontmatterValue } from './blog-files.mjs';

const errors = [];
const warnings = [];
const files = listBlogFiles();

for (const file of files) {
  const rel = relative(process.cwd(), file);
  const raw = readFileSync(file, 'utf8');
  const { frontmatter, body, hasFrontmatter } = splitFrontmatter(raw);

  if (!hasFrontmatter) {
    errors.push(`${rel}: missing frontmatter block`);
    continue;
  }

  if (!frontmatterValue(frontmatter, 'title')) errors.push(`${rel}: missing title`);

  const date =
    frontmatterValue(frontmatter, 'pubDate') ||
    frontmatterValue(frontmatter, 'date') ||
    frontmatterValue(frontmatter, 'publishedAt') ||
    frontmatterValue(frontmatter, 'updatedDate');
  if (!date) {
    errors.push(`${rel}: no pubDate/date/publishedAt/updatedDate`);
  } else if (Number.isNaN(new Date(date).valueOf())) {
    errors.push(`${rel}: unparseable date "${date}"`);
  }

  const description =
    frontmatterValue(frontmatter, 'description') ||
    frontmatterValue(frontmatter, 'excerpt') ||
    frontmatterValue(frontmatter, 'metaDescription');
  if (!description) warnings.push(`${rel}: no description/excerpt/metaDescription`);

  if (!body.trim()) warnings.push(`${rel}: empty body`);
}

for (const warning of warnings) console.warn(`[validate-blog] warn  ${warning}`);

if (errors.length) {
  for (const error of errors) console.error(`[validate-blog] ERROR ${error}`);
  console.error(`[validate-blog] ${errors.length} error(s) in ${files.length} post(s)`);
  process.exit(1);
}

console.log(`[validate-blog] ${files.length} post(s) OK${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
