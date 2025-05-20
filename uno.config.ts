// uno.config.ts
import {
  defineConfig,
  presetIcons,
  presetTypography,
} from 'unocss';
// Using presetMini for edge deployment as it's significantly smaller
// while retaining essential utilities needed for the application
import presetMini from '@unocss/preset-mini';

export default defineConfig({
  // Mode configuration should be passed as an option to the build process
  // rather than directly in the config object
  
  presets: [
    presetMini(), // Optimized for edge deployment (200x faster, ~6KB vs ~25KB for presetUno)
    presetIcons({
      scale: 1.2,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
      collections: {
        carbon: () => import('@iconify-json/carbon/icons.json').then(i => i.default),
      },
    }),
    presetTypography(),
  ],
  
  shortcuts: [
    // Financial UI components
    { 'input': 'block w-full rounded-md border-neutral-300 dark:border-neutral-600 shadow-sm focus:border-primary-500 focus:ring focus:ring-primary-500 focus:ring-opacity-50 bg-white dark:bg-neutral-700 dark:text-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2' },
    { 'input-error': 'border-red-500 focus:border-red-500 focus:ring-red-500' },
    { 'btn': 'inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-neutral-900 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed' },
    { 'btn-primary': 'btn bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 focus:ring-primary-500' },
    { 'btn-secondary': 'btn bg-neutral-200 text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600 focus:ring-primary-500' },
    // Card components
    { 'card': 'bg-white dark:bg-neutral-800 rounded-lg shadow-md overflow-hidden' },
    { 'card-header': 'px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 sm:px-6'},
    { 'card-body': 'p-4 sm:p-6'},
    { 'card-footer': 'px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-neutral-700 sm:px-6'},
    // Financial data presentation
    { 'table-financial': 'w-full border-collapse' },
    { 'th-financial': 'p-3 text-left font-medium text-neutral-500 bg-neutral-50 dark:bg-neutral-800' },
    { 'td-financial': 'p-3 border-b border-neutral-200 dark:border-neutral-700' },
    { 'td-number': 'p-3 text-right tabular-nums border-b border-neutral-200 dark:border-neutral-700' },
    { 'td-positive': 'td-number text-success' },
    { 'td-negative': 'td-number text-danger' },
  ],
  
  theme: {
    colors: {
      primary: {
        DEFAULT: 'hsl(var(--color-primary-600))',
        50: 'hsl(var(--color-primary-50))',
        100: 'hsl(var(--color-primary-100))',
        200: 'hsl(var(--color-primary-200))',
        300: 'hsl(var(--color-primary-300))',
        400: 'hsl(var(--color-primary-400))',
        500: 'hsl(var(--color-primary-500))',
        600: 'hsl(var(--color-primary-600))',
        700: 'hsl(var(--color-primary-700))',
        800: 'hsl(var(--color-primary-800))',
        900: 'hsl(var(--color-primary-900))',
        950: 'hsl(var(--color-primary-950))',
      },
      neutral: {
        DEFAULT: 'hsl(var(--color-neutral-500))',
        50: 'hsl(var(--color-neutral-50))',
        100: 'hsl(var(--color-neutral-100))',
        200: 'hsl(var(--color-neutral-200))',
        300: 'hsl(var(--color-neutral-300))',
        400: 'hsl(var(--color-neutral-400))',
        500: 'hsl(var(--color-neutral-500))',
        600: 'hsl(var(--color-neutral-600))',
        700: 'hsl(var(--color-neutral-700))',
        800: 'hsl(var(--color-neutral-800))',
        900: 'hsl(var(--color-neutral-900))',
        950: 'hsl(var(--color-neutral-950))',
      },
      success: 'hsl(var(--color-success))',
      danger: 'hsl(var(--color-danger))',
    },
    fontFamily: {
      sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans"', 'sans-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"', '"Segoe UI Symbol"', '"Noto Color Emoji"'],
    },
  },

  // Content scanning configuration for build optimization
  content: {
    pipeline: {
      include: [
        // Scan all relevant file types for utility classes
        'src/**/*.{astro,html,js,ts,jsx,tsx}',
        'src/**/*.{vue,svelte}', // Include if you use these components within Astro
      ],
      exclude: [
        'node_modules',
        '.git',
        'dist',
        '.astro'
      ]
    },
  },

  // Additional safelist for dynamically generated classes that might not be detected
  safelist: [
    // Financial indicators that might be generated dynamically
    'text-success',
    'text-danger',
    'bg-success/10',
    'bg-danger/10',
  ]
});