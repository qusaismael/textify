const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const html = readFileSync(require.resolve('../index.html'), 'utf8');
const main = readFileSync(require.resolve('../main.js'), 'utf8');

test('image picker exposes a native keyboard button connected to the file input', () => {
  assert.match(html, /<button\b[^>]*type="button"[^>]*id="chooseImage"[^>]*>Choose image<\/button>/);
  assert.match(main, /getElementById\(['"]chooseImage['"]\)\.addEventListener\(['"]click['"],\s*\(\)\s*=>\s*imageInput\.click\(\)\)/);
});

test('preview filename is inserted as text, never parsed as HTML', () => {
  const previewCode = main.slice(main.indexOf('function handleImage(file) {'), main.indexOf('/**\n * Regenerates', main.indexOf('function handleImage(file) {')));
  assert.doesNotMatch(previewCode, /preview\.innerHTML\s*=/);
  assert.match(previewCode, /document\.createTextNode\(`\$\{file\.name\}/);
  assert.match(previewCode, /dragDropArea\.replaceChildren\(preview\)/);
});

test('file removal restores the original localized drop hint markup', () => {
  const removal = main.slice(main.indexOf("remove.addEventListener('click'"), main.indexOf('const imgURL'));
  assert.doesNotMatch(removal, /dragDropArea\.textContent\s*=/);
  assert.match(main, /dragDropArea\.cloneNode\(true\)/, 'capture a hint template at load');
  assert.match(removal, /dragDropArea\.replaceChildren\(\.\.\./, 'restore from template children');
});
