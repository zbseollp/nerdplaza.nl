#!/usr/bin/env node
/**
 * Fail the build if prepare:blog left too few posts (Payload sync wipe / spam wipe).
 * Keeps the last good deploy online instead of shipping an empty blog.
 */
import { listBlogFiles } from './blog-files.mjs';

const MIN = Number(process.env.BLOG_MIN_COUNT || 10);
const count = listBlogFiles().length;

if (count < MIN) {
  console.error(
    `[assert-blog-min] only ${count} blog file(s) (min ${MIN}). Refusing to build — likely a sync wipe.`,
  );
  process.exit(1);
}

console.log(`[assert-blog-min] ${count} blog file(s) (min ${MIN}) OK`);
