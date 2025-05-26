// uno.config.ts
import {
  defineConfig,
  presetTypography,
  // transformerDirectives, // Uncomment if you use @apply or similar directives
  // transformerVariantGroup, // Uncomment if you use variant groups
} from 'unocss';
import presetMini from '@unocss/preset-mini';

export default defineConfig({
  presets: [
    presetMini(), // Provides core utilities like animate-spin, sr-only
    presetTypography(),
  ],
  // transformers: [ // Uncomment if using directives or variant groups
  //   transformerDirectives(),
  //   transformerVariantGroup(),
  // ],
  shortcuts: [
    // Base Input/Form Elements
    { 'input': 'block w-full rounded-md border-neutral-300 dark:border-neutral-600 shadow-sm focus:border-primary-500 focus:ring focus:ring-primary-500 focus:ring-opacity-50 bg-white dark:bg-neutral-700 dark:text-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2' },
    { 'input-error': 'border-red-500 focus:border-red-500 focus:ring-red-500' },
    { 'input-success': 'border-green-500 focus:border-green-500 focus:ring-green-500' },
    
    // Buttons
    { 'btn': 'inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-neutral-900 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed' },
    { 'btn-primary': 'btn bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 focus:ring-primary-500' },
    { 'btn-secondary': 'btn bg-neutral-200 text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600 focus:ring-primary-500' },
    { 'btn-danger': 'btn bg-danger-600 text-white hover:bg-red-700 focus:ring-red-500' },
    { 'btn-success': 'btn bg-green-600 text-white hover:bg-green-700 focus:ring-green-500' },
    { 'btn-sm': 'px-3 py-1.5 text-xs' },
    { 'btn-lg': 'px-6 py-3 text-base' },
    
    // Card Components
    { 'card': 'bg-white dark:bg-neutral-800 rounded-lg shadow-md overflow-hidden' },
    { 'card-header': 'px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 sm:px-6'},
    { 'card-body': 'p-4 sm:p-6'},
    { 'card-footer': 'px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-neutral-700 sm:px-6'},
    
    // Financial Data Tables
    { 'table-financial': 'w-full border-collapse' },
    { 'th-financial': 'p-3 text-left font-medium text-neutral-500 bg-neutral-50 dark:bg-neutral-800 tabular-nums' }, // Added tabular-nums
    { 'td-financial': 'p-3 border-b border-neutral-200 dark:border-neutral-700' },
    { 'td-number': 'p-3 text-right tabular-nums border-b border-neutral-200 dark:border-neutral-700' }, // Uses tabular-nums
    { 'td-positive': 'td-number text-green-600 dark:text-green-400' },
    { 'td-negative': 'td-number text-red-600 dark:text-red-400' },
    
    // Accounting-Specific
    { 'amount-positive': 'text-green-600 dark:text-green-400 font-medium tabular-nums' }, // Uses tabular-nums
    { 'amount-negative': 'text-red-600 dark:text-red-400 font-medium tabular-nums' }, // Uses tabular-nums
    { 'account-code': 'font-mono text-sm text-neutral-600 dark:text-neutral-400' },
    { 'balance-total': 'font-bold text-lg border-t-2 border-neutral-900 dark:border-neutral-100 pt-2 tabular-nums' }, // Added tabular-nums
    { 'currency': 'tabular-nums font-medium' }, // This now correctly uses the tabular-nums shortcut
    
    // Status Indicators
    { 'status-badge': 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium' },
    { 'status-reconciled': 'status-badge bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    { 'status-pending': 'status-badge bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    { 'status-error': 'status-badge bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
    { 'status-draft': 'status-badge bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200' },
    
    // Form Groups
    { 'form-group': 'space-y-1' },
    { 'label': 'block text-sm font-medium text-neutral-700 dark:text-neutral-300' },
    { 'help-text': 'text-sm text-neutral-500 dark:text-neutral-400' },
    { 'error-text': 'text-sm text-red-600 dark:text-red-400' },
    
    // Layout Utilities
    { 'container-app': 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8' },
    { 'section-spacing': 'py-8 sm:py-12' },
    { 'stack': 'flex flex-col space-y-4' },
    { 'inline-actions': 'flex items-center space-x-3' },
    
    // Loading States
    { 'skeleton': 'animate-pulse bg-neutral-200 dark:bg-neutral-700 rounded' }, // animate-pulse is from presetMini
    // 'spinner': 'animate-spin h-5 w-5 text-primary-600', // animate-spin is from presetMini, use it directly e.g. class="animate-spin h-5 w-5 text-primary-600"
    
    // Typography
    { 'heading-1': 'text-3xl font-bold text-neutral-900 dark:text-neutral-100' },
    { 'heading-2': 'text-2xl font-semibold text-neutral-900 dark:text-neutral-100' },
    { 'heading-3': 'text-xl font-medium text-neutral-900 dark:text-neutral-100' },
    { 'text-muted': 'text-neutral-600 dark:text-neutral-400' },

    // Tabular numbers utility shortcut
    { 'tabular-nums': 'font-variant-numeric-tabular-nums font-feature-settings-tnum' },
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
      warning: 'hsl(var(--color-warning))',
      info: 'hsl(var(--color-info))',
    },
    fontFamily: {
      sans: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
      mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    },
  },

  content: {
    pipeline: {
      include: [
        // Match all Astro, HTML, JS, TS, Vue, Svelte files in src
        /\.js(?:t|x)?$/, // .js, .jsx, .ts, .tsx
        /\.(?:astro|html|svelte|vue|mdx?)(?:$|\?)/,
        // For attribute mode or other dynamic class usage, ensure your regex covers it
        // Or add specific file paths if needed
        'src/**/*.{astro,html,js,ts,jsx,tsx,vue,svelte,md,mdx}',
      ],
      exclude: [
        'node_modules',
        '.git',
        'dist',
        '.astro',
        '.wrangler',
        // Add other build or cache directories if necessary
      ]
    },
  },

  safelist: [
    // Grid columns for dynamic layouts
    ...Array.from({ length: 12 }, (_, i) => `grid-cols-${i + 1}`),
    // Common animations (animate-spin, animate-pulse, animate-bounce are usually part of presetMini)
    'animate-spin',
    'animate-pulse',
    'animate-bounce',
    // Dynamic colors (ensure these match your actual usage patterns)
    'text-success', 'text-danger', 'text-warning', 'text-info',
    'bg-success', 'bg-danger', 'bg-warning', 'bg-info', // Full background colors
    'bg-green-100', 'text-green-800', 'dark:bg-green-900', 'dark:text-green-200', // For status-reconciled
    'bg-yellow-100', 'text-yellow-800', 'dark:bg-yellow-900', 'dark:text-yellow-200', // For status-pending
    'bg-red-100', 'text-red-800', 'dark:bg-red-900', 'dark:text-red-200', // For status-error
    'bg-neutral-100', 'text-neutral-800', 'dark:bg-neutral-900', 'dark:text-neutral-200', // For status-draft
    // Opacity versions if used, e.g., 'bg-success/10'
    // Dynamic widths (example, adjust as needed)
    ...['0', '1/4', '1/2', '3/4', 'full', '1/5', '2/5', '3/5', '4/5'].map(i => `w-${i}`),
    ...['0', '25', '50', '75', '100'].map(i => `w-${i}pct`), // If you use % based width classes
  ],

  preflights: [
    {
      getCSS: () => `
        :root {
          /* HSL color definitions - Single source of truth */
          --color-primary-50: 239 246 255; /* Original: 213 100% 97% */
          --color-primary-100: 219 234 254; /* Original: 214 95% 93% */
          --color-primary-200: 191 219 254; /* Original: 213 93% 87% */
          --color-primary-300: 147 197 253; /* Original: 212 96% 78% */
          --color-primary-400: 96 165 250;  /* Original: 213 94% 68% */
          --color-primary-500: 59 130 246;  /* Original: 217 91% 60% */
          --color-primary-600: 37 99 235;   /* Original: 221 83% 53% */
          --color-primary-700: 29 78 216;   /* Original: 224 76% 48% */
          --color-primary-800: 30 64 175;   /* Original: 226 71% 40% */
          --color-primary-900: 30 58 138;   /* Original: 224 64% 33% */
          --color-primary-950: 23 37 84;    /* Original: 226 57% 21% */
          
          --color-neutral-50: 250 250 250; /* Original: 0 0% 98% */
          --color-neutral-100: 244 244 245; /* Original: 0 0% 96% */
          --color-neutral-200: 228 228 231; /* Original: 0 0% 90% */
          --color-neutral-300: 212 212 216; /* Original: 0 0% 83% */
          --color-neutral-400: 161 161 170; /* Original: 0 0% 64% */
          --color-neutral-500: 113 113 122; /* Original: 0 0% 45% */
          --color-neutral-600: 82 82 91;    /* Original: 0 0% 32% */
          --color-neutral-700: 63 63 70;    /* Original: 0 0% 25% */
          --color-neutral-800: 39 39 42;    /* Original: 0 0% 15% */
          --color-neutral-900: 24 24 27;    /* Original: 0 0% 9% */
          --color-neutral-950: 9 9 11;      /* Original: 0 0% 4% */
          
          --color-success: 134 239 172; /* Green for positive numbers, original: 158 64% 40% */
          --color-danger: 248 113 113;  /* Red for negative numbers, original: 0 84% 60% */
          --color-warning: 251 191 36;
          --color-info: 96 165 250;
        }
        
        /* Use html.dark to match global.css and common practice */
        html.dark {
          color-scheme: dark;
        }
        
        /* Ensure number inputs don't show spinners */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield; /* Firefox */
        }

        /* Other global base styles or resets if @unocss/reset/tailwind.css is not sufficient */
        /* For example, if you opted out of the reset from astro.config.mjs's UnoCSS integration */
      `
    }
  ]
});