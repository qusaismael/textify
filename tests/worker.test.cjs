const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

test('binary glyphs stay literal in worker output for both dark and light pixels', () => {
  const messages = [];
  const self = { postMessage(message) { messages.push(message); } };
  vm.runInNewContext(readFileSync(require.resolve('../worker.js'), 'utf8'), { self });
  const glyph = '<img src=x onerror="window.glyphExecuted=1">';
  for (const brightness of [0, 255]) {
    self.onmessage({ data: {
      imageData: { data: Uint8ClampedArray.from([brightness, brightness, brightness, 255]) },
      width: 1, height: 1, mode: 'binary', threshold: 128,
      char0: glyph, char1: glyph, col0: '#000000', col1: '#ffffff',
      brightness: 0, contrast: 0
    } });
  }
  assert.equal(messages.length, 2);
  for (const { htmlOutput, rawTextOutput } of messages) {
    assert.equal(rawTextOutput, glyph + '\n');
    assert.ok(htmlOutput.includes('&lt;img src=x onerror=&quot;window.glyphExecuted=1&quot;&gt;'), htmlOutput);
    assert.ok(!htmlOutput.includes('<img'), htmlOutput);
  }
});

test('worker color parameters cannot break out of the style attribute', () => {
  const messages = [];
  const self = { postMessage(message) { messages.push(message); } };
  vm.runInNewContext(readFileSync(require.resolve('../worker.js'), 'utf8'), { self });
  self.onmessage({ data: {
    imageData: { data: Uint8ClampedArray.from([0, 0, 0, 255]) },
    width: 1, height: 1, mode: 'binary', threshold: 128,
    char0: '#', char1: '#',
    col0: '#000000" onload="alert(1)', col1: '"><script>alert(1)</script>',
    brightness: 0, contrast: 0
  } });
  const html = messages[0].htmlOutput;
  assert.ok(!html.includes('onload='), 'attribute breakout must be neutralized');
  assert.ok(!html.includes('<script>'), 'tag breakout must be neutralized');
  assert.match(html, /style="color:[^"]+"/, 'style value stays one attribute value');
});
