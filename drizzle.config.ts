// drizzle.config.ts
import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import * as fs from 'node:fs'; // Using node:fs for fs.existsSync
import * as path from 'node:path'; // Using node:path

// Determine which .env file to load for Drizzle Kit (development tool)
// Prioritize .env, then .env.local.
// Drizzle Kit should ideally connect to a dev/preview D1 instance, not production.
let envFilePath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envFilePath)) {
  envFilePath = path.resolve(process.cwd(), '.env.local');
}

if (fs.existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath });
  console.log(`Drizzle Kit: Loaded environment variables from ${path.basename(envFilePath)}`);
} else {
  // If no .env or .env.local, Drizzle Kit will rely on globally set env vars or defaults.
  // Consider if a warning or error is appropriate if neither is found.
  console.warn(`Drizzle Kit: No .env or .env.local file found. Relying on system environment variables.`);
}

// Validate required environment variables for D1 HTTP driver
// These are needed for Drizzle Kit to communicate with the Cloudflare D1 API.
const requiredEnvVars: Array<'CLOUDFLARE_D1_DATABASE_ID' | 'CLOUDFLARE_ACCOUNT_ID' | 'CLOUDFLARE_API_TOKEN'> = [
  'CLOUDFLARE_D1_DATABASE_ID', // The ID of the D1 DB Drizzle Kit should introspect (e.g., your preview or dev DB ID)
  'CLOUDFLARE_ACCOUNT_ID',   // Your Cloudflare Account ID
  'CLOUDFLARE_API_TOKEN'     // A Cloudflare API Token with D1 permissions
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    // Provide more specific guidance to the user.
    throw new Error(
      `Drizzle Kit: Environment variable ${envVar} is not set. 
      Ensure it's defined in your ${path.basename(envFilePath)} file or as a system environment variable.
      This is required for Drizzle Kit to connect to your Cloudflare D1 database (usually a dev or preview instance).`
    );
  }
}

export default {
  dialect: 'sqlite', // D1 is SQLite compatible
  driver: 'd1-http', // Use D1 HTTP driver for Drizzle Kit to connect to Cloudflare D1
  schema: './cloudflare/d1/schema.ts', // Path to your Drizzle schema file
  out: './cloudflare/d1/migrations',   // Directory to output migration files

  // Credentials for Drizzle Kit to connect to Cloudflare D1 via the API.
  // IMPORTANT: These should point to a D1 database instance intended for development/schema introspection,
  // typically your PREVIEW or a dedicated DEV database, NOT your production database.
  dbCredentials: {
    databaseId: process.env['CLOUDFLARE_D1_DATABASE_ID']!, // Target D1 DB ID for Drizzle Kit
    accountId: process.env['CLOUDFLARE_ACCOUNT_ID']!,     // Your Cloudflare Account ID
    token: process.env['CLOUDFLARE_API_TOKEN']!,          // Cloudflare API Token
  },
  verbose: true, // Enable verbose logging from Drizzle Kit
  strict: true   // Enable strict mode for Drizzle Kit
} satisfies Config;