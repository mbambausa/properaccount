// astro.config.mjs
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import alpinejs from "@astrojs/alpinejs";
import UnoCSS from "unocss/astro";

// https://astro.build/config
export default defineConfig({
  output: "server", // Necessary for SSR and API endpoints [cite: 175, 986]
  adapter: cloudflare({
    mode: "directory", // Recommended for Cloudflare Pages [cite: 12]
    functionPerRoute: false, // Generally a good default to reduce function counts
    runtime: {
      // Local development runtime settings for wrangler [cite: 12]
      mode: "local", // Uses Miniflare for local development
      persistToStorage: true, // Persists D1, KV, R2 data locally during dev
    },
  }),
  integrations: [
    alpinejs(), // For lightweight client-side interactivity [cite: 1002, 1149]
    UnoCSS({
      // For atomic CSS styling [cite: 1165]
      injectReset: true, // Applies a CSS reset like Tailwind's preflight [cite: 1165]
    }),
  ],
  vite: {
    build: {
      sourcemap: true, // Enables sourcemaps for easier debugging
    },
    ssr: {
      // Ensure decimal.js is bundled with the server output,
      // as it's crucial for financial calculations [cite: 1077, 1110]
      noExternal: ["decimal.js"],
    },
  },
});
