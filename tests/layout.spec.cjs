const { test, expect } = require('@playwright/test');

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'phone-320', width: 320, height: 568 },
];

async function horizontalOverflow(page) {
  return page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function loadSampleArt(page) {
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#imageInput').setInputFiles({
    name: 'pixel.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64')
  });
  await page.waitForFunction(() => (document.getElementById('output').textContent || '').length > 0);
}

for (const vp of VIEWPORTS) {
  test(`no horizontal overflow at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');

    expect(await horizontalOverflow(page), 'empty state overflows').toBe(0);

    await loadSampleArt(page);
    expect(await horizontalOverflow(page), 'rendered art state overflows').toBe(0);

    await page.locator('#languageSelect').selectOption('ar');
    expect(await horizontalOverflow(page), 'RTL state overflows').toBe(0);
  });
}

test('interactive targets are at least 44px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');

  const check = () => page.evaluate(() => {
    const bad = [];
    const targets = document.querySelectorAll(
      'button, select, input:not([type="hidden"]), a[href], [tabindex="0"]');
    for (const el of targets) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue; // display:none
      const sel = el.id ? '#' + el.id : el.tagName.toLowerCase();
      if (r.height >= 44 && r.width >= 44) continue;
      // element may use an expanded pseudo-element hit area: probe 21px out
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const points = [[cx, cy - 21], [cx, cy + 21], [cx - 21, cy], [cx + 21, cy]];
      const hitsAll = points.every(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return hit && (hit === el || el.contains(hit));
      });
      if (!hitsAll) bad.push({ sel, w: Math.round(r.width), h: Math.round(r.height) });
    }
    return bad;
  });

  expect(await check(), 'ascii mode targets').toEqual([]);
  await page.locator('#modeSelect').selectOption('binary');
  expect(await check(), 'binary mode targets').toEqual([]);
});

test('keyboard focus is visible', async ({ page }) => {
  await page.goto('/');
  for (const id of ['#chooseImage', '#rotateBtn', '#modeSelect']) {
    await page.locator(id).focus();
    const outline = await page.locator(id).evaluate(el => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor };
    });
    expect(outline.style, `${id} outline style`).not.toBe('none');
    expect(outline.width, `${id} outline width`).toBeGreaterThanOrEqual(2);
    expect(outline.color, `${id} outline color`).not.toBe('transparent');
  }
});

test('choose button and art stage each center on their own line at desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const centers = () => page.evaluate(() => {
    const cx = sel => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return r.left + r.width / 2;
    };
    return { btn: cx('#chooseImage'), out: cx('#output'), w: document.documentElement.clientWidth };
  });
  let m = await centers();
  expect(Math.abs(m.btn - m.w / 2), 'button centered (empty state)').toBeLessThanOrEqual(2);
  await loadSampleArt(page);
  m = await centers();
  expect(Math.abs(m.btn - m.w / 2), 'button centered (art state)').toBeLessThanOrEqual(2);
  expect(Math.abs(m.out - m.w / 2), 'stage centered (art state)').toBeLessThanOrEqual(2);
});
