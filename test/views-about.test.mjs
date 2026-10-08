import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * The about block at the very bottom of `Details` (#159), in the form of a
 * page footer (#169): on top, once more, the contact channel the `Game` ⓘ
 * carries (#64, "Lauf 8 · Angabe"), under it the by-line
 * `created by ditshej with AI | GitHub`. Held as markup, the way
 * `views-controls-hot.test.mjs` holds its partial — PHP composes it once
 * (ADR 0004), so what `node --test` can check is the text it composes from.
 *
 * The Discord profile is one value read in two places. A test that only
 * compared the two hrefs would pass with two hand-copied literals as well, so
 * the first test proves the single source: the profile's ID occurs once under
 * `views/`, in the partial both places read.
 */

const VIEWS = new URL('../views/', import.meta.url);
const read = (name) => readFileSync(new URL(name, VIEWS), 'utf8');
const ABOUT = read('about.php');
const SHEET = read('controls-sheet.php');
const DETAILS = read('details.php');
const CSS = readFileSync(new URL('../public/ui/plan.css', import.meta.url), 'utf8');
const CONTEXT = readFileSync(new URL('../CONTEXT.md', import.meta.url), 'utf8');

const DISCORD_ID = '428891117220659241';
const DISCORD_URL = `https://discord.com/users/${DISCORD_ID}`;
const READS_PROFILE = `href="<?= htmlspecialchars(require __DIR__ . '/discord-profile.php') ?>"`;

/** PHP and HTML comments out, so a sentence *about* a link is not one. */
const code = (source) => source.replace(/<!--[^]*?-->/g, '').replace(/\/\*[^]*?\*\//g, '');

/** Every `<a …>…</a>` of a markup, with its attributes and visible text. */
function links(source) {
  return [...code(source).matchAll(/<a\s((?:<\?=[^]*?\?>|[^>])*)>([^]*?)<\/a>/g)].map(([, attributes, inner]) => ({
    attributes: attributes.replace(/\s+/g, ' ').trim(),
    href: attributes.match(/href="((?:<\?=[^]*?\?>|[^"])*)"/)?.[1],
    text: inner.replace(/<[^>]*>/g, '').trim(),
  }));
}

test('the Discord profile lives in one place: the ID occurs once under views/, in the partial', () => {
  const holders = readdirSync(VIEWS)
    .filter((name) => name.endsWith('.php'))
    .flatMap((name) => Array(read(name).split(DISCORD_ID).length - 1).fill(name));
  assert.deepEqual(holders, ['discord-profile.php']);
  assert.match(read('discord-profile.php'), new RegExp(`\\breturn '${DISCORD_URL.replace(/[./]/g, '\\$&')}';`));
});

test('the ⓘ of Game and the about block both read that one value, and show the tag', () => {
  for (const [name, source] of [['controls-sheet.php', SHEET], ['about.php', ABOUT]]) {
    const discord = links(source).filter((link) => link.href?.includes('discord-profile.php'));
    assert.equal(discord.length, 1, `${name} carries one Discord link`);
    assert.ok(discord[0].attributes.startsWith(READS_PROFILE), `${name} reads the shared value`);
    assert.match(discord[0].attributes, /target="_blank" rel="noreferrer"/);
    assert.equal(discord[0].text, 'ditshej', `${name} shows the tag`);
  }
});

test('the by-line is `created by ditshej with AI | GitHub`, the two links carry exactly the two URLs', () => {
  const byline = code(ABOUT).match(/<p class="about-by">([^]*?)<\/p>/)?.[1];
  assert.ok(byline, 'about.php has a by-line');
  assert.equal(byline.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(), 'created by ditshej with AI | GitHub');
  assert.deepEqual(
    links(byline).map(({ href, text, attributes }) => [href, text, /target="_blank" rel="noreferrer"/.test(attributes)]),
    [['https://ditshej.ch', 'ditshej', true], ['https://github.com/ditshej/tcg-prizing', 'GitHub', true]],
  );
});

test('the Discord line says where its link goes, above the by-line', () => {
  const source = code(ABOUT);
  assert.ok(source.indexOf('class="about-contact"') < source.indexOf('class="about-by"'),
    'the Discord line comes first, the by-line under it (review 2, point 3c)');
  const contact = source.match(/<p class="about-contact">([^]*?)<\/p>/)?.[1];
  assert.equal(contact.replace(/<\?=[^]*?\?>/g, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
    'Questions or ideas? Say so on Discord — ditshej');
});

test('Details ends with the about block, after the last group, in every fold', () => {
  const sheet = DETAILS.indexOf("require __DIR__ . '/controls-sheet.php'");
  const about = DETAILS.indexOf("require __DIR__ . '/about.php'");
  assert.ok(sheet > 0 && about > sheet, 'about.php comes after the sheet');
  assert.ok(about < DETAILS.lastIndexOf('</div>'), 'inside .page-details, which every fold shows');
  const after = DETAILS.slice(DETAILS.indexOf('?>', about) + 2, DETAILS.lastIndexOf('</div>'));
  assert.equal(after.trim(), '', 'nothing follows it');
});

test('its links take a 44 px hit area, beside the ⓘ link in both :where lists', () => {
  const lists = [...CSS.matchAll(/:where\(([^)]*)\)(::after)? \{/g)].filter(([, list]) => list.includes('.set-info a'));
  assert.equal(lists.length, 2);
  for (const [, list] of lists) assert.match(list, /\.about a,/);
});

/** The declarations of every rule whose selector list is exactly `selector`. */
function declarations(selector) {
  return [...CSS.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, list]) => list.trim() === selector)
    .map(([, , body]) => body)
    .join('');
}

test('it is the page footer: a line above, no head, both lines centred, muted, small', () => {
  assert.doesNotMatch(code(ABOUT), /<h\d|class="[^"]*head/, 'no head under the line (F1 = b)');
  const about = declarations('.about');
  assert.match(about, /border-top:\s*1px solid var\(--line\)/);
  assert.match(about, /color:\s*var\(--muted\)/);
  assert.match(about, /font-size:\s*0\.7rem/);
  assert.match(about, /text-align:\s*center/);
  const lines = declarations('.about p');
  assert.match(lines, /justify-content:\s*center/);
  assert.doesNotMatch(lines, /font-size|color/, 'both lines take one size and one colour from the block');
  assert.ok(CSS.lastIndexOf('.about') > CSS.lastIndexOf('.rail-probe'), 'the block stands at the end of the file');
});

/**
 * A small cascade over plan.css, enough to compute what AC 4 of #169 asks
 * about: the `font-weight` and the `text-decoration-line` of the footer's
 * elements at rest. Reading the `.about a` rule alone passes two breaks — the
 * whole block set bold (the links no longer stand out), and an underline on
 * `.about p` (it propagates onto the links whatever they say themselves) — so
 * the test resolves every rule that matches the chain from `<html>` down to a
 * link, and judges the computed values.
 *
 * Every style rule counts, `@media`/`@container`/`@supports` blocks included,
 * since one of them may hold in some fold or scheme. Attribute selectors match
 * (the theme sits on `<html>` as one), state pseudo-classes (`:hover`,
 * `:focus*`, `:active`) and pseudo-elements do not — the question is the rest
 * state of the element's own box. The UA's underline on `a:any-link` is the
 * one rule below the sheet.
 */
function styleRules(css) {
  const source = css.replace(/\/\*[^]*?\*\//g, '');
  const rules = [];
  let order = 0;
  (function walk(from, to) {
    let at = from;
    while (at < to) {
      const open = source.indexOf('{', at);
      if (open < 0 || open >= to) return;
      let depth = 1, close = open + 1;
      for (; depth > 0; close++) depth += source[close] === '{' ? 1 : source[close] === '}' ? -1 : 0;
      const head = source.slice(at, open).replace(/^[^]*;/, '').trim();
      if (/^@(media|container|supports|layer)\b/.test(head)) walk(open + 1, close - 1);
      else if (!head.startsWith('@')) {
        const body = source.slice(open + 1, close - 1);
        const declarations = [...body.matchAll(/([\w-]+)\s*:\s*([^;]+)/g)]
          .map(([, property, value]) => ({ property, value: value.trim() }));
        rules.push({ selectors: splitList(head), declarations, order: order++ });
      }
      at = close;
    }
  })(0, source.length);
  return rules;
}

/** A selector list split at its top-level commas. */
function splitList(list) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i] === '(') depth++;
    else if (list[i] === ')') depth--;
    else if (list[i] === ',' && depth === 0) { parts.push(list.slice(start, i)); start = i + 1; }
  }
  return [...parts, list.slice(start)].map((part) => part.trim()).filter(Boolean);
}

const STATE = /^:(hover|focus|focus-visible|focus-within|active|target|checked|disabled)$/;

/**
 * Whether `selector` matches the last element of `chain` (root first), and
 * at what specificity [ids, classes, types]; `null` if it does not.
 */
function match(selector, chain) {
  const compounds = [''];
  const combinators = [];
  let depth = 0;
  for (const char of selector.trim().replace(/\s+/g, ' ')) {
    if (depth === 0 && /[ >+~]/.test(char)) {
      if (char !== ' ') combinators[compounds.length - 1] = char;
      else if (combinators[compounds.length - 1] === undefined) combinators[compounds.length - 1] = ' ';
      continue;
    }
    if (combinators[compounds.length - 1] !== undefined && compounds.at(-1) !== '' && compounds.length === combinators.length) compounds.push('');
    if (char === '(') depth++;
    else if (char === ')') depth--;
    compounds[compounds.length - 1] += char;
  }
  const total = [0, 0, 0];
  const add = (s) => s.forEach((n, i) => { total[i] += n; });

  const own = compound(compounds.at(-1), chain.length - 1);
  if (!own) return null;
  add(own);
  let at = chain.length - 1;
  for (let c = compounds.length - 2; c >= 0; c--) {
    const combinator = combinators[c];
    if (combinator === '+' || combinator === '~') return null; // siblings are not modelled
    let found = null;
    for (let up = at - 1; up >= 0; up--) {
      found = compound(compounds[c], up);
      if (found) { at = up; break; }
      if (combinator === '>') break;
    }
    if (!found) return null;
    add(found);
  }
  return total;

  function compound(text, index) {
    const element = chain[index];
    const spec = [0, 0, 0];
    const tokens = text.match(/::?[\w-]+(\((?:[^()]|\([^()]*\))*\))?|\.[\w-]+|#[\w-]+|\[[^\]]*\]|\*|[\w-]+/g) ?? [];
    if (tokens.join('') !== text) return null; // a form this cascade does not read
    for (const token of tokens) {
      if (token === '*') continue;
      if (token.startsWith('::')) return null;
      if (token.startsWith('.')) { if (!element.classes.includes(token.slice(1))) return null; spec[1]++; continue; }
      if (token.startsWith('#')) return null;
      if (token.startsWith('[')) { spec[1]++; continue; }
      if (token.startsWith(':')) {
        const [, name, args] = token.match(/^:([\w-]+)(?:\((.*)\))?$/);
        if (STATE.test(`:${name}`)) return null;
        if (name === 'where' || name === 'is' || name === 'not') {
          const hits = splitList(args).map((inner) => match(inner, chain.slice(0, index + 1))).filter(Boolean);
          if (name === 'not' ? hits.length > 0 : hits.length === 0) return null;
          if (name !== 'where') {
            const best = (name === 'not' ? splitList(args).map(() => [0, 1, 0]) : hits).sort(compare).at(-1);
            best.forEach((n, i) => { spec[i] += n; });
          }
          continue;
        }
        if (name === 'root' && element.tag !== 'html') return null;
        if ((name === 'link' || name === 'any-link') && element.tag !== 'a') return null;
        spec[1]++;
        continue;
      }
      if (token !== element.tag) return null;
      spec[2]++;
    }
    return spec;
  }
}

const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

const UA = [{ selectors: ['a:any-link'], declarations: [{ property: 'text-decoration', value: 'underline' }], order: -1 }];
const RULES = [...UA, ...styleRules(CSS)];

/** The cascaded value of `property` on the last element of `chain`, or undefined. */
function cascaded(chain, property, longhand) {
  let winner;
  for (const rule of RULES) {
    for (const selector of rule.selectors) {
      const spec = match(selector, chain);
      if (!spec) continue;
      for (const declaration of rule.declarations) {
        const value = longhand(declaration);
        if (value === undefined) continue;
        const important = /!important$/.test(declaration.value);
        const rank = [important ? 1 : 0, rule.order >= 0 ? 1 : 0, ...spec, rule.order];
        if (!winner || rank.reduce((d, n, i) => d || n - winner.rank[i], 0) >= 0) winner = { value, rank };
      }
    }
  }
  return winner?.value.replace(/\s*!important$/, '');
}

const WEIGHT = /^(normal|bold|bolder|lighter|[1-9]00|inherit|initial|unset)$/;

/** The computed `font-weight` of the last element of `chain`, as a number. */
function fontWeight(chain) {
  const value = cascaded(chain, 'font-weight', ({ property, value }) => {
    if (property === 'font-weight') return value;
    if (property === 'font') return value.split(/\s+/).find((word) => WEIGHT.test(word)) ?? 'normal';
  });
  const parent = () => (chain.length > 1 ? fontWeight(chain.slice(0, -1)) : 400);
  if (value === undefined || value === 'inherit' || value === 'unset') return parent();
  if (value === 'normal' || value === 'initial') return 400;
  if (value === 'bold') return 700;
  if (value === 'bolder') { const p = parent(); return p < 350 ? 400 : p < 550 ? 700 : 900; }
  if (value === 'lighter') { const p = parent(); return p < 550 ? 100 : p < 750 ? 400 : 700; }
  assert.match(value, /^\d+$/, `a font-weight this cascade resolves (${value})`);
  return Number(value);
}

/** The computed `text-decoration-line` of the last element of `chain` (not inherited). */
function decorationLine(chain) {
  const value = cascaded(chain, 'text-decoration-line', ({ property, value }) => {
    if (property === 'text-decoration-line') return value;
    if (property === 'text-decoration') {
      return value.split(/\s+/).filter((word) => /^(none|underline|overline|line-through|inherit|initial|unset)$/.test(word)).join(' ') || 'none';
    }
  });
  if (value === 'inherit') return decorationLine(chain.slice(0, -1));
  return value === undefined || value === 'initial' || value === 'unset' ? 'none' : value;
}

/** html → … → the footer, each element by tag and classes, the way app.php and details.php nest it. */
const FOOTER = [
  { tag: 'html', classes: [] },
  { tag: 'body', classes: [] },
  { tag: 'div', classes: ['app'] },
  { tag: 'div', classes: ['fold'] },
  { tag: 'div', classes: ['page-details'] },
  { tag: 'footer', classes: ['about'] },
];

test('its links stand out by weight alone: the line\'s colour, no underline at rest', () => {
  const footer = code(ABOUT).match(/<footer class="([^"]*)">/)?.[1];
  assert.equal(footer, 'about', 'the block is `footer.about`, as the chain below models it');
  for (const line of ['about-contact', 'about-by']) {
    assert.match(code(ABOUT), new RegExp(`<p class="${line}">[^]*?<a\\s[^]*?</p>`), `${line} holds its links directly`);
    const p = [...FOOTER, { tag: 'p', classes: [line] }];
    const a = [...p, { tag: 'a', classes: [] }];
    const text = fontWeight(p);
    const link = fontWeight(a);
    assert.ok(link > text, `in .${line} the links (${link}) are heavier than the text around them (${text})`);
    for (const [name, chain] of [['the link', a], ['.' + line, p], ['.about', FOOTER]]) {
      assert.equal(decorationLine(chain), 'none', `${name} paints no text-decoration, so none reaches the link`);
    }
  }
  const link = declarations('.about a');
  assert.match(link, /color:\s*inherit/);
  assert.doesNotMatch(link, /var\(--accent|font-size|outline/, 'no accent, no size of its own, the focus ring stays');
  assert.doesNotMatch(code(ABOUT), /<strong|<b>/, 'the weight is the rule\'s, not a nested tag\'s on top of it');
});

test('CONTEXT.md › Game names the second place of the contact channel, above the by-line', () => {
  const game = CONTEXT.slice(CONTEXT.indexOf('**Game**:'), CONTEXT.indexOf('**TournamentType**:'));
  assert.match(game, /ganz unten auf\s+`Details`/);
  assert.match(game, /über\s+der\s+Zeile\s+`created by ditshej with AI \| GitHub`/, 'Discord on top, the new wording under it');
  assert.doesNotMatch(game, /`by ditshej \| GitHub`/, 'the old wording is gone');
});
