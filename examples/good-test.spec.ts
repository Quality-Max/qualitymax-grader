import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test('should complete a full checkout with two items', async ({ page }) => {
    await test.step('Navigate to login page', async () => {
      await page.goto('https://www.saucedemo.com/');
      await page.locator('[data-test="username"]').fill('standard_user');
      await page.locator('[data-test="password"]').fill('secret_sauce');
      await page.locator('[data-test="login-button"]').click();
      await expect(page.locator('[data-test="inventory-container"]')).toBeVisible();
    });

    await test.step('Add items to cart', async () => {
      await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
      await page.locator('[data-test="add-to-cart-sauce-labs-bike-light"]').click();
      await expect(page.locator('[data-test="shopping-cart-badge"]')).toHaveText('2');
    });

    await test.step('Navigate to cart and verify items', async () => {
      await page.locator('[data-test="shopping-cart-link"]').click();
      await expect(page.locator('[data-test="inventory-item"]')).toHaveCount(2);
      await page.locator('[data-test="checkout"]').click();
    });

    await test.step('Fill checkout information', async () => {
      await page.locator('[data-test="firstName"]').fill('Test');
      await page.locator('[data-test="lastName"]').fill('User');
      await page.locator('[data-test="postalCode"]').fill('12345');
      await page.locator('[data-test="continue"]').click();
    });

    await test.step('Verify checkout overview and finish', async () => {
      await expect(page.locator('[data-test="payment-info-value"]')).toBeVisible();
      await expect(page.locator('[data-test="shipping-info-value"]')).toBeVisible();
      await expect(page.locator('[data-test="total-label"]')).toBeVisible();
      await page.locator('[data-test="finish"]').click();
      await expect(page.locator('[data-test="complete-header"]')).toHaveText('Thank you for your order!');
    });
  });
});
