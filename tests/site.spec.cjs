const { test, expect } = require('@playwright/test');

test('shared art is literal, not HTML', async ({ page }) => {
  const art = '<img src=x onerror="window.artExecuted=1">\n01';
  await page.goto('/?art=' + encodeURIComponent(Buffer.from(art).toString('base64')));
  await expect(page.locator('#output')).toHaveText(art);
  await expect(page.locator('#output img')).toHaveCount(0);
  expect(await page.evaluate(() => window.artExecuted)).toBeUndefined();
});
