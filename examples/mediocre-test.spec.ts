import { test, expect } from '@playwright/test';

test('login and check products', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');

  // No test.step blocks, weak selectors
  await page.getByRole('textbox', { name: 'Username' }).fill('standard_user');
  await page.getByRole('textbox', { name: 'Password' }).fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();

  // Only one assertion
  await expect(page).toHaveURL(/inventory/);

  // Uses waitForTimeout anti-pattern
  await page.waitForTimeout(2000);

  await page.getByText('Sauce Labs Backpack').click();
  await page.getByRole('button', { name: 'Add to cart' }).click();
});
