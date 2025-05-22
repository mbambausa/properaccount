// tests/integration/accounting.spec.ts
import { test, expect, type APIRequestContext } from '@playwright/test';
// Assuming you might test API endpoints directly for integration
// Or, you might import and test service layer functions that interact with D1

// Types from your application
import type { ChartOfAccountInput } from '../../src/types/accounting'; // Or from services
import type { DbChartOfAccount } from '../../src/db/schema'; // If comparing with DB representation

const TEST_USER_EMAIL = process.env.TEST_INTEGRATION_USER_EMAIL || 'accounting-tester@example.com';
const TEST_USER_PASSWORD = process.env.TEST_INTEGRATION_USER_PASSWORD || 'Password123!';
let apiContext: APIRequestContext;
let testUserId: string; // To be populated after login/user setup
let testEntityId: string; // To be populated after entity setup

test.beforeAll(async ({ playwright, baseURL }) => {
  // Perform UI login to get session state for API context
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseURL}/auth/signin`);
  await page.fill('input[name="email"]', TEST_USER_EMAIL);
  await page.fill('input[name="password"]', TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15000 });

  // Extract user ID from page or a global state if available, or assume known
  // For example, if user ID is in a data attribute or global JS variable:
  // testUserId = await page.evaluate(() => (window as any).currentUser?.id);
  // If not easily available, you might need an API endpoint to get current user info
  // For now, let's assume it's hardcoded or fetched if an endpoint exists.
  testUserId = process.env.TEST_INTEGRATION_USER_ID || 'known-test-user-id';

  apiContext = await playwright.request.newContext({
    baseURL: baseURL,
    storageState: await context.storageState(),
  });
  await browser.close();

  // Ensure a test entity exists for this user (or create one)
  // const entitiesResponse = await apiContext.get(`/api/entities?userId=${testUserId}`); // Fictional query param
  // const entities = await entitiesResponse.json();
  // if (entities.length > 0) {
  //   testEntityId = entities[0].id;
  // } else {
  //   const newEntity = await apiContext.post('/api/entities', { data: { name: 'Accounting Test Entity', type: 'company' }});
  //   testEntityId = (await newEntity.json()).id;
  // }
  testEntityId = process.env.TEST_INTEGRATION_ENTITY_ID || 'known-test-entity-id';

  if (!testUserId || !testEntityId) {
    console.warn("Skipping accounting integration tests: User/Entity ID not available.");
    test.skip(true, "User/Entity ID not available.");
  }
});

test.afterAll(async () => {
  if (apiContext) {
    await apiContext.dispose();
  }
});

test.describe('Chart of Accounts API Integration', () => {
  let createdAccountId: string;

  test('POST /api/accounts - should create a new account for the entity', async () => {
    const accountInput: ChartOfAccountInput = {
      entity_id: testEntityId, // Assuming your API links accounts to entities
      code: '9010-INT',
      name: 'Integration Test Expense Account',
      type: 'expense',
      is_active: true,
    };

    // The actual API endpoint might be /api/entities/{entityId}/accounts or /api/accounts with entity_id in payload
    const response = await apiContext.post(`/api/accounts`, { data: accountInput }); // Adjust endpoint as needed
    expect(response.ok(), `Failed to create account: ${await response.text()}`).toBe(true);
    const createdAccount: DbChartOfAccount = await response.json(); // Or your App-level Account type

    expect(createdAccount).toHaveProperty('id');
    createdAccountId = createdAccount.id;
    expect(createdAccount.code).toBe(accountInput.code);
    expect(createdAccount.name).toBe(accountInput.name);
    expect(createdAccount.type).toBe(accountInput.type);
    // Note: DbChartOfAccount uses 0/1 for booleans usually
    expect(createdAccount.is_active).toBe(accountInput.is_active ? 1 : 0);
  });

  test('GET /api/accounts - should retrieve accounts for the entity', async () => {
    expect(createdAccountId, "Created account ID needed for this test").toBeDefined();
    const response = await apiContext.get(`/api/accounts?entityId=${testEntityId}`); // Adjust endpoint/query
    expect(response.ok()).toBe(true);
    const accounts: DbChartOfAccount[] = await response.json();
    expect(Array.isArray(accounts)).toBe(true);
    const foundAccount = accounts.find(acc => acc.id === createdAccountId);
    expect(foundAccount).toBeDefined();
    expect(foundAccount?.name).toBe('Integration Test Expense Account');
  });

  // Add tests for GET by ID, PUT, DELETE for accounts
  // Add tests for Transaction creation, listing, details, update, void/delete
  // Ensure transactions correctly update (implicit) account balances if that's part of the system logic
});

test.describe('Transactions API Integration', () => {
  // Placeholder for transaction tests
  // - Create a transaction with multiple lines
  // - Ensure it's balanced
  // - Retrieve the transaction
  // - List transactions with filters (date, account, etc.)
  test.skip('Transaction tests not yet implemented', () => {});
});

// If you have a separate ledger service or balance calculation:
test.describe('Account Balance Verification', () => {
  // - After posting transactions, verify account balances are correct.
  // - This might involve calling a /api/accounts/{id}/balance endpoint or checking a report.
  test.skip('Account balance verification tests not yet implemented', () => {});
});
