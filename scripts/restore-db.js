// scripts/restore-db.js
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, '../backups');
const ENV = process.env.NODE_ENV || 'development';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function listBackups() {
  try {
    await fs.access(BACKUP_DIR);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`⚠️  Backup directory not found: ${BACKUP_DIR}`);
      console.log('   Please run `npm run backup` first to create backups.');
      return null;
    }
    throw error;
  }

  const files = await fs.readdir(BACKUP_DIR);
  // Filter for .sql files that match the current environment's backup naming convention
  const backupFiles = files
    .filter(f => f.startsWith(`properaccount-${ENV}-`) && f.endsWith('.sql'))
    .sort()
    .reverse(); // Most recent first

  if (backupFiles.length === 0) {
    console.log(`No backup files found for the '${ENV}' environment in ${BACKUP_DIR}.`);
    console.log('Ensure backups exist and match the pattern: properaccount-<ENV>-<timestamp>.sql');
    return null;
  }

  console.log(`\nAvailable backups for '${ENV}' environment (most recent first):`);
  for (let i = 0; i < backupFiles.length; i++) {
    const metaFile = `${backupFiles[i]}.meta.json`;
    let metadataInfo = '';
    try {
      const metaContent = await fs.readFile(path.join(BACKUP_DIR, metaFile), 'utf8');
      const metadata = JSON.parse(metaContent);
      metadataInfo = ` (Env: ${metadata.environment}, Date: <span class="math-inline">\{metadata\.timestamp\}, v</span>{metadata.version || 'N/A'})`;
    } catch {
      // Meta file might not exist or be readable, proceed without it
    }
    console.log(`${i + 1}. <span class="math-inline">\{backupFiles\[i\]\}</span>{metadataInfo}`);
  }
  return backupFiles;
}

async function restoreDatabase() {
  console.log(`🔄 Restore database for ${ENV} environment`);

  const backupFiles = await listBackups();
  if (!backupFiles || backupFiles.length === 0) {
    rl.close();
    process.exit(1);
  }

  const choice = await question('\nEnter backup number to restore (or type "cancel"): ');

  if (choice.toLowerCase() === 'cancel') {
    console.log('Restore cancelled.');
    rl.close();
    return;
  }

  const backupIndex = parseInt(choice) - 1;
  if (isNaN(backupIndex) || backupIndex < 0 || backupIndex >= backupFiles.length) {
    console.error('❌ Invalid selection.');
    rl.close();
    process.exit(1);
  }

  const selectedBackup = backupFiles[backupIndex];
  const backupPath = path.join(BACKUP_DIR, selectedBackup);

  console.warn('\n⚠️  WARNING: This will overwrite all existing data in the target database!');
  const confirm = await question(
    `Restore from "${selectedBackup}" into an ${ENV} database? This CANNOT be undone. (yes/no): `
  );

  if (confirm.toLowerCase() !== 'yes') {
    console.log('Restore cancelled by user.');
    rl.close();
    return;
  }

  console.log('\n⏳ Starting restore process...');

  try {
    console.log('   1. Creating a pre-restore backup of the current database state...');
    // Ensure the pre-restore backup doesn't get cleaned up immediately if it's among the oldest
    await execAsync('npm run backup');
    console.log('   ✅ Pre-restore backup completed.\n');

    console.log(`   2. Importing data from "${selectedBackup}"...`);
    const importCommand = ENV === 'development' ?
      `wrangler d1 execute DATABASE --local --file="${backupPath}"` : // For local, import often uses execute with file
      `wrangler d1 import DATABASE --env=<span class="math-inline">\{ENV\} \-\-file\="</span>{backupPath}"`; // For remote, import might be better if available and suitable for SQL dumps
                                                                        // Note: `wrangler d1 import` is more for bulk data, SQL dumps usually use `execute --file`.
                                                                        // Assuming SQL dump, execute is more appropriate.
    const { stdout: importOut, stderr: importErr } = await execAsync(
        ENV === 'development' ?
        `wrangler d1 execute DATABASE --local --file="${backupPath}"` :
        `wrangler d1 execute DATABASE --env=<span class="math-inline">\{ENV\} \-\-file\="</span>{backupPath}"`
    );

    if (importErr) console.warn('   ⚠️  Wrangler import/execute stderr:', importErr);
    console.log('   ✅ Database data imported successfully from backup.');

    console.log('\n   3. Applying any pending database migrations...');
    const migrateCommand = ENV === 'development' ?
      'npm run db:migrate' : // Assumes db:migrate script correctly targets local or uses --local
      `npx drizzle-kit migrate --config=./drizzle.config.ts`; // More direct for remote if npm script isn't env-aware
                                                          // Or ensure `npm run db:migrate` uses `wrangler d1 migrations apply DATABASE --env=${ENV}`
    await execAsync(migrateCommand);
    console.log('   ✅ Migrations applied successfully (or no new migrations found).');

    console.log('\n🎉 Database restore and migration process completed successfully!');

  } catch (error) {
    console.error('\n❌ Restore process failed:');
    console.error('   Error message:', error.message);
    if (error.stderr) console.error('   Stderr:', error.stderr);
    if (error.stdout) console.error('   Stdout:', error.stdout);
    console.error('\n   A pre-restore backup was created. You may need to manually restore from that if the target database is in an inconsistent state.');
    process.exit(1);
  } finally {
    rl.close();
  }
}

restoreDatabase();