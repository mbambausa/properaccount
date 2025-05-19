// uno.config.ts
import {
  defineConfig,
  presetUno,
  presetIcons,
  presetTypography,
} from "unocss";
import type { UserConfig } from "unocss"; // Changed to type-only import

export default defineConfig({
  presets: [
    presetUno(), // Basic UnoCSS preset (similar to Tailwind)
    presetIcons({
      // Icon preset
      scale: 1.2,
      collections: {
        carbon: () =>
          import("@iconify-json/carbon/icons.json").then((i) => i.default),
      },
    }),
    presetTypography(), // Typography preset for prose styling
  ],
  shortcuts: {
    // Custom utility shortcuts
    'btn': "py-2 px-4 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
    'btn-primary':
      "btn bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-400",
    'btn-secondary':
      "btn bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600",
    'input':
      "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-300 transition-colors w-full dark:bg-neutral-700 dark:border-neutral-600 dark:focus:ring-primary-500 dark:focus:border-primary-500",
    'card': "bg-white rounded-lg shadow p-4 dark:bg-neutral-800 dark:shadow-neutral-700/50",
    'card-header':
      "px-4 py-3 border-b border-neutral-200 dark:border-neutral-700",
    'form-group': "mb-4",
    'form-label':
      "block text-sm font-medium text-gray-700 mb-1 dark:text-neutral-300",
    'container': "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",
    'heading-1':
      "text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl lg:text-6xl",
    'heading-2':
      "text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl",
    'heading-3':
      "text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl",
    'link': "text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 underline",
  },
  theme: {
    // Theme customization
    colors: {
      primary: {
        // Example primary color palette, aligned with user's initial theme
        "50": "#eff6ff", // Lightest shade
        "100": "#dbeafe",
        "200": "#bfdbfe",
        "300": "#93c5fd",
        "400": "#60a5fa",
        "500": "#3b82f6", // A common blue-500
        "600": "#2563eb",
        "700": "#1d4ed8",
        "800": "#1e40af",
        "900": "#1e3a8a",
        "950": "#172554",
      },
      neutral: {
        // Neutral colors for backgrounds, text, borders, especially in dark mode
        50: "#fafafa",
        100: "#f5f5f5",
        200: "#e5e5e5",
        300: "#d4d4d4",
        400: "#a3a3a3",
        500: "#737373",
        600: "#525252",
        700: "#404040",
        800: "#262626",
        900: "#171717",
        950: "#0a0a0a",
      },
    },
    fontFamily: {
      sans: [
        "Inter",
        "ui-sans-serif",
        "system-ui",
        "-apple-system",
        "BlinkMacSystemFont",
        '"Segoe UI"',
        "Roboto",
        '"Helvetica Neue"',
        "Arial",
        '"Noto Sans"',
        "sans-serif",
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
        '"Noto Color Emoji"',
      ],
      // serif: [...],
      // mono: [...],
    },
  },
  // Configuration for dark mode using a class strategy
  darkMode: "class",
  // Content scanning configuration for Astro projects
  content: {
    pipeline: {
      include: [
        /\.(astro|html|js|jsx|md|mdx|svelte|ts|tsx|vue)($|\?)/,
        "astro.config.mjs",
        "uno.config.ts",
      ],
      exclude: [
        "node_modules/**/*",
        ".git/**/*",
        "dist/**/*",
        ".astro/**/*",
        ".wrangler/**/*",
      ],
    },
  },
  // Build-time strategy for edge deployments to generate separate CSS chunks for better caching
  mode: "dist-chunk",
} as UserConfig); // Keeping 'as UserConfig' for now, in case the darkMode issue was separate