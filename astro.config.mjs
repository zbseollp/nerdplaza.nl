// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://nerdplaza.nl',
  compressHTML: true,
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
  },
});
