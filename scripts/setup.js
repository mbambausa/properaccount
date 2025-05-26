// scripts/setup.js
import { exec, execSync } from 'child_process'; // Added execSync for Node version check
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (q) => new Promise(resolve => rl.question(q, resolve));

// Helper to run command and return trimmed stdout
async function runCommand(command, description) {
  console.log(description);
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr) console.warn(`   ⚠️  Warning (stderr): ${stderr.trim()}`);
    if (stdout) console.log(`   ${stdout.trim()}`);
    return { success: true, stdout, stderr };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    if (error.stderr) console.error(`     Stderr: ${error.stderr.trim()}`);
    if (error.stdout) console.error(`     Stdout: ${error.stdout.trim()}`); // stdout might have info too
    return { success: false, error };
  }
}

async function setup() {
  console.log('🚀 ProperAccount Development Setup Utility\n');

  try {
    // 1. Check Node.js version
    console.log('1. Checking Node.js version...');
    const requiredMajorVersion = 22; // As per your .nvmrc and package.json engines
    // Consider dynamically reading from .nvmrc for future robustness:
    // const nvmrcContent = await fs.readFile(path.join(__dirname, '../.nvmrc'), 'utf8').catch(() => `v${requiredMajorVersion}`);
    // const requiredMajorVersion = parseInt(nvmrcContent.trim().replace('v', ''));
    try {
      const nodeVersionOutput = execSync('node --version', { encoding: 'utf8' }).trim();
      const currentMajorVersion = parseInt(nodeVersionOutput.split('.')[0].substring(1));
      if (currentMajorVersion < requiredMajorVersion) {
        console.error(`❌ Node.js v${requiredMajorVersion} or higher is required. You are using ${nodeVersionOutput}.`);
        console.error('   Please update Node.js or use NVM (Node Version Manager) to switch to the correct version specified in .nvmrc.');
        process.exit(1);
      }
      console.log(`✅ Node.js version check passed (${nodeVersionOutput}).`);
    } catch (nodeVersionError) {
        console.error('❌ Could not determine Node.js version. Please ensure Node.js is installed and in your PATH.');
        process.exit(1);
    }


    // 2. Check for .dev.vars file
    console.log('\n2. Checking for local development secrets file (.dev.vars)...');
    const devVarsPath = path.join(__dirname, '../.dev.vars');
    const envExamplePath = path.join(__dirname, '../.env.example');
    try {
      await fs.access(devVarsPath);
      console.log('✅ .dev.vars file exists.');
    } catch {
      console.log('📝 .dev.vars file not found. Attempting to create from .env.example...');
      try {
        await fs.copyFile(envExamplePath, devVarsPath);
        console.log('✅ .dev.vars created successfully from .env.example.');
        console.warn('⚠️  ACTION REQUIRED: Open the newly created .dev.vars file and fill in your actual development secrets and Cloudflare credentials.');
      } catch (copyError) {
        console.error(`❌ Failed to create .dev.vars from .env.example (${envExamplePath}). Please create it manually.`);
        console.error(`   Error: ${copyError.message}`);
        // Not exiting, user might proceed if they handle it manually
      }
    }

    // 2b. Run environment variable check script
    const checkEnvResult = await runCommand('node scripts/check-env.js', '\n2b. Running environment variable validation script...');
    if (!checkEnvResult.success) {
        console.error('❌ Environment check script reported errors. Please address them before proceeding.');
        process.exit(1);
    }


    // 3. Install dependencies
    const installResult = await runCommand('npm ci', '\n3. Installing project dependencies (npm ci)...');
    if (!installResult.success) {
        console.error('❌ Dependency installation failed. Please check npm logs.');
        process.exit(1);
    }
    console.log('✅ Dependencies installed.');


    // 4. Check Wrangler authentication
    console.log('\n4. Checking Wrangler CLI authentication with Cloudflare...');
    try {
      await execAsync('wrangler whoami');
      console.log('✅ Wrangler is authenticated.');
    } catch (wranglerAuthError) {
      console.warn('⚠️  Wrangler authentication check failed or Wrangler not found in PATH.');
      console.warn('   If you plan to interact with remote Cloudflare services (e.g., deploying, managing D1 via Drizzle Kit commands against remote),');
      console.warn('   please run "npx wrangler login" and ensure Wrangler is accessible.');
    }


    // 5. Verify D1 database configuration in wrangler.toml
    console.log('\n5. Verifying D1 database binding in wrangler.toml...');
    const wranglerConfigPath = path.join(__dirname, '../wrangler.toml');
    try {
      const wranglerConfig = await fs.readFile(wranglerConfigPath, 'utf8');
      if (!wranglerConfig.includes('binding = "DATABASE"')) { // Basic check
        console.error('❌ No D1 database configuration with `binding = "DATABASE"` found in wrangler.toml.');
        console.error('   Please ensure your D1 database is correctly configured for local development and other environments.');
        process.exit(1); // Critical for migrations and seeding
      }
      console.log('✅ D1 database binding "DATABASE" seems to be configured in wrangler.toml.');
    } catch (tomlError) {
        console.error(`❌ Could not read wrangler.toml at ${wranglerConfigPath}. Ensure the file exists.`);
        process.exit(1);
    }


    // 6. Apply database migrations to local D1
    console.log('\n6. Applying database migrations to local D1 database...');
    console.log('   (This uses `wrangler d1 migrations apply DATABASE --local`)');
    const migrateResult = await runCommand('npm run db:migrate:local', '   Running local migrations...'); // Assuming you have this script
    // If you don't have `db:migrate:local`, use:
    // const migrateResult = await runCommand('npx wrangler d1 migrations apply DATABASE --local', '   Running local migrations...');
    if (!migrateResult.success) {
      console.warn('⚠️  Local database migration application failed or encountered issues. Review output above.');
      console.warn('   Ensure your D1 setup for local dev is correct and migrations are valid.');
    } else {
      console.log('✅ Local database migrations applied (or no new migrations).');
    }


    // 7. Generate TypeScript types
    console.log('\n7. Generating TypeScript types from Drizzle schema...');
    // Note: The 'scripts/generate-types.js' now imports .ts files directly.
    // This step might require 'tsx' or 'ts-node' to be installed (e.g., as a devDependency)
    // and the 'npm run generate-types' script to use it (e.g., "generate-types": "tsx scripts/generate-types.js").
    const typegenResult = await runCommand('npm run generate-types', '   Running type generation script...');
    if (!typegenResult.success) {
      console.warn('⚠️  TypeScript type generation failed. Check the script and ensure any required TypeScript runner (like tsx) is available.');
    } else {
      console.log('✅ TypeScript types generated.');
    }


    // 8. Creating necessary project directories
    console.log('\n8. Ensuring essential project directories exist...');
    const dirsToEnsure = ['backups', 'public/mojo', 'src/types/generated'];
    let createdDirCount = 0;
    for (const dir of dirsToEnsure) {
      const fullDirPath = path.join(__dirname, '..', dir);
      try {
        await fs.mkdir(fullDirPath, { recursive: true });
        createdDirCount++;
      } catch (dirError) {
        console.warn(`   ⚠️  Could not ensure directory ${dir}: ${dirError.message}`);
      }
    }
    if(createdDirCount > 0) console.log(`✅ Ensured ${createdDirCount} project directories.`);


    // 9. Seed database (optional)
    const shouldSeed = await question('\n9. 🌱 Would you like to seed the local database with sample data? (yes/no): ');
    if (shouldSeed.toLowerCase() === 'yes' || shouldSeed.toLowerCase() === 'y') {
      console.log('   Attempting to seed local database...');
      const seedResult = await runCommand('npm run db:seed', '   Running database seed script...');
      if (!seedResult.success) {
        console.error('❌ Database seeding failed. Please check the output from the seed script.');
      }
      // The seed script itself should confirm success.
    } else {
      console.log('   Skipping database seeding.');
    }


    // 10. Install Playwright browsers
    console.log('\n10. Installing Playwright browsers (specifically Chromium with dependencies)...');
    const playwrightInstallResult = await runCommand('npx playwright install --with-deps chromium', '    Installing Playwright Chromium...');
    if (!playwrightInstallResult.success) {
      console.warn('⚠️  Playwright browser installation failed. If you plan to run E2E tests, you might need to run this manually or check for issues.');
    } else {
      console.log('✅ Playwright browsers (Chromium) installed.');
    }


    console.log('\n🎉 ProperAccount Development Setup Complete! 🎉');
    console.log('\nNext Steps:');
    console.log('   1. If `.dev.vars` was newly created or you haven\'t yet, OPEN IT AND FILL IN YOUR SECRETS (e.g., API keys, `AUTH_SECRET`).');
    console.log('   2. Start the development server: `npm run dev`');
    console.log('\nUseful Commands:');
    console.log('   `npm run db:studio`      - Open Drizzle Studio for your local D1 database.');
    console.log('   `npm run test`           - Run Playwright E2E tests.');
    console.log('   `npm run lint`           - Check code for linting issues.');
    console.log('   `npm run format`         - Format code with Prettier.');
    console.log('   `npm run build`          - Create a production build.');

  } catch (error) {
    console.error('\n❌ An unexpected error occurred during the setup process:');
    console.error(error.message);
    if (error.stack && process.env.DEBUG) { // Show stack only if DEBUG is set
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

setup();