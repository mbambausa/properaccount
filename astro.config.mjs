// astro.config.mjs
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import alpinejs from "@astrojs/alpinejs";
import UnoCSS from "unocss/astro";

// https://astro.build/config
export default defineConfig({
  output: "server", //
  adapter: cloudflare({ //
    mode: "directory", //
    functionPerRoute: false, //
    runtime: { //
      mode: "local", //
      persistToStorage: true, //
    },
    // Regarding the `astro check` warning: "[@astrojs/cloudflare] Enabling sessions with filesystem storage.
    // Be sure to define a KV binding named "SESSION"."
    // Your project uses a custom session management in `src/lib/auth/session.ts`
    // which expects a KV binding named `SESSION_KV` (as per your `src/env.d.ts`).
    //
    // Option 1: If you want to use Astro's built-in session handling provided by the adapter:
    //   - Ensure you have a KV binding named "SESSION" in your `wrangler.toml`.
    //   - You might need to pass a secret to the adapter's session config.
    //   - You would then use `Astro.locals.session` and related Astro APIs.
    //
    // Option 2: If you intend to *only* use your custom `SESSION_KV` logic:
    //   - The warning might be benign if the adapter's session features aren't directly used.
    //   - Check if the `@astrojs/cloudflare` adapter allows disabling its native session feature
    //     to suppress this warning if it's not needed.
    //   - Ensure your `wrangler.toml` correctly binds your `SESSION_KV`.
    //
    // Example if adapter allowed configuring its session binding (hypothetical, check adapter docs):
    // sessions: {
    //   enabled: true, // or false to disable if you only use custom
    //   kvBinding: "YOUR_ACTUAL_SESSION_KV_BINDING_NAME", // e.g., "SESSION_KV"
    //   secret: process.env.SESSION_SECRET // Load from environment variable
    // }
  }),
  integrations: [
    alpinejs(), //
    UnoCSS({ //
      injectReset: true, //
    }),
  ],
  vite: { //
    build: { //
      sourcemap: true, //
    },
    ssr: { //
      noExternal: ["decimal.js"], //
    },
  },
  // Regarding the `astro check` warning: "[WARN] [adapter] Cloudflare does not support sharp."
  // If you plan to use Astro's <Image /> component or other asset optimizations for on-demand
  // image processing in SSR mode on Cloudflare, this is a limitation.
  // For SSR on Cloudflare, you might need to:
  // 1. Pre-process images at build time if possible.
  // 2. Use Cloudflare Images service.
  // 3. Configure a no-op or a Cloudflare-compatible image service in Astro.
  // image: {
  //   service: {
  //     entrypoint: 'astro/assets/services/noop', // Disables runtime processing
  //   }
  // }
});