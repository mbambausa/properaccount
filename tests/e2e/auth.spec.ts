// tests/e2e/auth.spec.ts
import { test, expect, type Page } from '@playwright/test';

test.describe('Authentication Flows', () => {
  const uniqueUserEmail = () => `testuser-${Date.now()}@example.com`;
  const testPassword = 'Password123!';

  test.beforeEach(async ({ page }) => {
    await page.goto('/'); // Adjust if your auth pages are elsewhere
  });

  test('should navigate to signin page from homepage if not logged in', async ({ page }) => {
    // This test assumes a link or redirect to signin from the homepage
    // For example, if homepage has a "Sign In" button:
    // await page.getByRole('link', { name: 'Sign In' }).click();
    // Or if it automatically redirects:
    await page.goto('/auth/signin'); // Direct navigation for simplicity
    await expect(page).toHaveURL(/\/auth\/signin/);
    await expect(page.locator('h1')).toContainText(/Sign In|Login/i);
  });

  test('should allow a new user to sign up', async ({ page }) => {
    const email = uniqueUserEmail();
    await page.goto('/auth/signup'); // Assuming a signup page exists

    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="confirm_password"]', testPassword);
    // await page.check('input[name="accept_terms"]'); // If you have a terms checkbox

    await page.getByRole('button', { name: /Sign Up|Register/i }).click();

    // Expect redirection to signin page or a success message/dashboard
    await expect(page).toHaveURL(/\/auth\/signin|\/app\/dashboard/);
    // Optional: Check for a success toast/message if applicable
  });

  test('should allow an existing user to sign in and sign out', async ({ page }) => {
    // Pre-requisite: Create a user first for this test to be reliable
    const email = uniqueUserEmail();
    // Simplified signup directly or use a helper function if complex
    await page.goto('/auth/signup');
    await page.fill('input[name="name"]', 'Login Test User');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="confirm_password"]', testPassword);
    await page.getByRole('button', { name: /Sign Up|Register/i }).click();
    await expect(page).toHaveURL(/\/auth\/signin|\/app\/dashboard/); // Wait for signup to complete

    // Now attempt to sign in
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', testPassword);
    await page.getByRole('button', { name: /Sign In|Login/i }).click();

    // Expect redirection to a protected area, e.g., dashboard
    await expect(page).toHaveURL(/\/app\/dashboard/);
    await expect(page.locator('h1')).toContainText(/Dashboard/i); // Or other dashboard content

    // Sign out
    // Assuming a signout button/link is available on the dashboard
    // This selector will depend heavily on your UI
    const signOutButton = page.getByRole('button', { name: /Sign Out|Logout/i })
                           .or(page.getByRole('link', { name: /Sign Out|Logout/i }));
    await expect(signOutButton).toBeVisible();
    await signOutButton.click();

    // Expect redirection to signin page or homepage
    await expect(page).toHaveURL(/\/auth\/signin|\//);
  });

  test('should show error for invalid signin credentials', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.getByRole('button', { name: /Sign In|Login/i }).click();

    // Expect an error message to be displayed on the page
    // This selector depends on how your app shows errors (e.g., an alert div)
    const errorMessage = page.locator('[role="alert"]', { hasText: /Invalid credentials|Incorrect email or password/i })
                           .or(page.locator('.error-message', { hasText: /Invalid credentials|Incorrect email or password/i }));
    await expect(errorMessage).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/signin/); // Should remain on signin page
  });

  // Add more tests:
  // - Password reset flow
  // - Email verification flow (if applicable)
  // - OAuth provider logins (Google, GitHub, etc.) if implemented
  // - Input validation on forms (e.g., invalid email format)
});
