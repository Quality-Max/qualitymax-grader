const { test } = require('playwright');

test('navigate around the site', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.fill('#user-name', 'standard_user');
  await page.fill('#password', 'secret_sauce');
  await page.click('#login-button');

  // No assertions at all, just navigation
  await page.waitForTimeout(3000);
  await page.click('.inventory_item:first-child');
  await page.waitForTimeout(1000);
  await page.goBack();
});
