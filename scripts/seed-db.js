// scripts/seed-db.js
import { exec } from 'child_process';
import { promisify } from 'util';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs'; // Using bcryptjs for seeding simplicity
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV = process.env.NODE_ENV || 'development'; // Seeding is typically for development

async function executeSql(sqlStatements) {
  const tempFile = path.join(__dirname, `temp-seed-${nanoid(8)}.sql`);
  await fs.writeFile(tempFile, sqlStatements);
  console.log(`   Executing SQL batch from ${tempFile}...`);

  try {
    // Note: For local development, wrangler d1 execute DATABASE --local --file="..." is used.
    // This script is primarily intended for local development seeding.
    const command = `wrangler d1 execute DATABASE --local --file="${tempFile}"`;
    const { stdout, stderr } = await execAsync(command);

    if (stderr) {
      // D1 often outputs benign messages to stderr (like "Executed X statements").
      // We log it as a warning for review, but don't fail unless an error occurs.
      console.warn(`   Wrangler stderr: ${stderr.trim()}`);
    }
    // stdout might contain results for SELECT statements if any were in the batch,
    // but for INSERT/UPDATE/DELETE, it's usually minimal or empty.
    // if (stdout) console.log(`   Wrangler stdout: ${stdout.trim()}`);

  } catch (error) {
    // execAsync throws on non-zero exit code, which indicates a true error
    console.error(`❌ Error executing SQL batch from ${tempFile}:`);
    if (error.stderr) console.error(`   Stderr: ${error.stderr.trim()}`);
    if (error.stdout) console.error(`   Stdout: ${error.stdout.trim()}`);
    if (!error.stderr && !error.stdout) console.error(`   Error: ${error.message}`);
    throw error; // Re-throw to be caught by seedDatabase
  } finally {
    await fs.unlink(tempFile).catch(err => console.warn(`Could not delete temp file ${tempFile}: ${err.message}`));
  }
}

async function seedDatabase() {
  if (ENV !== 'development') {
    console.warn(`⚠️  Skipping database seed. Seeding is typically for 'development' environment only. Current NODE_ENV: ${ENV}`);
    return;
  }
  console.log(`🌱 Seeding database for ${ENV} environment...`);

  try {
    const now = Math.floor(Date.now() / 1000); // Unix epoch seconds

    // --- 1. Create Demo User ---
    const userId = nanoid();
    // Note: Using bcryptjs for seed script simplicity.
    // If your main app uses Argon2 (@node-rs/argon2), be aware of the difference.
    // For production, user passwords should always be hashed with a strong, modern algorithm like Argon2.
    const hashedPassword = await bcrypt.hash('demo123', 10); // Salt rounds for bcrypt
    const userSql = `
INSERT INTO users (id, email, name, password_hash, role, verified_at, created_at, updated_at, image_url)
VALUES ('${userId}', 'demo@properaccount.com', 'Demo User', '${hashedPassword}', 'user', ${now}, ${now}, ${now}, 'https://example.com/avatar/demo.png');
    `;
    await executeSql(userSql);
    console.log('✅ Created demo user (demo@properaccount.com / demo123)');

    // --- 2. Create Chart of Accounts ---
    // (Schema: id, user_id, code, name, type, subtype, description, is_recoverable, recovery_percentage, is_active, tax_category, parent_id, created_at, updated_at)
    const sampleAccounts = [
      { id: nanoid(), code: '1000', name: 'Cash & Bank', type: 'asset', subtype: 'Current Asset' },
      { id: nanoid(), code: '1100', name: 'Accounts Receivable', type: 'asset', subtype: 'Current Asset' },
      { id: nanoid(), code: '1200', name: 'Rental Property Deposits Held', type: 'asset', subtype: 'Current Asset' },
      { id: nanoid(), code: '1500', name: 'Buildings at Cost', type: 'asset', subtype: 'Fixed Asset' },
      { id: nanoid(), code: '1510', name: 'Accumulated Depreciation - Buildings', type: 'asset', subtype: 'Contra Asset (Fixed)' },
      { id: nanoid(), code: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'Current Liability' },
      { id: nanoid(), code: '2100', name: 'Tenant Security Deposits Liability', type: 'liability', subtype: 'Current Liability' },
      { id: nanoid(), code: '2500', name: 'Mortgage Payable', type: 'liability', subtype: 'Long-term Liability' },
      { id: nanoid(), code: '3000', name: "Owner's Capital Contributions", type: 'equity', subtype: 'Owners Equity' },
      { id: nanoid(), code: '3100', name: 'Retained Earnings', type: 'equity', subtype: 'Owners Equity' },
      { id: nanoid(), code: '4000', name: 'Rental Income', type: 'income', subtype: 'Operating Income' },
      { id: nanoid(), code: '4100', name: 'Late Fee Income', type: 'income', subtype: 'Other Income' },
      { id: nanoid(), code: '5000', name: 'Property Management Fees', type: 'expense', subtype: 'Operating Expense' },
      { id: nanoid(), code: '5100', name: 'Repairs & Maintenance', type: 'expense', subtype: 'Operating Expense' },
      { id: nanoid(), code: '5200', name: 'Property Taxes', type: 'expense', subtype: 'Operating Expense' },
      { id: nanoid(), code: '5500', name: 'Depreciation Expense', type: 'expense', subtype: 'Non-cash Expense' },
      { id: nanoid(), code: '5600', name: 'Mortgage Interest Expense', type: 'expense', subtype: 'Financing Expense' },
    ];

    let coaSql = 'INSERT INTO chart_of_accounts (id, user_id, code, name, type, subtype, is_active, created_at, updated_at) VALUES\n';
    coaSql += sampleAccounts.map(acc =>
      `('${acc.id}', '${userId}', '${acc.code}', '${acc.name.replace(/'/g, "''")}', '${acc.type}', '${acc.subtype || ''}', 1, ${now}, ${now})`
    ).join(',\n') + ';';
    await executeSql(coaSql);
    console.log(`✅ Created ${sampleAccounts.length} chart of accounts for demo user`);

    // --- 3. Create Sample Entities ---
    // (Schema: id, user_id, name, legal_name, ein, address, legal_address, business_type, parent_id, is_active, allows_sub_entities, created_at, updated_at)
    const mainEntityId = nanoid();
    const property1Id = nanoid();
    const address1 = JSON.stringify({ street1: '123 Main St', city: 'Anytown', state: 'CA', postalCode: '90210', country: 'US' }).replace(/'/g, "''");
    const address2 = JSON.stringify({ street1: '456 Oak Ave', city: 'Anytown', state: 'CA', postalCode: '90210', country: 'US' }).replace(/'/g, "''");

    const entitiesSql = `
INSERT INTO entities (id, user_id, name, legal_name, business_type, address, is_active, allows_sub_entities, created_at, updated_at) VALUES
  ('${mainEntityId}', '${userId}', 'My Real Estate Holdings LLC', 'My Real Estate Holdings Limited Liability Company', 'LLC', '${address1}', 1, 1, ${now}, ${now}),
  ('${property1Id}', '${userId}', 'Oak Street Property', 'Oak Street Property', 'Property', '${address2}', 1, 0, ${now}, ${now});

UPDATE entities SET parent_id = '${mainEntityId}' WHERE id = '${property1Id}';
    `;
    await executeSql(entitiesSql);
    console.log('✅ Created sample entities (Holding LLC and one Property)');

    // --- 4. Link Chart of Accounts to Main Entity (EntityAccounts) ---
    // (Schema: id, user_id, entity_id, account_id, custom_name, is_active, recovery_type, recovery_percentage, created_at, updated_at)
    let entityAccountsSql = 'INSERT INTO entity_accounts (id, user_id, entity_id, account_id, is_active, created_at, updated_at) VALUES\n';
    entityAccountsSql += sampleAccounts.map(acc =>
      `('${nanoid()}', '${userId}', '${mainEntityId}', '${acc.id}', 1, ${now}, ${now})`
    ).join(',\n') + ';';
    await executeSql(entityAccountsSql);
    console.log(`✅ Linked ${sampleAccounts.length} accounts to the main entity`);

    // --- 5. Create Sample Journal ---
    // (Schema: id, user_id, entity_id, name, description, created_at, updated_at)
    const journalId = nanoid();
    const journalSql = `
INSERT INTO journals (id, user_id, entity_id, name, description, created_at, updated_at) VALUES
  ('${journalId}', '${userId}', '${mainEntityId}', 'General Journal', 'Main operational journal', ${now}, ${now});
    `;
    await executeSql(journalSql);
    console.log('✅ Created sample journal');

    // --- Add more seed data as needed (transactions, etc.) ---

    console.log('\n🎉 Database seeding completed successfully for development!');
    console.log('   You can log in with:');
    console.log('   Email: demo@properaccount.com');
    console.log('   Password: demo123');

  } catch (error) {
    console.error('❌ Database seeding failed:', error.message);
    // Further error details might have been logged by executeSql
    process.exit(1);
  }
}

seedDatabase();