// astro.config.mjs
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import alpinejs from "@astrojs/alpinejs";
import UnoCSS from "unocss/astro";

// https://astro.build/config
export default defineConfig({
  // Render output as server-side, which is necessary for dynamic features
  // and integrations like Auth.js[cite: 625, 1557].
  output: "server",
  adapter: cloudflare({
    mode: "directory", // Standard mode for Cloudflare Pages deployments.
    functionPerRoute: false, // A single function for all routes is often simpler to manage initially.
    runtime: {
      mode: "local", // For `wrangler pages dev`
      persistToStorage: true, // Good for local simulation of KV, D1, R2.
    },
    // The project plan indicates use of a custom KV-based session
    // management via `src/lib/auth/session.ts`[cite: 7, 1487, 1533], rather than this adapter's built-in sessions.
    // Thus, keeping this commented out is correct.
    // Ensure your `SESSION_KV` binding is correctly configured in `wrangler.toml` and development scripts.
    // sessions: {
    //   enabled: true,
    //   kvBinding: "SESSION_KV", // Ensure this matches your wrangler.toml if you were to use it
    //   secret: process.env.SESSION_SECRET // Ensure this is a strong, unique secret in your .env
    // }
  }),
  integrations: [
    // If using Astro's View Transitions, a custom entrypoint for Alpine.js
    // helps maintain state, as documented in "Alpinejs and UnoCSS.pdf" (Page 2)[cite: 569].
    // Your `src/scripts/alpine-setup.js` file is suitable for this.
    alpinejs({ entrypoint: '/src/scripts/alpine-setup.js' }),
    UnoCSS({
      injectReset: true, // Applies a CSS reset for consistent styling[cite: 584].
    }),
  ],
  vite: {
    build: {
      sourcemap: true, // Enables sourcemaps for easier debugging of built assets.
    },
    ssr: {
      // `noExternal: []` is a good default. If issues arise with packages not designed
      // for the Workers runtime, they might need to be added here to force bundling.
      noExternal: []
    },
  },
  // The no-op image service is correctly commented out.
  // Enable this if you use Astro's <Image /> component or getImage() for runtime image processing
  // on Cloudflare, as Cloudflare Workers do not support the default Squoosh/Sharp services.
  // image: {
  //   service: {
  //     entrypoint: "astro/assets/services/noop"
  //   }
  // }
});