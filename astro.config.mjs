import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import alpinejs from "@astrojs/alpinejs";
import UnoCSS from "unocss/astro";

// https://astro.build/config
export default defineConfig({
  // Render output as server-side
  output: "server",
  adapter: cloudflare({
    mode: "directory",
    functionPerRoute: false,
    runtime: {
      mode: "local",
      persistToStorage: true,
    },
    // If you decide to use the adapter’s built-in session:
    // sessions: {
    //   enabled: true,
    //   kvBinding: "SESSION", // ensure this matches your wrangler.toml
    //   secret: process.env.SESSION_SECRET
    // }
    //
    // Otherwise, relying solely on your custom SESSION_KV:
    // - Confirm SESSION_KV is bound in wrangler.toml
    // - The adapter’s session warning can be ignored if unused
  }),
  integrations: [
    alpinejs(),
    UnoCSS({
      injectReset: true,
    }),
  ],
  vite: {
    build: {
      sourcemap: true,
    },
    ssr: {
      // No external packages excluded from SSR bundling
      noExternal: []
    },
  },
  // If you use Astro’s Image component at runtime on Cloudflare,
  // you may need a no-op image service:
  // image: {
  //   service: {
  //     entrypoint: "astro/assets/services/noop"
  //   }
  // }
});
