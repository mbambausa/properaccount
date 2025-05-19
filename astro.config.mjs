// astro.config.mjs
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import alpinejs from "@astrojs/alpinejs";
import UnoCSS from "unocss/astro";

// https://astro.build/config
export default defineConfig({
  output: "server", // Necessary for SSR and API endpoints
  adapter: cloudflare({
    mode: "directory", // Recommended for Cloudflare Pages
    functionPerRoute: false, // Generally a good default to reduce function counts
    runtime: {
      // Local development runtime settings for wrangler
      mode: "local", // Uses Miniflare for local development
      persistToStorage: true, // Persists D1, KV, R2 data locally during dev
    },
  }),
  integrations: [
    alpinejs(), // For lightweight client-side interactivity
    UnoCSS({
      // For atomic CSS styling
      injectReset: true, // Applies a CSS reset like Tailwind's preflight
    }),
  ],
  vite: {
    build: {
      sourcemap: true, // Enables sourcemaps for easier debugging
    },
    ssr: {
      // Ensure decimal.js is bundled with the server output,
      // as it's crucial for financial calculations
      noExternal: ["decimal.js"],
    },
  },
});