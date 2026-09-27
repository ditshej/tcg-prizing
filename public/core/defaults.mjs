/**
 * The three-level default chain, resolved: the Game's complete sheet, the
 * chosen TournamentType's deviations on top, the pinned sliders above both
 * (ADR 0003, ADR 0005). Out comes the flat `Settings` the core takes (#46,
 * `## Input: Settings`).
 *
 * It lives at `core/` and not at `link/`: it is pure logic over the sheets and
 * Spec 2 needs it as much as the read path does (#47, `## File layout`).
 * `public/sets/` stays data, never logic (ADR 0003), and this file knows no
 * particular set — the sheets come in as arguments.
 *
 * It does not track which value came from a URL. The app tracks that nowhere
 * and must not start (ADR 0005), so a value from a link is a pinned value like
 * any other — and no cap is applied here: over a cap it stands, and the
 * ConflictNotice shows the ways out (ADR 0006, ADR 0007).
 */

/**
 * The four trailing sliders: absent means `null`, "the core computes it"
 * (#46 — the four fields whose `null` is allowed). Their starting value is a
 * calculation, not sheet data, so no DefaultSet carries them and the sheet has
 * nothing to fall back to.
 */
export const TRAILING_SLIDERS = ['tournamentPacks', 'depth', 'ranked', 'winnerPacks'];

/**
 * The two that start neutral: absent means the empty value, because a
 * DefaultSet never prefills anything that names a Rank (ADR 0003) — a
 * prefilled recipient would be an allocation nobody decided.
 */
export const NEUTRAL_SLIDERS = { displays: () => [], manualWinner: () => ({}) };

/**
 * `{ game, type, pins }` → `Settings`. `game` is a complete Game sheet, `type`
 * a TournamentType entry (its `id` and `title` are surface data, not Settings
 * fields, and are dropped), `pins` the pinned sliders — from a SetupLink, from
 * the sliders, from anywhere: this function cannot tell and does not ask.
 *
 * Resolving a *name* to a sheet is deliberately not done here. An unknown
 * `game` or `type` falls back to the first of the list and says so in the
 * report — that is the fallback net of #51, and it belongs to the layer that
 * owns the set list, not to the core.
 *
 * Pure: no DOM, no state, no clock. Every call builds its own empty vector and
 * map, so two resolved `Settings` never share one.
 */
export function resolveSettings({ game, type, pins } = {}) {
  const { id, title, ...deviations } = type ?? {};
  const resolved = { ...game, ...deviations };
  for (const key of TRAILING_SLIDERS) resolved[key] = null;
  for (const [key, empty] of Object.entries(NEUTRAL_SLIDERS)) resolved[key] = empty();
  return { ...resolved, ...pins };
}
