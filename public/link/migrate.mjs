/**
 * The migration chain: `decode()`'s read result lifted from whatever version
 * it named to today's, one step at a time. `keys.mjs` says what a key
 * *means*; this file is where it is written down what an *old* name becomes
 * — a step renames it, drops it, or recomputes its meaning — and it is the
 * last word over a slider name the read path did not recognise (`unknown`):
 * `decode()` no longer judges names at all (Lauf 8, "Entscheid K4"; ADR 0007,
 * Nachtrag #51).
 *
 * The production chain (`STEPS`) is empty: there is no version older than v1
 * yet, so there is nothing to migrate for real. That makes this file, for
 * now, mostly a test rig — the mechanic is proven against fixture steps so it
 * is not proven for the first time at the first real bump (#52, "What to
 * build").
 */

/**
 * The production chain. Empty at v1, and the length is exactly what
 * `docs/agents/setup-link.md` calls the mechanical half of the versioning
 * rule: the chain must always have `CURRENT_VERSION - 1` steps, one per
 * bump, or a version increase without its migration would go unnoticed
 * (`test/link-migrate.test.mjs` holds this as a standing assertion).
 */
export const STEPS = [];

/**
 * `{ game, type, pins, choices, version, unknown, report }` (a `decode()`
 * result) → `{ game, type, pins, choices, migrated, report }` — the same read,
 * lifted to today's version. `choices` (the `RaffleRange`, `CHOICE_KEYS` in
 * `keys.mjs`) rides through every step; a step that renames a range id hands
 * back a `choices` of its own, every other step leaves it as it stood.
 *
 * **A link whose version was never established is passed through untouched** —
 * the one from the future, and the one with no readable `v` at all. `decode()`
 * already decided both: no slider key read, the base taken as it stood, one
 * entry (`futureVersion` or `unreadableVersion`) and nothing else — there is
 * nothing left here to lift or to judge, because every name the link might
 * have carried is unlooked-at (#47, "Unreadable input and the fallback net";
 * Lauf 10, "Entscheid K1"). Detected by the report carrying one of those two
 * entries, not by comparing `version` against a number this module does not
 * hold an opinion on — see the next paragraph for why it cannot.
 *
 * **The chain runs from the read version through every step that applies.**
 * `steps` is an ordered list, one entry per version bump: `steps[0]` lifts
 * v1→v2, `steps[1]` lifts v2→v3, and so on, so a link already read at v2
 * skips the first step (`steps.slice(version - 1)`). The version this run
 * lands on is **not** imported from `keys.mjs` — it is `version` plus however
 * many steps actually ran. That lands on `CURRENT_VERSION` exactly when the
 * production chain has its required length, which is a separate, static
 * assertion (see `STEPS` above), not a thing this function re-derives at
 * runtime. The alternative — this function comparing against the real
 * `CURRENT_VERSION` as the loop's upper bound — would make the fixture chain
 * below unrunnable: the real `CURRENT_VERSION` is 1, so a three-step fixture
 * chain starting at v1 would never be seen as "older than today".
 *
 * **The chain runs even when it has nothing to lift.** A link that already
 * names today's version enters the loop with zero applicable steps, but the
 * loop is not skipped for that — it is simply empty — so the code below it,
 * which turns whatever is left of `unknown` into `unknownKey` entries, still
 * runs unconditionally. There is deliberately no early return for "nothing to
 * migrate": that would quietly hand the decision over an unknown name back to
 * the read path, which is exactly the shape Lauf 8 "Entscheid K4" ruled out.
 * A name no step in the chain ever claimed is loss, whether or not any step
 * ran at all.
 *
 * **`migrated` says whether a version was actually lifted**, not whether the
 * report carries entries: a link already at today's version with one
 * unresolved unknown name produces an `unknownKey` entry and `migrated:
 * false` in the very same object, because no step ran — the chain had
 * something to decide, nothing to lift. The wiring layer (#89) reads this
 * field, not the report's mere presence, to decide whether the address bar's
 * version number needs rewriting; this module cannot make that decision
 * itself, because it never touches `location` or `history` at all (by test,
 * as `decode.mjs` does not either).
 *
 * **It stands beside the report, not inside it, and that is a decision** (#52,
 * Lauf 8 Befund G7, answered 2026-09-28): the report keeps the shape ADR 0007
 * gave it — `null` when nothing was lost — so a clean, lossless migration is
 * invisible from the outside if the fact lives only in the report. It is
 * therefore returned as a field of its own, and a caller must never
 * re-derive it from `pins`. The same word is used inside the report and
 * beside it because it is the same fact, told to two readers; the duplication
 * is deliberate, the report's own field being contract (ADR 0007) and
 * untouched here.
 *
 * Pure: every step is handed a fresh `{ game, type, pins, unknown }` and
 * returns a fresh one: `read` itself is never written to, so the same read
 * migrated twice yields two equal, independent results.
 *
 * A step is a function `({ game, type, pins, unknown }) => { game, type,
 * pins, unknown, entries }`. It owns exactly one version bump and reports
 * what it did — a rename claims a name out of `unknown` and turns its raw
 * string into a finished value (`readValue` from `decode.mjs`, the exact
 * grammar a same-named key has always been read with); a drop removes a key
 * from `pins` with no successor; a step that abolishes a `Game` or
 * `TournamentType` **renames the identifier itself** and reports
 * `by: 'migration'` — it must never lean on the fallback net's `by:
 * 'fallback'`, or the link would hang off a list position after all (ADR
 * 0007, Nachtrag #44).
 */
export function migrate(read, steps = STEPS) {
  const { version, game, type, pins = {}, choices = {}, unknown = {}, report = null } = read;

  // Nothing was lifted here, and nothing will be: the chain does not run for a
  // read whose version was never established, so `migrated` is false rather
  // than absent.
  if (isUnversionedRead(report)) return { game, type, pins, choices, migrated: false, report };

  const applicable = steps.slice(version - 1);

  let state = { game, type, pins: { ...pins }, choices: { ...choices } };
  let remaining = { ...unknown };
  const entries = [];

  for (const step of applicable) {
    const next = step({ ...state, unknown: remaining });
    state = { game: next.game, type: next.type, pins: next.pins, choices: next.choices ?? state.choices };
    remaining = next.unknown ?? {};
    entries.push(...(next.entries ?? []));
  }

  // Unconditional, on purpose (see docblock above): whatever no step ever
  // claimed is the chain's own last word over that name, whether or not the
  // loop above ran a single iteration.
  for (const key of Object.keys(remaining)) entries.push({ kind: 'unknownKey', key });

  const allEntries = [...(report?.entries ?? []), ...entries];
  const migrated = applicable.length > 0;

  return {
    game: state.game,
    type: state.type,
    pins: state.pins,
    choices: state.choices,
    migrated,
    report: buildReport({
      from: version,
      to: version + applicable.length,
      migrated,
      entries: allEntries,
    }),
  };
}

/**
 * A read that never established a version — the link is from the future
 * (`futureVersion`), or it carries no readable `v` at all
 * (`unreadableVersion`, Lauf 10 "Entscheid K1"). Both leave `decode.mjs`
 * through the same early return, with the base taken, not one slider key read
 * and nothing left for the chain to decide over.
 *
 * **Both have to be caught, and the broken one is the newer reason.** Its
 * `version` is `null`, so `steps.slice(version - 1)` would slice at `NaN` —
 * which JavaScript reads as `0`, i.e. the *whole* chain — and a link whose
 * version we could not read would be lifted from v1 as though it had claimed
 * to be one. Harmless while the production chain is empty, wrong the moment it
 * is not; the fixture chains in `test/link-migrate.test.mjs` show it at once.
 */
function isUnversionedRead(report) {
  if (report == null) return false;
  return report.entries.some(
    (entry) => entry.kind === 'futureVersion' || entry.kind === 'unreadableVersion',
  );
}

/**
 * The same report shape `decode.mjs`'s `reportOf` builds, because it is the
 * same report, carried on rather than started twice (Lauf 8, "Entscheid K1").
 * `resaveBookmark` is unconditionally `true` here: the one case where it is
 * not — the link from the future — never reaches this function at all (see
 * `isUnversionedRead` above), so there is no second case to weigh here. The
 * broken link does not reach it either, but it would not have needed the
 * exception: it wants the bookmark saved again (Lauf 10, "Entscheid K1").
 */
function buildReport({ from, to, migrated, entries }) {
  if (entries.length === 0) return null;
  return { from, to, migrated, resaveBookmark: true, entries };
}
