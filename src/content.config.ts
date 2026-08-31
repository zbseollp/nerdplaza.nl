import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Payload writes `featuredImage` / `heroImage` as a plain path, an absolute URL
 * or a media object. A `z.string()`-only schema fails the whole build the moment
 * a media object is synced, so accept every shape and let
 * `src/lib/blogImages.ts` normalize it at render time.
 */
const imageField = z
  .union([
    z.string(),
    z
      .object({
        url: z.string().optional(),
        src: z.string().optional(),
        filename: z.string().optional(),
        alt: z.string().optional(),
      })
      .passthrough(),
  ])
  .optional();

/**
 * Payload dumps years as numbers into categories/tags, and sometimes writes a
 * single value where a list is expected. Accept both and coerce to strings.
 */
const flexibleStringList = z
  .union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    return (Array.isArray(value) ? value : [value]).map((item) => String(item));
  });

/** Boolean or the string "true" — Payload's YAML is inconsistent. */
const flexibleBoolean = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
    return undefined;
  });

const optionalDate = z.coerce.date().optional();

const blog = defineCollection({
  loader: glob({
    base: './src/content/blog',
    pattern: '**/*.{md,mdx}',
  }),
  schema: z
    .object({
      title: z.string(),
      slug: z.string().optional(),

      // Payload may set `date` instead of `pubDate`; both are optional here and
      // normalized below so a missing one never fails the build.
      pubDate: optionalDate,
      date: optionalDate,
      updatedDate: optionalDate,
      publishedAt: optionalDate,

      description: z.string().optional(),
      excerpt: z.string().optional(),
      metaDescription: z.string().optional(),

      author: z.string().optional(),
      categories: flexibleStringList,
      tags: flexibleStringList,

      draft: flexibleBoolean,
      _status: z.string().optional(),

      featuredImage: imageField,
      heroImage: imageField,
      image: imageField,
      featuredImageAlt: z.string().optional(),
      imageAlt: z.string().optional(),
    })
    .passthrough()
    .transform((data) => {
      const pubDate = data.pubDate ?? data.date ?? data.publishedAt ?? data.updatedDate ?? new Date(0);
      return {
        ...data,
        pubDate,
        date: data.date ?? pubDate,
        description: data.description ?? data.excerpt ?? data.metaDescription ?? '',
      };
    }),
});

const pages = defineCollection({
  loader: glob({
    base: './src/content/pages',
    pattern: '**/*.{md,mdx}',
  }),
  schema: z
    .object({
      title: z.string(),
      description: z.string().optional(),
      pubDate: optionalDate,
      date: optionalDate,
      updatedDate: optionalDate,
      author: z.string().optional(),
      featuredImage: imageField,
      heroImage: imageField,
      pageType: z.enum(['page', 'category', 'review', 'stream']).optional(),
    })
    .passthrough()
    .transform((data) => ({
      ...data,
      pubDate: data.pubDate ?? data.date ?? data.updatedDate ?? new Date(0),
      description: data.description ?? '',
    })),
});

export const collections = { blog, pages };
