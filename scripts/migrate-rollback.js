// scripts/migrate-rollback.js
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../cloudflare/d1/migrations');
const ENV = process.env.NODE_ENV || 'development';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (q) => new Promise(resolve => rl.question(q, resolve));

async function getMigrationHistory() {
  // Note: This reads migration files from the directory.
  // For a true history of applied migrations, one would query D1's internal migration table.
  // However, for this helper script's purpose, listing files is a simpler approach.
  try {
    const files = await fs.readdir(MIGRATIONS_DIR);
    const migrations = files
      .filter(f => f.endsWith('.sql') && !f.startsWith('.')) // Exclude hidden files
      .sort() // Sorts alphabetically/numerically which usually means chronological for Drizzle migrations
      .reverse(); // Newest first

    return migrations;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`⚠️  Migrations directory not found: ${MIGRATIONS_DIR}`);
      return [];
    }
    throw error;
  }
}

async function rollbackMigration() {
  console.log(`🔄 Migration Rollback Helper for ${ENV} environment\n`);

  if (ENV === 'production') {
    console.warn('⚠️  WARNING: Attempting to guide rollback for PRODUCTION environment.');
    console.warn('   This script DOES NOT automatically perform database rollbacks.');
    console.warn('   It helps identify migrations and reminds you to backup.');
    console.warn('   Rolling back production migrations can lead to DATA LOSS if not done carefully!');
    const confirm = await question('Type "understand production risks" to continue: ');

    if (confirm !== 'understand production risks') {
      console.log('Rollback guidance cancelled for production.');
      rl.close();
      return;
    }
  }

  try {
    console.log('IMPORTANT: This script does NOT execute automated D1 rollbacks.');
    console.log('Drizzle Kit does not have a direct "down" migration or "rollback last N" command for D1 in the same way as some other ORMs.');
    console.log('This script will guide you through steps for a *manual* consideration of rollback.\n');

    console.log('1. 📸 Create a backup of the current database state NOW.');
    console.log('   Run: npm run backup');
    const backupConfirm = await question('Have you successfully created a backup? (yes/no): ');
    if (backupConfirm.toLowerCase() !== 'yes') {
      console.log('Please create a backup before proceeding. Rollback guidance cancelled.');
      rl.close();
      return;
    }
    console.log('   ✅ Backup confirmed.\n');

    const migrations = await getMigrationHistory();

    if (migrations.length === 0) {
      console.log('No migration SQL files found in the migrations directory.');
      rl.close();
      return;
    }

    console.log('2. 📝 Review applied migrations (newest file listed first):');
    migrations.forEach((m, i) => console.log(`   ${i + 1}. ${m}`));

    console.log('\n3. 🛑 Consider the impact of a rollback.');
    console.log('   - Rolling back schema changes can lead to data loss if columns/tables are dropped.');
    console.log('   - Application code relying on newer schema will break.');

    console.log('\n4. If you must proceed with a manual rollback (e.g., to a state before certain migrations):');
    console.log('   a. RESTORE the database from the backup you just created (or an earlier one).');
    console.log('      Run: npm run restore (and select the appropriate backup)');
    console.log('   b. (Optional, if Drizzle Kit state is confusing) Carefully delete the specific migration files (e.g., `000X_...sql`) from your `cloudflare/d1/migrations` directory that you effectively want to "un-apply".');
    console.log('   c. (Optional) Delete the corresponding entries from the `drizzle.__drizzle_migrations` table in your D1 database if you want Drizzle Kit to "forget" they were applied.');
    console.log('      Use `wrangler d1 execute DATABASE --local --command "DELETE FROM drizzle.__drizzle_migrations WHERE migration_name = \'your_migration_file.sql\';"`');
    console.log('   d. After restoring and cleaning up migration files/history, if you deploy new code, Drizzle Kit will attempt to apply migrations from that point forward.');

    console.log('\nThis script has provided guidance. No automated changes have been made to your database schema or migration files.');
    console.log('Proceed with extreme caution, especially in production.');

  } catch (error) {
    console.error('❌ Error during rollback guidance:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

rollbackMigration();