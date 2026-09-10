#!/usr/bin/env node
/**
 * Delete injected spam and WordPress placeholder posts from the blog directory.
 * Runs before every dev/build. Editorial Payload posts (including casino/tech)
 * must stay — only unambiguous junk is removed.
 */
import { readFileSync, unlinkSync } from 'node:fs';
import { relative } from 'node:path';
import { isSpamBlogPost, spamReason } from '../src/lib/spam-blog.mjs';
import { listBlogFiles, splitFrontmatter, frontmatterValue, slugOf } from './blog-files.mjs';

const dryRun = process.argv.includes('--dry-run');
const removed = [];

for (const file of listBlogFiles()) {
  const raw = readFileSync(file, 'utf8');
  const { frontmatter, body } = splitFrontmatter(raw);
  const title = frontmatterValue(frontmatter, 'title');
  const slug = slugOf(file);

  if (!isSpamBlogPost(slug, body, title)) continue;

  removed.push({ file, reason: spamReason(slug, body, title), title });
  if (!dryRun) unlinkSync(file);
}

if (removed.length === 0) {
  console.log('[remove-spam-blog] no spam posts found');
} else {
  const verb = dryRun ? 'would remove' : 'removed';
  console.log(`[remove-spam-blog] ${verb} ${removed.length} post(s):`);
  for (const { file, reason, title } of removed) {
    console.log(`  - ${relative(process.cwd(), file)} (${reason}) — ${title}`);
  }
}
