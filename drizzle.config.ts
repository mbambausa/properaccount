// drizzle.config.ts
import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local for local development
const envFile = process.env['NODE_ENV'] === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Validate required environment variables
const requiredEnvVars = [
  'CLOUDFLARE_D1_DATABASE_ID',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} is not set. Check your ${envFile} file.`);
  }
}

export default {
  dialect: 'sqlite',
  driver: 'd1-http',
  schema: './cloudflare/d1/schema.ts',
  out: './cloudflare/d1/migrations',
  dbCredentials: {
    databaseId: process.env['CLOUDFLARE_D1_DATABASE_ID']!,
    accountId: process.env['CLOUDFLARE_ACCOUNT_ID']!,
    token: process.env['CLOUDFLARE_API_TOKEN']!,
  },
  verbose: true,
  strict: true
} satisfies Config;