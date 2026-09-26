const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const source = readFileSync(require.resolve('../main.js'), 'utf8');
function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  return source.slice(start, source.indexOf('\n/**', start));
}

test('uploaded image object URL is revoked on load, error, and oversize', () => {
  for (const outcome of ['load', 'error', 'oversize']) {
    const revoked = [];
    const images = [];
    class FakeImage {
      constructor() { this.width = outcome === 'oversize' ? 2001 : 1; this.height = 1; images.push(this); }
    }
    const element = () => ({ append() {}, setAttribute() {}, addEventListener() {}, replaceChildren() {} });
    const context = {
      document: { createElement: element, createTextNode: value => ({ textContent: value }) },
      dragDropArea: element(), output: element(),
      URL: { createObjectURL: () => 'blob:image', revokeObjectURL: url => revoked.push(url) },
      Image: FakeImage, MAX_IMAGE_WIDTH: 2000, MAX_IMAGE_HEIGHT: 2000,
      showToast() {}, saveCurrentState() {}, regenerateArtIfPossible() {}
    };
    vm.runInNewContext(`let storedImage = null; let rotationAngle = 0; ${functionSource('handleImage')}`, context);
    context.handleImage({ name: 'pixel.png', size: 68 });
    assert.deepEqual(revoked, [], 'must not revoke before decode');
    if (outcome === 'error') images[0].onerror(); else images[0].onload();
    assert.deepEqual(revoked, ['blob:image'], `${outcome} path leaked an object URL`);
  }
});

test('text download revokes its object URL after click', () => {
  const events = [];
  const timers = [];
  const link = { click() { events.push('click'); } };
  const context = {
    Blob: class {},
    document: { createElement: () => link },
    URL: {
      createObjectURL: () => 'blob:text',
      revokeObjectURL: url => events.push(`revoke:${url}`)
    },
    setTimeout: callback => timers.push(callback),
    showToast() {}
  };
  vm.runInNewContext(functionSource('downloadAsText'), context);
  context.downloadAsText('01');
  assert.deepEqual(events, ['click']);
  for (const callback of timers) callback();
  assert.deepEqual(events, ['click', 'revoke:blob:text']);
});
