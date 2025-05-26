// scripts/check-env.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REQUIRED_VARS = {
  development: [
    'PUBLIC_APP_URL',
    'AUTH_SECRET',
    'CSRF_SECRET',
    // For local Drizzle Kit operations (generate, migrate, studio) targeting remote D1:
    'CLOUDFLARE_ACCOUNT_ID',    // Needed by drizzle.config.ts
    'CLOUDFLARE_API_TOKEN',     // Needed by drizzle.config.ts
    'CLOUDFLARE_D1_DATABASE_ID',// Needed by drizzle.config.ts (for specific DB)
  ],
  production: [ // Typically set in CI/CD or Cloudflare Pages dashboard
    'PUBLIC_APP_URL',
    'AUTH_SECRET',
    'CSRF_SECRET',
    'GOOGLE_CLIENT_ID',       // If Google OAuth is used
    'GOOGLE_CLIENT_SECRET',   // If Google OAuth is used
    // Cloudflare vars for Drizzle Kit are usually not needed directly by the deployed app
    // but by the CI/CD pipeline for migrations.
  ]
};

// These are typically secrets passed as environment variables in the CI/CD pipeline
const REQUIRED_SECRETS_FOR_CI = {
  production: [ // For production deployments/migrations via CI
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_D1_DATABASE_ID', // Specific D1 database ID for production migrations
    // Add other CI-specific secrets if needed
  ],
  preview: [ // For preview deployments/migrations via CI
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_D1_PREVIEW_DATABASE_ID', // Specific D1 database ID for preview migrations
  ]
};

async function loadDevVars() {
  const devVarsPath = path.join(__dirname, '../.dev.vars');
  try {
    await fs.access(devVarsPath);
    dotenv.config({ path: devVarsPath, override: false });
    console.log('✅ Loaded .dev.vars for development.');
  } catch (error) {
    // .dev.vars doesn't exist, warning will be handled later if in development.
  }
}

async function checkEnvironment() {
  const ENV = process.env.NODE_ENV || 'development';

  if (ENV === 'development') {
    await loadDevVars();
  }

  console.log(`🔍 Checking environment variables for ${ENV}...\n`);

  const errors = [];
  const warnings = [];

  const currentRequiredVars = REQUIRED_VARS[ENV] || REQUIRED_VARS.development;
  for (const varName of currentRequiredVars) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  if (process.env.CI) { // Checks for secrets if in a CI environment
    const ciEnvKey = ENV === 'production' ? 'production' : (ENV === 'preview' ? 'preview' : null);
    if (ciEnvKey && REQUIRED_SECRETS_FOR_CI[ciEnvKey]) {
      const currentRequiredSecrets = REQUIRED_SECRETS_FOR_CI[ciEnvKey];
      for (const secretName of currentRequiredSecrets) {
        if (!process.env[secretName]) {
          errors.push(`Missing required CI secret (should be set as environment variable): ${secretName}`);
        }
      }
    }
  }

  if (process.env.PUBLIC_APP_URL) {
    try {
      new URL(process.env.PUBLIC_APP_URL);
    } catch {
      errors.push('PUBLIC_APP_URL must be a valid URL (e.g., http://localhost:4321 or https://yourdomain.com)');
    }
  }

  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length < 32) {
    warnings.push('AUTH_SECRET is present but should be at least 32 characters long for security. Generate with: openssl rand -base64 32');
  }
  if (process.env.CSRF_SECRET && process.env.CSRF_SECRET.length < 32) {
    warnings.push('CSRF_SECRET is present but should be at least 32 characters long for security. Generate with: openssl rand -base64 32');
  }


  if (ENV === 'development') {
    try {
      await fs.access(path.join(__dirname, '../.dev.vars'));
    } catch {
      warnings.push('Local .dev.vars file not found. It is recommended for local development secrets. You can create it from .env.example.');
    }
  }

  if (errors.length > 0) {
    console.error('❌ Environment check failed:\n');
    errors.forEach(err => console.error(`   - ${err}`));
    if (warnings.length > 0) {
      console.warn('\n⚠️  Additionally, there are warnings:\n');
      warnings.forEach(warn => console.warn(`   - ${warn}`));
    }
    console.error('\nPlease check your environment configuration (e.g., .dev.vars for local, or CI/CD secrets for deployments).');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Environment check passed with warnings:\n');
    warnings.forEach(warn => console.warn(`   - ${warn}`));
  }

  console.log('✅ Environment check passed!');
}

checkEnvironment();