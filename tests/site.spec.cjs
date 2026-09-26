const { test, expect } = require('@playwright/test');

test('shared art is literal, not HTML', async ({ page }) => {
  const art = '<img src=x onerror="window.artExecuted=1">\n01';
  await page.goto('/?art=' + encodeURIComponent(Buffer.from(art).toString('base64')));
  await expect(page.locator('#output')).toHaveText(art);
  await expect(page.locator('#output img')).toHaveCount(0);
  expect(await page.evaluate(() => window.artExecuted)).toBeUndefined();
});

test('binary glyphs stay literal after worker render', async ({ page }) => {
  await page.goto('/');
  await page.locator('#modeSelect').selectOption('binary');
  const glyph = '<img src=x onerror="window.glyphExecuted=1">';
  await page.locator('#char0').fill(glyph);
  await page.locator('#char1').fill(glyph);
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = c.height = 1;
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#imageInput').setInputFiles({
    name: 'pixel.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64')
  });
  await expect(page.locator('#output')).toContainText(glyph);
  await expect(page.locator('#output img')).toHaveCount(0);
  expect(await page.evaluate(() => window.glyphExecuted)).toBeUndefined();
});
