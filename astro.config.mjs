// @ts-check
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { satteriRepairMediaUrls } from './src/lib/repair-media-urls.mjs';

export default defineConfig({
  site: 'https://nerdplaza.nl',
  compressHTML: true,
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
  },
  markdown: {
    // Astro 7's default processor, extended with the media-URL repair pass so
    // Payload's /media/… references resolve to R2 in rendered post bodies.
    processor: satteri({
      hastPlugins: [satteriRepairMediaUrls],
    }),
  },
  vite: {
    envPrefix: ['PUBLIC_', 'R2_', 'TENANT', 'PAYLOAD_'],
  },
});
