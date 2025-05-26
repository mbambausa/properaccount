// astro.config.mjs
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import alpinejs from "@astrojs/alpinejs";
import UnoCSS from "unocss/astro";
import { fileURLToPath } from 'url';

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: cloudflare({
    mode: "directory",
    functionPerRoute: false,
    runtime: {
      mode: "local",
      type: "pages",
      persistTo: "./.wrangler/state/v3/pages",
    },
  }),
  integrations: [
    alpinejs({ entrypoint: '/scripts/alpine-setup.js' }), // Path confirmed by you
    UnoCSS({
      injectReset: "@unocss/reset/tailwind.css",
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
    assets: 'chunks'
  },
  vite: {
    build: {
      sourcemap: true,
      rollupOptions: {
        external: ['@node-rs/argon2'],
        output: {
          manualChunks: {
            'vendor-core': ['decimal.js', 'zod', 'drizzle-orm'],
            'vendor-auth': ['@auth/core', '@auth/d1-adapter', 'csrf-csrf'],
            'vendor-charts': ['d3'],
            'vendor-excel': ['exceljs'], // xlsx removed
            'vendor-pdf': ['tesseract.js'],
            'vendor-parse': ['papaparse', 'mathjs'],
            'vendor-ui': ['alpinejs', '@alpinejs/collapse', '@alpinejs/intersect', 'htmx.org']
          }
        }
      }
    },
    optimizeDeps: {
      include: ['decimal.js', 'papaparse', 'exceljs', 'zod', 'drizzle-orm'] // xlsx removed, exceljs added
    },
    ssr: {
      noExternal: ['@auth/core', '@auth/d1-adapter']
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
        '@layouts': fileURLToPath(new URL('./src/components/layout', import.meta.url)),
        '@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
        '@assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
        '@styles': fileURLToPath(new URL('./src/styles', import.meta.url)),
        '@types': fileURLToPath(new URL('./src/types', import.meta.url)),
        '@content': fileURLToPath(new URL('./src/content', import.meta.url)),
        '@db': fileURLToPath(new URL('./cloudflare/d1', import.meta.url))
      },
      conditions: ["worker", "browser"],
    },
    worker: {
      format: 'es',
    }
  }
});