import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * The look (#142, decided at #15): the prototype's tokens as custom
 * properties, colours only through them, edges from shadows, sharp corners,
 * and a line only where it separates data. Held on the stylesheet as text —
 * what it looks like is the acceptance by image's
 * (`docs/acceptance/73-abnahme-am-bild.md`, run 17); what it is made of is
 * checkable here.
 *
 * The expected values are the prototype's (`prototypes/cockpit.prototype.html`
 * on `prototype/rank-distribution`, `:root` and `body[data-mode="dark"]`),
 * written out, not read back from the file under test.
 */

const CSS = readFileSync(new URL('../public/ui/plan.css', import.meta.url), 'utf8');
const code = CSS.replace(/\/\*[^]*?\*\//g, '');

/** The declarations of the first block that opens with `head {`. */
function block(source, head) {
  const at = source.indexOf(`${head} {`);
  assert.ok(at >= 0, `${head} is in the stylesheet`);
  let depth = 0;
  for (let i = source.indexOf('{', at); i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(source.indexOf('{', at) + 1, i);
  }
  throw new Error(`${head} is not closed`);
}

const LIGHT = {
  '--accent': '#8c5a2b', '--accent-soft': '#f0e4d1', '--on-accent': '#fff8ee', '--ink': '#241c12',
  '--muted': '#7a6a55', '--line': '#e2d5be', '--bg': '#ece1cb', '--paper': '#fffdf8',
  '--warn': '#96140f', '--warn-soft': '#ffe1dd', '--pin': '#7a4a8c', '--pin-soft': '#f1e7f3',
  '--gold': '#b8860b', '--pack': '#46617a', '--unserved': '#ded2bb', '--floorfill': '#c2a271',
  '--reserve': '#8a5f9c', '--reserve-soft': '#f3ecf6', '--reserve-ink': '#6b3f80', '--shape': '#b08a55',
};

const DARK = {
  '--accent': '#c9992e', '--accent-soft': '#2a2620', '--on-accent': '#14110c', '--ink': '#f2ece0',
  '--muted': '#9a9384', '--line': '#35312a', '--bg': '#131210', '--paper': '#1e1b16',
  '--warn': '#ff9f90', '--warn-soft': '#3d1b18', '--pin': '#b48ee8', '--pin-soft': '#2b2338',
  '--gold': '#e8c352', '--pack': '#7ea6d4', '--unserved': '#3a362e', '--floorfill': '#6b5f3c',
  '--reserve': '#a888c8', '--reserve-soft': '#2a2338', '--reserve-ink': '#c8aee4', '--shape': '#8a7a4a',
};

const declared = (body, name) => body.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();

test('the prototype\'s colour tokens stand in :root, light (Bronze)', () => {
  const root = block(code, ':root');
  for (const [name, value] of Object.entries(LIGHT)) assert.equal(declared(root, name), value, name);
});

test('…and turn to Foil under prefers-color-scheme: dark', () => {
  const dark = block(block(code, '@media (prefers-color-scheme: dark)'), ':root');
  for (const [name, value] of Object.entries(DARK)) assert.equal(declared(dark, name), value, name);
});

test('the form tokens: 2 px corners (the round button 3), shadows for depth, the head type', () => {
  const root = block(code, ':root');
  for (const name of ['--r-tile', '--r-ctl', '--r-pill']) assert.equal(declared(root, name), '2px', name);
  assert.equal(declared(root, '--r-fab'), '3px');
  for (const name of ['--tile-shadow', '--btn-shadow', '--panel-shadow', '--glow']) assert.ok(declared(root, name), name);
  assert.equal(declared(root, '--head-tr'), 'uppercase');
  assert.equal(declared(root, '--head-ls'), '0.14em');
  assert.match(declared(root, '--font'), /^-apple-system/);
});

test('the dark mode glows gold at the edge: an inner rim on tile and button', () => {
  const dark = block(block(code, '@media (prefers-color-scheme: dark)'), ':root');
  assert.match(declared(dark, '--tile-shadow'), /^inset 0 0 0 1px rgba\(214, 168, 58/);
  assert.match(declared(dark, '--btn-shadow'), /^inset 0 0 0 1px rgba\(214, 168, 58/);
});

test('outside the token blocks no hex, rgb/hsl/light-dark or common colour name', () => {
  const rest = code
    .replace(`:root {${block(code, ':root')}}`, '')
    .replace(`@media (prefers-color-scheme: dark) {${block(code, '@media (prefers-color-scheme: dark)')}}`, '');
  assert.doesNotMatch(rest, /#[0-9a-f]{3,8}\b/i, 'no hex colour');
  assert.doesNotMatch(rest, /\brgba?\(|\bhsla?\(|light-dark\(/, 'no colour function');
  assert.doesNotMatch(rest, /:\s*(?:white|black|red|green|blue|gray|grey)\b/, 'no named colour');
});

test('no solid px border but the data lines: the group title on Details and the derivation steps', () => {
  const lines = [...code.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, , body]) => /border(?:-top|-bottom|-left|-right)?:\s*(?!none|0\b)[^;]*\d+px solid (?!transparent)/.test(body))
    .map(([, selector]) => selector.trim());
  assert.deepEqual(lines.sort(), ['.prep-offer', '.prep-step', '.sheet-group-head'].sort());
});

test('Details draws the line over every group title (#15, prototype `.grouphead`)', () => {
  const head = block(code, '.sheet-group-head');
  assert.match(head, /border-top:\s*1px solid var\(--line\)/);
  assert.match(head, /text-transform:\s*var\(--head-tr\)/);
});

test('corners are the tokens, except what is round on purpose', () => {
  const radii = [...code.matchAll(/border-radius:\s*([^;]+);/g)].map(([, value]) => value.trim());
  const allowed = /^(var\(--r-(tile|ctl|pill|fab)\)|0|50%|var\(--r-ctl\) 0 0 var\(--r-ctl\)|0 var\(--r-ctl\) var\(--r-ctl\) 0|8px|9px|999px)$/;
  for (const value of radii) assert.match(value, allowed, `border-radius: ${value}`);
});

test('the hit rule is 44 px, and its ::after grows from the centre', () => {
  assert.equal(declared(block(code, ':root'), '--hit'), '44px');
  assert.match(code, /::after \{\s*content: '';\s*position: absolute;\s*top: min\(0px, calc\(50% - var\(--hit\) \/ 2\)\)/);
});
