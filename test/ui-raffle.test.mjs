import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { resolveSettings } from '../public/core/defaults.mjs';
import { distribute } from '../public/core/distribute.mjs';
import { RANGES } from '../public/core/rules.mjs';
import { GAME, TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';
import { planApp } from '../public/ui/plan.mjs';
import { DEFAULT_RANGE, RANGE_ROWS, drawFrom, raffleView, rangeName } from '../public/ui/raffle.mjs';

/**
 * The WinnerRaffle as an operating step (#69): the bar's model, the throw, and
 * the session state the `RaffleRange` is.
 *
 * Nothing here reaches past the seam. What a throw does is asserted the way
 * the app would show it — through `plan` and through the address bar — and the
 * die is handed in, so "evenly drawn from the pot" is a statement about a
 * list and not about luck.
 */

/** A component with a die that remembers and an address bar that remembers. */
function app(pins = {}, rolls = [0]) {
  const written = [];
  const query = `?v=1&g=${GAME.id}&t=${TOURNAMENT_TYPES[0].id}`;
  const it = planApp({ read: () => query, write: (url) => written.push(url) });
  for (const [key, value] of Object.entries(pins)) {
    it.pins[key] = value;
    it.settings[key] = value;
  }
  let at = 0;
  it._roll = () => rolls[Math.min(at++, rolls.length - 1)];
  return { it, written };
}

function planFor(pins) {
  return distribute(resolveSettings({ game: GAME, type: TOURNAMENT_TYPES[0], pins }), pins);
}

/* ── The range grid: thirteen steps, uncut and unfolded (AC 4) ───────────── */

test('the range grid carries all thirteen steps of RANGES, none dropped and none invented', () => {
  const shown = RANGE_ROWS.flat().map((chip) => chip.id);
  assert.equal(shown.length, 13);
  assert.deepEqual([...shown].sort(), RANGES.map((step) => step.id).sort());
});

test('the grid is two rows: the seven upper steps, then `all` and the five lower ones', () => {
  assert.deepEqual(RANGE_ROWS[0].map((c) => c.id), [
    'top8', 'top16', 'topQuarter', 'topThird', 'topHalf', 'topTwoThirds', 'topThreeQuarters',
  ]);
  assert.deepEqual(RANGE_ROWS[1].map((c) => c.id), [
    'all', 'bottomQuarter', 'bottomThird', 'bottomHalf', 'bottomTwoThirds', 'bottomThreeQuarters',
  ]);
  // `all` takes two cells so that every lower chip stands under the upper one
  // carrying the same fraction — ¼ under ¼ (the prototype's `rangeGrid()`).
  assert.equal(RANGE_ROWS[1][0].wide, true);
  assert.equal(RANGE_ROWS[0].filter((c) => c.wide).length, 0);
});

test('every chip carries its full name as well as its icon, so no step is a symbol alone', () => {
  for (const chip of RANGE_ROWS.flat()) {
    assert.ok(chip.icon, `${chip.id} has no icon`);
    assert.ok(chip.name && chip.name !== chip.id, `${chip.id} has no screen name`);
  }
  assert.equal(rangeName('topThird'), 'top third');
  assert.equal(rangeName('all'), 'all ranks');
  assert.equal(rangeName('nonsense'), 'all ranks');
});

test('the arrow says prefix or suffix, and `all` carries neither', () => {
  assert.equal(RANGE_ROWS[0].every((c) => c.arrow === '↑'), true);
  assert.equal(RANGE_ROWS[1][0].arrow, '');
  assert.equal(RANGE_ROWS[1].slice(1).every((c) => c.arrow === '↓'), true);
});

/* ── The bar's four things (AC 7, AC 8) ─────────────────────────────────── */

test('the stand counts the same unit as the trigger beside it, and the pot size is nowhere', () => {
  const plan = planFor({ players: 16, winnerPacks: 6, ranked: 3 });
  const view = raffleView(plan, 'all');
  assert.equal(view.stand, '3 of 6 winner packs placed');
  assert.equal(view.pot.length, 13); // available to the model …
  assert.equal(JSON.stringify(view).includes('"potSize"'), false); // … never as a shown number
  assert.equal(view.potEmptyNote, null);
});

test('one winner pack is named in the singular', () => {
  const plan = planFor({ players: 8, winnerPacks: 1, ranked: 1 });
  assert.equal(raffleView(plan, 'all').stand, '1 of 1 winner pack placed');
});

test('the trigger is locked once no manual winner pack is left to place, without a sentence', () => {
  const plan = planFor({ players: 16, winnerPacks: 4, ranked: 4 });
  const view = raffleView(plan, 'all');
  assert.equal(view.open, 0);
  assert.equal(view.canRaffle, false);
  // The stand already says `4 of 4 winner packs placed`; a second sentence
  // saying the same thing is noise.
  assert.equal(view.potEmptyNote, null);
});

test('the trigger is locked with a sentence when the pot is empty and packs are still open', () => {
  const plan = planFor({ players: 16, winnerPacks: 6, ranked: 3 });
  const view = raffleView(plan, 'top8');
  assert.equal(view.open, 3); // 6 packs, 3 of them by rank
  assert.equal(view.pot.length, 5); // ranks 4…8
  assert.equal(view.canRaffle, true);

  // Fill the rest of the top 8 by hand: the range still holds eight ranks, the
  // pot holds none (CONTEXT.md, `RafflePot`).
  const filled = planFor({
    players: 16, winnerPacks: 9, ranked: 3,
    manualWinner: { 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 },
  });
  const locked = raffleView(filled, 'top8');
  assert.equal(locked.pot.length, 0);
  assert.ok(locked.open > 0, 'winner packs are still open');
  assert.equal(locked.canRaffle, false);
  assert.equal(locked.potEmptyNote, 'every rank in range already has one — widen the range');
});

test('the retraction list is sorted by rank and names each one, never by recency', () => {
  const plan = planFor({ players: 32, winnerPacks: 9, ranked: 0, manualWinner: { 17: 1, 3: 2, 9: 1 } });
  const view = raffleView(plan, 'all');
  assert.deepEqual(view.takeBack.map((entry) => entry.rank), [3, 9, 17]);
  assert.deepEqual(view.takeBack.map((entry) => entry.label), ['Rank 3', 'Rank 9', 'Rank 17']);
  assert.equal(view.takeBack[0].count, 2);
});

test('the announcement names the last hit and does not survive its retraction', () => {
  const held = planFor({ players: 16, winnerPacks: 6, ranked: 0, manualWinner: { 5: 1 } });
  assert.equal(raffleView(held, 'all', 5).hit, 5);
  const gone = planFor({ players: 16, winnerPacks: 6, ranked: 0, manualWinner: {} });
  assert.equal(raffleView(gone, 'all', 5).hit, null);
});

/* ── The draw itself (AC 5) ─────────────────────────────────────────────── */

test('drawFrom picks the pot entry the roll points at, and stays inside the list', () => {
  const pot = [4, 7, 11, 12];
  assert.equal(drawFrom(pot, () => 0), 4);
  assert.equal(drawFrom(pot, () => 0.5), 11);
  assert.equal(drawFrom(pot, () => 0.999999), 12);
  assert.equal(drawFrom(pot, () => 1), 12); // a roll of exactly 1 must not fall off the end
  assert.equal(drawFrom([], () => 0), null);
});

test('drawFrom is even over the pot: every entry is reachable and none outside it is', () => {
  const pot = [2, 5, 9];
  const seen = new Set();
  for (let i = 0; i < 3000; i++) seen.add(drawFrom(pot, Math.random));
  assert.deepEqual([...seen].sort((a, b) => a - b), pot);
});

/* ── The component: session state and the throw (AC 5, 6, 9) ────────────── */

test('the RaffleRange starts at `all` and the bar starts closed', () => {
  const { it } = app();
  assert.equal(it.raffleRange, DEFAULT_RANGE);
  assert.equal(it.raffleRange, 'all');
  assert.equal(it.raffleOpen, false);
  assert.equal(it.lastDraw, null);
});

test('the grip toggles the bar and nothing else closes it by itself', () => {
  const { it } = app();
  it.toggleRaffle();
  assert.equal(it.raffleOpen, true);
  it.openFullscreen();
  assert.equal(it.raffleOpen, true, 'the bar survives the switch into fullscreen');
  it.closeFullscreen();
  assert.equal(it.raffleOpen, true);
  it.toggleRaffle();
  assert.equal(it.raffleOpen, false);
});

/**
 * The `RaffleRange` is **no `Regler`**: no pin, never in the `SetupLink`, not
 * counted among the pins, and a Set switch leaves it standing (#69, #61). The
 * address bar is the sharpest of those — it is the one that would be wrong in
 * public.
 */
test('setting the RaffleRange writes no pin and no address', () => {
  const { it, written } = app();
  const before = written.length;
  it.setRaffleRange('bottomHalf');
  assert.equal(it.raffleRange, 'bottomHalf');
  assert.deepEqual(it.pins, {});
  assert.equal(written.length, before, 'the address bar was written for a range change');
  assert.equal('raffleRange' in it.settings, false);
});

test('a Set switch leaves the RaffleRange standing', () => {
  const { it } = app();
  it.setRaffleRange('topThird');
  it.setType(TOURNAMENT_TYPES[1].id);
  assert.equal(it.raffleRange, 'topThird');
});

test('a throw places exactly one winner pack on a rank from the pot, into the manual counters', () => {
  const { it } = app({ players: 16, winnerPacks: 6, ranked: 0 }, [0]);
  const pot = it.raffle.pot;
  assert.equal(it.plan.allocation.manualCount, 0);
  it.throwRaffle();
  assert.equal(it.plan.allocation.manualCount, 1);
  assert.equal(it.plan.allocation.manual[pot[0]], 1);
  assert.equal(it.lastDraw, pot[0]);
  // The same counters the tile's ± writes, and no second record beside them.
  assert.deepEqual(it.pins.manualWinner, it.settings.manualWinner);
  assert.equal(it.plan.rows[pot[0] - 1].winners, 1);
});

test('a throw never lands on a rank that already holds a winner pack', () => {
  const { it } = app({ players: 8, winnerPacks: 8, ranked: 2 }, [0, 0, 0, 0]);
  for (let i = 0; i < 4; i++) it.throwRaffle();
  const winners = it.plan.rows.map((row) => row.winners);
  assert.ok(winners.every((n) => n <= 1), `a rank won twice: ${winners.join(',')}`);
  assert.equal(it.plan.allocation.manualCount, 4);
});

test('the throw does nothing while the trigger is locked', () => {
  const { it } = app({ players: 16, winnerPacks: 4, ranked: 4 });
  assert.equal(it.raffle.canRaffle, false);
  it.throwRaffle();
  assert.equal(it.plan.allocation.manualCount, 0);
  assert.equal(it.lastDraw, null);
});

/**
 * "Neurechnen ändert nie einen Gewinner" (AC 6) — the chance is in the input,
 * so the plan is a function of the stand and reading it twice, or moving an
 * unrelated slider, cannot move a winner.
 */
test('recomputing never changes a winner', () => {
  const { it } = app({ players: 16, winnerPacks: 6, ranked: 0 }, [0.4]);
  it.throwRaffle();
  const winners = it.plan.rows.map((row) => row.winners);
  assert.deepEqual(it.plan.rows.map((row) => row.winners), winners);
  it.setSlider('rankFloor', 1);
  assert.deepEqual(it.plan.rows.map((row) => row.winners), winners);
  it.setRaffleRange('top8');
  assert.deepEqual(it.plan.rows.map((row) => row.winners), winners);
});

test('a retracted allocation makes the rank drawable again at once', () => {
  const { it } = app({ players: 8, winnerPacks: 6, ranked: 0 }, [0]);
  it.throwRaffle();
  const hit = it.lastDraw;
  assert.ok(!it.raffle.pot.includes(hit), 'the hit rank is still in the pot');
  it.takeBackWinner(hit);
  assert.equal(it.plan.allocation.manual[hit], undefined);
  assert.ok(it.raffle.pot.includes(hit), 'the retracted rank did not come back into the pot');
  assert.equal(it.raffle.hit, null, 'the announcement outlived its retraction');
  assert.deepEqual(it.raffle.takeBack, []);
});

test('a rank retracted at the tile is the same retraction — one counter, not two', () => {
  const { it } = app({ players: 8, winnerPacks: 6, ranked: 0 }, [0]);
  it.throwRaffle();
  const hit = it.lastDraw;
  it.setManualWinner(hit, 0); // the tile's minus, #66
  assert.deepEqual(it.raffle.takeBack, []);
  assert.ok(it.raffle.pot.includes(hit));
});

/* ── The markup (AC 1, 2, 8, 13) ────────────────────────────────────────── */

/**
 * The surface of this step is static Alpine markup PHP composes once
 * (ADR 0004), so there is nothing to import for it. What `node --test` can
 * still hold is the markup text — and three of this ticket's criteria are
 * statements about exactly that: a grip that is never locked, an
 * announcement without a ✕, and a pointer that stays on the sheet.
 */
function view(name) {
  return readFileSync(new URL(`../views/${name}`, import.meta.url), 'utf8');
}

/** The markup of one element, from its opening tag to the matching close. */
function element(source, openingTag, closeTag) {
  const start = source.indexOf(openingTag);
  assert.ok(start >= 0, `${openingTag} is gone from the view`);
  const end = source.indexOf(closeTag, start);
  assert.ok(end > start, `${openingTag} is not closed`);
  return source.slice(start, end + closeTag.length);
}

test('the grip sits on the legend and carries no disabled state at all (AC 1)', () => {
  const legend = element(view('plan.php'), '<div class="plan-legend"', '</div>');
  const grip = element(legend, '<button type="button" class="legend-handle"', '</button>');
  assert.ok(grip.includes('toggleRaffle()'), 'the legend grip does not open the bar');
  assert.ok(grip.includes('mark-winner'), 'the grip does not sit on the `winner` entry');
  assert.equal(/disabled/.test(grip), false, 'the grip can be locked — the retraction list would be out of reach');
  // `pack` goes first and stays flat text, so the row does not start with a button.
  assert.ok(legend.indexOf('mark-pack') < legend.indexOf('legend-handle'));
});

/** The words a piece of markup puts on screen: marks and tags out, spaces folded. */
function words(markup) {
  return markup
    .replace(/<span class="mark[^"]*"[^>]*>[^<]*<\/span>/g, '')
    .replace(/<(?:[^>"]|"[^"]*")*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/*
 * The words are looked up, not read off the view: #69 and #61 ("`pack` steht
 * voran und bleibt flacher Text … `winner` ist eine Pille mit Würfel und dem
 * Zähler der noch offenen `WinnerPack`s") and the prototype's `slotLegend()`,
 * which renders `pack`, then `winner🎲` with the count only while `open > 0`.
 * The order test above holds the marks; without this one, the legend's words
 * could change — or go back to the `winner packs` / `tournament packs` #69
 * replaced — and every probe would stay green.
 */
test('the legend says `pack`, then `winner` 🎲 with the open count on the pill (#69, #61)', () => {
  const legend = element(view('plan.php'), '<div class="plan-legend"', '</div>');
  const grip = element(legend, '<button type="button" class="legend-handle"', '</button>');
  const flat = legend.slice(0, legend.indexOf('<button'));

  const [, first] = flat.split('<span class="legend-item">');
  assert.equal(words(first ?? ''), 'pack', 'the flat entry in front is not `pack`');
  assert.equal(words(grip), 'winner 🎲', 'the pill does not read `winner` with the die');
  assert.equal(/\bpacks\b/.test(words(legend)), false, 'the legend went back to plural pack words');

  // #69, run 11, phase G: `one of either` is gone — the flat part is `pack`
  // and nothing else, so no second entry can slip in beside it.
  assert.equal(words(flat), 'pack', 'the legend carries more than `pack` in front of the pill');
  assert.equal(/one of either/.test(words(legend)), false, 'the legend says `one of either` again');

  // The counter: the open winner packs, and shown only while there are any.
  const counter = grip.match(/<span class="legend-open"(?:[^>"]|"[^"]*")*>/);
  assert.ok(counter, 'the pill carries no counter');
  assert.match(counter[0], /x-text="raffle\.open"/, 'the counter does not count the open winner packs');
  assert.match(counter[0], /x-show="raffle\.open > 0"/, 'the counter shows while nothing is open');

  const { it } = app();
  assert.equal(it.raffle.open, it.plan.allocation.open, '`raffle.open` is not the allocation\'s open share');
});

test('the bar is a child of the Plan page, so no page or fullscreen switch closes it (AC 2)', () => {
  const source = view('plan.php');
  const bar = source.indexOf('class="raffle-bar"');
  assert.ok(bar >= 0, 'the raffle bar is gone');
  assert.ok(source.indexOf('<div class="page-plan"') < bar, 'the bar left the Plan page');
  // `x-show`, not `x-if`: hidden with the page, never torn down and rebuilt.
  assert.ok(element(source, '<div class="raffle-bar"', '>').includes('x-show="raffleOpen"'));
});

test('the announcement carries no ✕; the retraction names the rank (AC 8)', () => {
  const source = view('plan.php');
  const announcement = element(source, '<p class="raffle-hit"', '</p>');
  assert.equal(announcement.includes('✕'), false, 'the announcement grew a ✕');
  assert.equal(/takeBackWinner|@click/.test(announcement), false, 'the announcement became a handle');

  const list = element(source, '<div class="raffle-takeback-list"', '</div>');
  assert.ok(list.includes('takeBackWinner(entry.rank)'));
  assert.ok(list.includes('entry.label'), 'the entry does not name its rank');
});

test('the sheet keeps a pointer to the RaffleRange, with its explanation and no control (AC 13)', () => {
  const sheet = view('controls-sheet.php');
  const hit = sheet.indexOf('Raffle range');
  assert.ok(hit >= 0, 'the RaffleRange pointer is gone from the sheet');
  const block = sheet.slice(sheet.lastIndexOf('<div class="sheet-control">', hit), sheet.indexOf('</div>', hit) + 6);
  assert.ok(block.includes('Which ranks the Winner raffle may draw from'), 'the explanation is gone');
  assert.ok(block.includes('raffle.rangeName'), 'the pointer does not say which step stands');
  // A pointer, not a control: no handler, no pin mark, no reset.
  assert.equal(/setRaffleRange|sheet_control|pin/.test(block), false);
  // And it is not among the sliders: `raffleRange` is no key anywhere.
  assert.equal(sheet.includes("'raffleRange'"), false);
});
