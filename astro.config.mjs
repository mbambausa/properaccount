// astro.config.mjs
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import alpinejs from "@astrojs/alpinejs";
import UnoCSS from "unocss/astro";

// https://astro.build/config
export default defineConfig({
  output: "server", // Correct for SSR and dynamic features
  adapter: cloudflare({
    mode: "directory", // Standard for Cloudflare Pages
    functionPerRoute: false, // Single function for all routes, good for simplicity
    runtime: {
      mode: "local", // For `wrangler pages dev` compatibility
      type: "pages", // Explicitly set type for clarity, though often inferred
      persistTo: "./.wrangler/state/v3/pages", // Explicit persistence path for local dev
    },
    // Custom session management is planned via `src/lib/auth/session.ts`
    // Astro's built-in sessions with KV are correctly commented out.
    // sessions: {
    //   enabled: true,
    //   kvBinding: "SESSION_KV",
    //   secret: process.env.SESSION_SECRET
    // }
  }),
  integrations: [
    // Entrypoint for Alpine.js is crucial for Astro's View Transitions
    // Ensure 'src/scripts/alpine-setup.js' exists and is correctly configured.
    alpinejs({ entrypoint: '/src/scripts/alpine-setup.js' }),
    UnoCSS({
      injectReset: "@unocss/reset/tailwind.css", // Using a specific reset like Tailwind's is common
    }),
  ],
  vite: {
    build: {
      sourcemap: true, // Good for debugging
    },
    ssr: {
      // Keep `noExternal` empty unless specific packages cause issues in Workers runtime.
      noExternal: []
    },
    // Explicitly define `resolve.conditions` for Cloudflare Workers environment
    resolve: {
      conditions: ["worker", "browser"],
    },
  },
  // `image.service` for `noop` is correctly commented.
  // Activate if using <Image /> or getImage() and not processing on Cloudflare.
  // image: {
  //   service: {
  //     entrypoint: "astro/assets/services/noop"
  //   }
  // }
});