// scripts/clean.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

const CLEAN_PATHS = [
  'dist',
  '.astro',
  '.wrangler',
  '.mf', // Miniflare state
  'node_modules/.cache',
  'node_modules/.vite', // Vite cache
  'playwright-report',
  'test-results',
  'coverage',
  '.vitest-cache',
  'src/types/generated', // Generated types
  'public/mojo',         // Compiled Mojo outputs (assuming all in this dir can be cleaned)
  'backups/*.sql.meta.json', // Specific pattern for meta files if needed, else covered by backups/
  // Add other temporary files or directories if needed
  // e.g., '*.log' in specific script output dirs if not globally ignored
];

async function clean() {
  console.log('🧹 Cleaning project artifacts and cache directories...\n');
  let cleanedCount = 0;
  let errorCount = 0;

  for (const cleanPath of CLEAN_PATHS) {
    const fullPath = path.join(ROOT_DIR, cleanPath);
    // Note: Glob patterns like 'public/mojo/*.wasm' won't work directly with fs.rm.
    // If you need globbing, use a library like 'glob' to expand paths first.
    // For simplicity, this example assumes direct paths or full directories.
    // 'public/mojo' will remove the whole directory.

    try {
      // fs.rm with force:true will not error if path doesn't exist.
      // recursive:true is needed for directories.
      await fs.rm(fullPath, { recursive: true, force: true });
      console.log(`✅ Cleaned: ${cleanPath}`);
      cleanedCount++;
    } catch (error) {
      // This catch block might only be hit for unexpected errors other than non-existence.
      console.error(`❌ Error cleaning ${cleanPath}:`, error.message);
      errorCount++;
    }
  }

  if (errorCount > 0) {
    console.warn(`\n⚠️  Cleaning process encountered ${errorCount} error(s).`);
  }
  console.log(`\n✨ Clean complete. Processed ${CLEAN_PATHS.length} path definitions. Found and attempted to clean ${cleanedCount} items.`);
}

clean();