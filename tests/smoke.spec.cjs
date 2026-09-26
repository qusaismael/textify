const { test, expect } = require('@playwright/test');
test('home serves a heading', async ({ page }) => {
  const response = await page.goto('/');
  expect(response.status()).toBe(200);
  await expect(page.locator('h1').first()).toBeVisible();
});
