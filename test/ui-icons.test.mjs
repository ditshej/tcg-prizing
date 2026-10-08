import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

/**
 * The icons (#142, decision 5): every glyph that serves as an icon is a Lucide
 * SVG, vendored as single files beside its ISC licence the way Alpine is —
 * pinned by the version in the path, no package, no build step. PHP inlines
 * them through `icon()` (`views/icon.php`), so they take `currentColor` like
 * the text they stand beside.
 *
 * Held here as markup, the same way `views-controls-hot.test.mjs` holds its
 * `<select>`: what PHP composes once has no derivation to call.
 */

const LUCIDE = new URL('../public/vendor/lucide-1.53.0/', import.meta.url);
const VIEWS = new URL('../views/', import.meta.url);

/** The icons the ticket lists, checked present at lucide-static 1.53.0. */
const LISTED = [
  'shopping-cart', 'layout-grid', 'menu', 'dices', 'rotate-ccw', 'x', 'chevron-down',
  'chevron-left', 'chevron-right', 'maximize-2', 'minimize-2', 'triangle-alert', 'info',
  'share', 'sun', 'moon', 'sun-moon',
];

const view = (name) => readFileSync(new URL(name, VIEWS), 'utf8');
const views = () => readdirSync(VIEWS).filter((name) => name.endsWith('.php'));

/** A view's markup without its PHP docblocks and HTML comments — the prose may name a glyph. */
const markupOf = (source) => source
  .replace(/\/\*[^]*?\*\//g, '')
  .replace(/<!--[^]*?-->/g, '')
  .replace(/^\s*\/\/.*$/gm, '');

test('the listed Lucide icons are vendored as single files, with the ISC licence beside them', () => {
  for (const name of LISTED) {
    assert.ok(existsSync(new URL(`${name}.svg`, LUCIDE)), `${name}.svg is vendored`);
  }
  const licence = readFileSync(new URL('LICENSE', LUCIDE), 'utf8');
  assert.match(licence, /^ISC License/);
});

test('every icon a view asks for is one that is vendored', () => {
  for (const name of views()) {
    for (const [, icon] of markupOf(view(name)).matchAll(/icon\('([a-z0-9-]+)'/g)) {
      assert.ok(existsSync(new URL(`${icon}.svg`, LUCIDE)), `${name} asks for ${icon}, which is vendored`);
    }
  }
});

test('no glyph or emoji serves as an icon in the markup any more', () => {
  const glyphs = /🛒|⊞|☰|🎲|↺|✕|▾|⤢|⤡|‹|›|⚠|ⓘ|&#8634;|&#10005;|&#9662;/u;
  const emoji = /\p{Extended_Pictographic}/u;
  for (const name of views()) {
    // The chip's glyph key is compared, never drawn (see the chip test below).
    const markup = markupOf(view(name)).replace(`chip.glyph === '⚠'`, '');
    assert.doesNotMatch(markup, glyphs, `${name} draws no glyph icon`);
    assert.doesNotMatch(markup, emoji, `${name} draws no emoji`);
  }
});

test('the info buttons are icons, not a typed letter i', () => {
  const sheet = markupOf(view('controls-sheet.php'));
  assert.doesNotMatch(sheet, /class="info"[^>]*>i<\/button>/);
  assert.ok((sheet.match(/icon\('info'/g) ?? []).length >= 2, 'one ⓘ per level');
});

test('the foot keeps icon and word on every entry, never the icon alone (#61)', () => {
  const foot = markupOf(view('foot.php'));
  for (const [icon, word] of [['shopping-cart', 'Prepare'], ['layout-grid', 'Plan'], ['menu', 'Details']]) {
    const at = foot.indexOf(`icon('${icon}'`);
    assert.ok(at > 0, `${word} has its icon`);
    assert.match(foot.slice(at, foot.indexOf('</button>', at)), new RegExp(`class="foot-label">${word}<`));
  }
});

/*
 * The notice model keeps its `glyph: '⚠'` (test/ui-notices.test.mjs pins it);
 * on screen it is a key, mapped to `triangle-alert`, and never written as text.
 */
test('the chip\'s glyph is a key mapped to triangle-alert, never text on screen', () => {
  const notices = markupOf(view('notices.php'));
  assert.doesNotMatch(notices, /x-text="chip\.glyph"/);
  const at = notices.indexOf(`x-if="chip.glyph === '⚠'"`);
  assert.ok(at > 0, 'the chip maps the glyph key');
  assert.ok(notices.indexOf("icon('triangle-alert'", at) > at, 'to the Lucide triangle');
});

test('icon() inlines the vendored SVG as a decoration that takes the text colour', () => {
  const helper = view('icon.php');
  assert.match(helper, /lucide-1\.53\.0/);
  assert.match(helper, /aria-hidden="true"/);
  const svg = readFileSync(new URL('x.svg', LUCIDE), 'utf8');
  assert.match(svg, /stroke="currentColor"/);
});
