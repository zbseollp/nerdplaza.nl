#!/usr/bin/env node
/**
 * Payload sync only writes published posts, but merge can leave WP leftovers
 * (`draft: true`, `_status: private`) in frontmatter. Those make getAllPosts()
 * hide the article even though it was published in the CMS.
 *
 * Strip those keys before validate/build so synced posts always ship.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { listBlogFiles, splitFrontmatter, joinFrontmatter } from './blog-files.mjs';

const dryRun = process.argv.includes('--dry-run');
const DROP_LINE = /^(draft|_status|status)\s*:.*$/gm;

let changed = 0;

for (const file of listBlogFiles()) {
  const raw = readFileSync(file, 'utf8');
  const { frontmatter, body, hasFrontmatter } = splitFrontmatter(raw);
  if (!hasFrontmatter) continue;
  if (!DROP_LINE.test(frontmatter)) continue;
  DROP_LINE.lastIndex = 0;

  const cleaned = frontmatter
    .replace(DROP_LINE, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '');
  DROP_LINE.lastIndex = 0;

  if (cleaned === frontmatter) continue;
  changed += 1;
  console.log(`[strip-publish-flags] ${relative(process.cwd(), file)}`);
  if (!dryRun) writeFileSync(file, joinFrontmatter(cleaned, body), 'utf8');
}

console.log(
  changed === 0
    ? '[strip-publish-flags] nothing to strip'
    : `[strip-publish-flags] ${dryRun ? 'would strip' : 'stripped'} ${changed} file(s)`,
);
