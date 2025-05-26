// scripts/backup-db.js
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, '../backups');
const ENV = process.env.NODE_ENV || 'development';

async function ensureBackupDir() {
  try {
    await fs.access(BACKUP_DIR);
  } catch {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  }
}

async function backupDatabase() {
  console.log(`Starting database backup for ${ENV} environment...`);

  await ensureBackupDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `properaccount-${ENV}-${timestamp}.sql`);

  try {
    if (ENV === 'development') {
      const { stdout, stderr } = await execAsync(
        `wrangler d1 export DATABASE --local --output "${backupFile}"` // Added quotes for path
      );
      if (stderr) console.warn('Wrangler stderr (local export):', stderr); // Changed to warn
      console.log('Local database exported successfully');
    } else {
      // For remote environments (e.g., production, preview)
      // Wrangler's --env flag resolves the correct D1 database based on wrangler.toml
      const { stdout, stderr } = await execAsync(
        `wrangler d1 export DATABASE --env=${ENV} --output "${backupFile}"` // Added quotes for path
      );
      if (stderr) console.warn(`Wrangler stderr (${ENV} export):`, stderr); // Changed to warn
      console.log(`${ENV} database exported successfully`);
    }

    // Create a metadata file
    // For remote ENV, process.env.CLOUDFLARE_D1_DATABASE_ID would need to be set in the
    // script's execution environment if you want to log the specific production/preview D1 ID.
    // Wrangler's `--env` flag handles targeting the correct DB for the export itself.
    // If this var isn't set, it will be undefined in the metadata for remote envs.
    const metadata = {
      environment: ENV,
      timestamp,
      databaseId: ENV === 'development' ? 'local' : process.env.CLOUDFLARE_D1_DATABASE_ID,
      version: process.env.npm_package_version || 'unknown', // Added fallback for version
    };

    await fs.writeFile(
      `${backupFile}.meta.json`,
      JSON.stringify(metadata, null, 2)
    );

    console.log(`✅ Backup completed: ${backupFile}`);

    await cleanOldBackups();

  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    if (error.stderr) console.error('Error stderr:', error.stderr);
    if (error.stdout) console.error('Error stdout:', error.stdout);
    process.exit(1);
  }
}

async function cleanOldBackups() {
  console.log('🗑️  Cleaning old backups (keeping last 10)...');
  const files = await fs.readdir(BACKUP_DIR);
  // Ensure we only consider files matching our backup naming convention for the current ENV
  const backupFiles = files
    .filter(f => f.startsWith(`properaccount-${ENV}-`) && f.endsWith('.sql'))
    .sort(); // Sorts oldest to newest by timestamp in filename

  if (backupFiles.length > 10) {
    const toDelete = backupFiles.slice(0, backupFiles.length - 10);

    for (const file of toDelete) {
      const sqlFilePath = path.join(BACKUP_DIR, file);
      const metaFilePath = path.join(BACKUP_DIR, `${file}.meta.json`);
      try {
        await fs.unlink(sqlFilePath);
        console.log(`   - Deleted old backup: ${file}`);
        await fs.unlink(metaFilePath);
        console.log(`   - Deleted old metadata: ${file}.meta.json`);
      } catch (unlinkError) {
        // Log if meta deletion fails but SQL deletion succeeded, or vice-versa
        console.warn(`   - Warning: Could not delete all parts of old backup ${file}: ${unlinkError.message}`);
      }
    }
    console.log(`Cleaned up ${toDelete.length} old backup(s) for ${ENV} environment.`);
  } else {
    console.log(`No old backups to clean for ${ENV} environment (found ${backupFiles.length}).`);
  }
}

backupDatabase();