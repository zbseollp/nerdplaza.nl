import { getCollection, type CollectionEntry } from 'astro:content';
import { resolveFeaturedImage, resolveFeaturedImageAlt } from './blogImages';
import { isSpamBlogPost } from './spam-blog.mjs';

export type BlogPost = CollectionEntry<'blog'>;

/** Payload writes `draft` as a boolean or as the string "true". */
function isDraft(data: BlogPost['data']): boolean {
  const value = (data as Record<string, unknown>).draft;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return false;
}

function isUnpublished(data: BlogPost['data']): boolean {
  const status = (data as Record<string, unknown>)._status;
  if (typeof status !== 'string' || !status.trim()) return false;
  return status.trim().toLowerCase() !== 'published';
}

/** Newest of the dates a post carries — Payload is inconsistent about which it sets. */
export function postDate(post: BlogPost): Date {
  const { pubDate, date, updatedDate } = post.data as Record<string, unknown>;
  const candidates = [pubDate, date, updatedDate]
    .map((value) => (value instanceof Date ? value : value ? new Date(value as string) : null))
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.valueOf()));
  if (!candidates.length) return new Date(0);
  return candidates.reduce((a, b) => (a.valueOf() >= b.valueOf() ? a : b));
}

/** The date shown to readers: publication, not last edit. */
export function postPubDate(post: BlogPost): Date {
  const { pubDate, date, updatedDate } = post.data as Record<string, unknown>;
  for (const value of [pubDate, date, updatedDate]) {
    const parsed = value instanceof Date ? value : value ? new Date(value as string) : null;
    if (parsed instanceof Date && !Number.isNaN(parsed.valueOf())) return parsed;
  }
  return new Date(0);
}

export function postUrl(post: BlogPost): string {
  return `/${post.id}/`;
}

/** Card / og:image. Falls back to the first image in the body. */
export function postImage(post: BlogPost): string {
  return resolveFeaturedImage(post.data as Record<string, unknown>, post.body);
}

/**
 * Article hero. Frontmatter only — falling back to the first body image would
 * render it twice on the detail page.
 */
export function postHeroImage(post: BlogPost): string {
  return resolveFeaturedImage(post.data as Record<string, unknown>);
}

export function postImageAlt(post: BlogPost): string {
  return resolveFeaturedImageAlt(post.data as Record<string, unknown>, post.data.title);
}

export function postDescription(post: BlogPost): string {
  const data = post.data as Record<string, unknown>;
  for (const key of ['description', 'excerpt', 'metaDescription', 'summary']) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/**
 * The single source of truth for which posts are online.
 * Every listing, route and card must go through this — a weaker filter
 * elsewhere is how drafts and spam leak onto the site.
 */
export async function getAllPosts(): Promise<BlogPost[]> {
  const now = Date.now();
  const posts = await getCollection('blog', ({ data, id, body }) => {
    if (isDraft(data)) return false;
    if (isUnpublished(data)) return false;
    if (isSpamBlogPost(id, body ?? '', data.title ?? '')) return false;
    return true;
  });

  return posts
    .filter((post) => postPubDate(post).valueOf() <= now)
    .sort((a, b) => postDate(b).valueOf() - postDate(a).valueOf());
}

/** Newest posts excluding the one being viewed. */
export async function getRelatedPosts(currentId: string | undefined, limit = 6): Promise<BlogPost[]> {
  const posts = await getAllPosts();
  return posts.filter((post) => post.id !== currentId).slice(0, limit);
}
