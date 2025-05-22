// tests/e2e/transactions.spec.ts
import { test, expect, type Page } from '@playwright/test';

// Helper function to log in before each test
async function login(page: Page, email?: string, password?: string) {
  await page.goto('/auth/signin');
  await page.fill('input[name="email"]', email || process.env.TEST_USER_EMAIL || 'testuser@example.com');
  await page.fill('input[name="password"]', password || process.env.TEST_USER_PASSWORD || 'Password123!');
  await page.getByRole('button', { name: /Sign In|Login/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 10000 });
}

test.describe('Transaction Management', () => {
  // Pre-requisites:
  // 1. A test user should exist.
  // 2. At least one entity should exist for the test user.
  // 3. Chart of accounts should be initialized for the entity, with known accounts.
  // These could be set up in a global setup file or at the beginning of this describe block.

  let testEntityId: string; // Assume this is fetched or known
  let cashAccountId: string; // Assume this is known from CoA
  let expenseAccountId: string; // Assume this is known from CoA

  test.beforeAll(async ({ browser }) => {
    // This block could be used to set up a test user, entity, and accounts via API
    // For simplicity, we'll assume they exist or are created by other test suites.
    // Example:
    // const context = await browser.newContext();
    // const page = await context.newPage();
    // await login(page, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD); // Admin to setup
    // testEntityId = await createTestEntity(page, 'Transaction Test Entity');
    // const accounts = await getAccountsForEntity(page, testEntityId);
    // cashAccountId = accounts.find(acc => acc.code === '1010').id; // Example
    // expenseAccountId = accounts.find(acc => acc.code === '6050').id; // Example
    // await page.close();

    // Hardcode for now if setup is manual or outside this test
    testEntityId = process.env.TEST_ENTITY_ID || 'default-entity-id-for-tx-tests';
    cashAccountId = process.env.TEST_CASH_ACCOUNT_ID || 'cash-account-id';
    expenseAccountId = process.env.TEST_EXPENSE_ACCOUNT_ID || 'expense-account-id';

    if (!testEntityId || !cashAccountId || !expenseAccountId) {
      console.warn('Skipping transaction tests: Test entity/account IDs not available.');
      test.skip(true, 'Test entity/account IDs not available.');
    }
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    // Navigate to the transactions page for the test entity
    // The URL might depend on your routing structure (e.g., query param or path param for entityId)
    await page.goto(`/app/transactions?entityId=${testEntityId}`); // Example URL
    await expect(page.locator('h1')).toContainText(/Transactions/i);
  });

  test('should display the transactions list for an entity', async ({ page }) => {
    // Check for elements that indicate the transaction list is present
    // e.g., a table, a list container, or specific column headers
    await expect(page.locator('table#transactions-table')).toBeVisible(); // Assuming a table with this ID
    await expect(page.getByRole('button', { name: /New Transaction/i })).toBeVisible();
  });

  test('should allow creating a new simple expense transaction', async ({ page }) => {
    await page.getByRole('button', { name: /New Transaction/i }).click();
    await expect(page).toHaveURL(new RegExp(`/app/transactions/new(\?entityId=${testEntityId})?`));

    // Fill out the transaction form
    // These selectors depend heavily on your TransactionForm.astro component
    await page.fill('textarea[name="description"]', 'Office Supplies Purchase E2E');
    await page.fill('input[name="date"]', new Date().toISOString().split('T')[0]); // Today's date

    // Line 1: Debit Expense Account
    await page.locator('button#add-line-item').click(); // Assuming a button to add lines
    const firstLine = page.locator('.transaction-line').first();
    await firstLine.locator('select[name^="lines."][name$=".accountId"]').selectOption(expenseAccountId);
    await firstLine.locator('input[name^="lines."][name$=".debitAmount"]').fill('50.00');
    // await firstLine.locator('input[name^="lines."][name$=".creditAmount"]').fill('0'); // Or ensure it's empty

    // Line 2: Credit Cash Account
    await page.locator('button#add-line-item').click();
    const secondLine = page.locator('.transaction-line').nth(1);
    await secondLine.locator('select[name^="lines."][name$=".accountId"]').selectOption(cashAccountId);
    // await secondLine.locator('input[name^="lines."][name$=".debitAmount"]').fill('0'); // Or ensure it's empty
    await secondLine.locator('input[name^="lines."][name$=".creditAmount"]').fill('50.00');

    await page.getByRole('button', { name: /Save Transaction|Create Transaction/i }).click();

    // Expect redirection to transaction list or detail page with a success message
    await expect(page).toHaveURL(new RegExp(`/app/transactions(\?entityId=${testEntityId}&success=true)?`));
    await expect(page.locator('text=Office Supplies Purchase E2E')).toBeVisible(); // Check if it appears in the list
    await expect(page.locator('text=50.00')).toBeVisible();
  });

  test('should validate that debits and credits balance', async ({ page }) => {
    await page.getByRole('button', { name: /New Transaction/i }).click();

    await page.fill('textarea[name="description"]', 'Unbalanced Test E2E');
    await page.fill('input[name="date"]', new Date().toISOString().split('T')[0]);

    // Line 1: Debit Expense Account
    await page.locator('button#add-line-item').click();
    const firstLine = page.locator('.transaction-line').first();
    await firstLine.locator('select[name^="lines."][name$=".accountId"]').selectOption(expenseAccountId);
    await firstLine.locator('input[name^="lines."][name$=".debitAmount"]').fill('100.00');

    // Line 2: Credit Cash Account (with different amount)
    await page.locator('button#add-line-item').click();
    const secondLine = page.locator('.transaction-line').nth(1);
    await secondLine.locator('select[name^="lines."][name$=".accountId"]').selectOption(cashAccountId);
    await secondLine.locator('input[name^="lines."][name$=".creditAmount"]').fill('50.00');

    await page.getByRole('button', { name: /Save Transaction|Create Transaction/i }).click();

    // Expect an error message about unbalanced transaction
    const errorMessage = page.locator('[role="alert"]', { hasText: /Debits and credits must balance/i })
                               .or(page.locator('.error-message', { hasText: /Debits and credits must balance/i }));
    await expect(errorMessage).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/app/transactions/new`)); // Should stay on the form
  });

  // Add more tests:
  // - Viewing a transaction's details
  // - Editing an existing transaction
  // - Voiding/deleting a transaction
  // - Filtering transactions (by date, status, account)
  // - Pagination if the list is long
  // - Transactions with more than two lines
  // - Transactions involving different types (income, transfers)
});
