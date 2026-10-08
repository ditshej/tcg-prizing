import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { THEMES, nextTheme, readTheme, writeTheme, applyTheme, themeToggle } from '../public/ui/theme.mjs';

/**
 * The mode switch (#144, ADR 0011): System → light → dark, remembered in the
 * browser and never in the `SetupLink`. The choice is device state; a
 * storage that throws (Safari private mode, storage disabled) is System, not
 * an error — the app stays a total function in spirit (ADR 0002).
 */

/** A `localStorage` stand-in: a map, or one that throws on every touch. */
function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    get size() { return data.size; },
  };
}

const throwingStorage = {
  getItem() { throw new DOMException('denied', 'SecurityError'); },
  setItem() { throw new DOMException('denied', 'QuotaExceededError'); },
  removeItem() { throw new DOMException('denied', 'SecurityError'); },
};

/** The `<html>` element as far as the mode touches it. */
function fakeRoot() {
  return { dataset: {} };
}

test('the order is System → light → dark, and back to System', () => {
  assert.deepEqual(THEMES, ['system', 'light', 'dark']);
  assert.equal(nextTheme('system'), 'light');
  assert.equal(nextTheme('light'), 'dark');
  assert.equal(nextTheme('dark'), 'system');
});

test('nothing stored, or anything unknown, reads as System', () => {
  assert.equal(readTheme(memoryStorage()), 'system');
  assert.equal(readTheme(memoryStorage({ theme: 'sepia' })), 'system');
});

test('a choice written is the choice read', () => {
  const storage = memoryStorage();
  for (const theme of ['light', 'dark', 'system']) {
    writeTheme(storage, theme);
    assert.equal(readTheme(storage), theme);
  }
});

test('System is stored as nothing at all', () => {
  const storage = memoryStorage();
  writeTheme(storage, 'dark');
  writeTheme(storage, 'system');
  assert.equal(storage.size, 0);
});

test('a storage that throws reads as System and swallows the write', () => {
  assert.equal(readTheme(throwingStorage), 'system');
  assert.doesNotThrow(() => writeTheme(throwingStorage, 'dark'));
  assert.equal(readTheme(undefined), 'system');
});

test('the root carries data-theme for a forced mode and none for System', () => {
  const root = fakeRoot();
  applyTheme(root, 'dark');
  assert.equal(root.dataset.theme, 'dark');
  applyTheme(root, 'light');
  assert.equal(root.dataset.theme, 'light');
  applyTheme(root, 'system');
  assert.equal('theme' in root.dataset, false);
});

/*
 * The boot step: a classic inline script in `<head>` of `views/shell.php`,
 * which runs while the head is parsed — before the first paint, where a
 * module script or an Alpine `init` would be too late. It cannot import
 * `theme.mjs`, so it is run here as it stands, against what `writeTheme()`
 * left behind: the two must agree on the key and the values.
 */
const SHELL = readFileSync(new URL('../views/shell.php', import.meta.url), 'utf8');
const head = SHELL.slice(SHELL.indexOf('<head>'), SHELL.indexOf('</head>'));
const bootScripts = [...head.matchAll(/<script>([^]*?)<\/script>/g)].map(([, body]) => body);

function boot(storage) {
  const root = fakeRoot();
  const context = { document: { documentElement: root } };
  Object.defineProperty(context, 'localStorage', {
    get() { if (storage === 'denied') throw new DOMException('denied', 'SecurityError'); return storage; },
  });
  vm.runInNewContext(bootScripts[0], context);
  return root;
}

test('the shell applies the stored choice in <head>, synchronously, beside the stylesheet', () => {
  assert.equal(bootScripts.length, 1, 'one inline classic script in <head>');
  const tags = head.match(/<link rel="stylesheet"[^>]*>|<script>/g);
  assert.deepEqual(tags, ['<link rel="stylesheet" href="/ui/plan.css">', '<script>'], 'right after the stylesheet');
  for (const theme of ['light', 'dark']) {
    const storage = memoryStorage();
    writeTheme(storage, theme);
    assert.equal(boot(storage).dataset.theme, theme);
  }
});

test('the shell leaves System alone, and survives a storage that throws', () => {
  assert.equal('theme' in boot(memoryStorage()).dataset, false);
  assert.equal('theme' in boot(memoryStorage({ theme: 'sepia' })).dataset, false);
  assert.equal('theme' in boot(throwingStorage).dataset, false);
  assert.equal('theme' in boot('denied').dataset, false, 'even reading window.localStorage throws');
});

test('the toggle steps through the modes, applies and remembers each', () => {
  const storage = memoryStorage();
  const root = fakeRoot();
  const toggle = themeToggle({ storage, root });
  assert.equal(toggle.theme, 'system');
  assert.equal(toggle.label, 'Mode: System');

  toggle.next();
  assert.equal(toggle.theme, 'light');
  assert.equal(root.dataset.theme, 'light');
  assert.equal(readTheme(storage), 'light');
  assert.equal(toggle.label, 'Mode: Light');

  toggle.next();
  assert.equal(toggle.theme, 'dark');
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(toggle.label, 'Mode: Dark');

  toggle.next();
  assert.equal(toggle.theme, 'system');
  assert.equal('theme' in root.dataset, false);
  assert.equal(readTheme(storage), 'system');
});

test('the toggle starts from the stored choice, and still steps when storage throws', () => {
  assert.equal(themeToggle({ storage: memoryStorage({ theme: 'dark' }), root: fakeRoot() }).theme, 'dark');
  const root = fakeRoot();
  const toggle = themeToggle({ storage: throwingStorage, root });
  toggle.next();
  assert.equal(toggle.theme, 'light');
  assert.equal(root.dataset.theme, 'light', 'the mode changes for this page even if it cannot be kept');
});

test('the SetupLink knows no mode: no key under public/link/ names it', async () => {
  const { readdirSync } = await import('node:fs');
  const dir = new URL('../public/link/', import.meta.url);
  for (const name of readdirSync(dir)) {
    assert.doesNotMatch(readFileSync(new URL(name, dir), 'utf8'), /\btheme\b|color-?scheme|data-theme/i, name);
  }
});
