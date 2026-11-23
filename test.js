const assert = require('assert');
const fs = require('fs');
const { dict, scaleRect } = require('./i18n.js');

// both languages have exactly the same keys
const ar = Object.keys(dict.ar).sort(), en = Object.keys(dict.en).sort();
assert.deepStrictEqual(ar, en, 'ar/en key mismatch');

// every key used in the HTML exists
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
for (const [, k] of html.matchAll(/data-i18n(?:-ph)?="([^"]+)"/g)) assert.ok(dict.ar[k], 'missing key ' + k);
// every t('key') in the renderer exists
const js = fs.readFileSync(__dirname + '/renderer.js', 'utf8');
for (const [, k] of js.matchAll(/\bt\('([^']+)'\)/g)) assert.ok(dict.ar[k], 'missing key ' + k);
// ...and in the video studio
const studio = fs.readFileSync(__dirname + '/studio.js', 'utf8');
for (const [, k] of studio.matchAll(/\bt\('([^']+)'\)/g)) assert.ok(dict.en[k], 'missing key ' + k);

// 150% DPI: 1280 DIP display -> 1920 px video
assert.deepStrictEqual(scaleRect({ x: 100, y: 50, width: 301, height: 201 }, 1280, 1920, 1080),
  { x: 150, y: 75, width: 450, height: 300 });
// region running off the edge is clamped and kept even
assert.deepStrictEqual(scaleRect({ x: 1200, y: 700, width: 500, height: 500 }, 1280, 1280, 720),
  { x: 1200, y: 700, width: 80, height: 20 });
// hotkey capture (e.code based, so an Arabic layout still gives "1"/"R")
const { codeToAccel, prettyAccel } = require('./i18n.js');
const k = (code, m = {}) => codeToAccel({ code, ctrlKey: !!m.c, altKey: !!m.a, shiftKey: !!m.s });
assert.strictEqual(k('Digit1', { c: 1, a: 1 }), 'CommandOrControl+Alt+1');
assert.strictEqual(k('KeyR', { c: 1, s: 1 }), 'CommandOrControl+Shift+R');
assert.strictEqual(k('PrintScreen'), 'PrintScreen');
assert.strictEqual(k('F9'), 'F9');
assert.strictEqual(k('KeyA'), null);          // bare letter refused
assert.strictEqual(k('ControlLeft', { c: 1 }), ''); // modifiers only: keep waiting
assert.strictEqual(prettyAccel('CommandOrControl+Alt+1'), 'Ctrl+Alt+1');
console.log('ok');
