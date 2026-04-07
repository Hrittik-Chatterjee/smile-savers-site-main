// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import partytown from '@astrojs/partytown';
import robotsTxt from 'astro-robots-txt';

// https://astro.build/config
export default defineConfig({
  site: 'https://smilesavers.dental',
  output: 'static',

  integrations: [
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      customPages: ['https://smilesavers.dental/offline'],
      filter: (page) => !page.includes('/storyblok'),
    }),
    partytown({ config: { forward: ['dataLayer.push'] } }),
    robotsTxt({
      policy: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    }),
  ],

  // Prefetch on hover — improves navigation speed on Cloudflare CDN
  prefetch: {
    prefetchAll: false,           // Only prefetch on hover (saves bandwidth)
    defaultStrategy: 'hover',
  },

  // Image optimization — Astro sharp pipeline
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
    defaultFormat: 'webp',
    remotePatterns: [
      { protocol: 'https', hostname: '*.pexels.com' },
      { protocol: 'https', hostname: '*.unsplash.com' },
    ],
  },

  // Compress generated HTML
  compressHTML: true,

  // Vite build optimisations
  vite: {
    plugins: [/** @type {any} */ (tailwindcss())],
    build: {
      // Inline assets smaller than 4kb → fewer requests
      assetsInlineLimit: 4096,
      // Code splitting — separate vendor chunks
      rollupOptions: {
        output: {
          manualChunks: {
            // Astro transitions runtime in its own chunk
            'astro-transitions': ['astro:transitions'],
          },
        },
      },
      // Enable CSS minification
      cssMinify: true,
      // Enable JS minification with esbuild (default, explicit)
      minify: 'esbuild',
    },
    // Optimise deps during dev
    optimizeDeps: {
      include: ['clsx', 'tailwind-merge'],
    },
  },
});
