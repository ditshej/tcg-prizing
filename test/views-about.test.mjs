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

test('its links stand out by weight alone: the line\'s colour, no underline at rest', () => {
  const link = declarations('.about a');
  assert.match(link, /color:\s*inherit/);
  assert.match(link, /text-decoration:\s*none/);
  assert.match(link, /font-weight:\s*700/);
  assert.doesNotMatch(link, /var\(--accent|font-size|outline/, 'no accent, no size of its own, the focus ring stays');
  assert.doesNotMatch(code(ABOUT), /<strong|<b>/, 'the weight is the rule\'s, not a nested tag\'s on top of it');
});

test('CONTEXT.md › Game names the second place of the contact channel, above the by-line', () => {
  const game = CONTEXT.slice(CONTEXT.indexOf('**Game**:'), CONTEXT.indexOf('**TournamentType**:'));
  assert.match(game, /ganz unten auf\s+`Details`/);
  assert.match(game, /über\s+der\s+Zeile\s+`created by ditshej with AI \| GitHub`/, 'Discord on top, the new wording under it');
  assert.doesNotMatch(game, /`by ditshej \| GitHub`/, 'the old wording is gone');
});
