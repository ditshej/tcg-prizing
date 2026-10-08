import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * The about block at the very bottom of `Details` (#159): a by-line
 * `by ditshej | GitHub` and, once more, the contact channel the `Game` ⓘ
 * carries (#64, "Lauf 8 · Angabe"). Held as markup, the way
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

test('the by-line is `by ditshej | GitHub`, the two links carry exactly the two URLs', () => {
  const byline = code(ABOUT).match(/<p class="about-by">([^]*?)<\/p>/)?.[1];
  assert.ok(byline, 'about.php has a by-line');
  assert.equal(byline.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(), 'by ditshej | GitHub');
  assert.deepEqual(
    links(byline).map(({ href, text, attributes }) => [href, text, /target="_blank" rel="noreferrer"/.test(attributes)]),
    [['https://ditshej.ch', 'ditshej', true], ['https://github.com/ditshej/tcg-prizing', 'GitHub', true]],
  );
});

test('the Discord line says where its link goes, under the by-line', () => {
  const source = code(ABOUT);
  assert.ok(source.indexOf('class="about-by"') < source.indexOf('class="about-contact"'));
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

test('it is set quietly: muted, small, no line', () => {
  const rules = [...CSS.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector]) => /^\s*\.about\b/.test(selector));
  assert.ok(rules.length > 0, 'the about block has its own rules');
  const body = rules.map(([, , declarations]) => declarations).join('');
  assert.match(body, /color:\s*var\(--muted\)/);
  assert.match(body, /font-size:\s*0\.7rem/);
  assert.doesNotMatch(body, /border|outline/);
  assert.ok(CSS.lastIndexOf('.about') > CSS.lastIndexOf('.rail-probe'), 'the block stands at the end of the file');
});

test('CONTEXT.md › Game names the second place of the contact channel', () => {
  const game = CONTEXT.slice(CONTEXT.indexOf('**Game**:'), CONTEXT.indexOf('**TournamentType**:'));
  assert.match(game, /ganz unten auf\s+`Details`/);
});
