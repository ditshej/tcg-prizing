/**
 * Where the bubble lands, as arithmetic (#66).
 *
 * The bubble is **not an overlay**: the app has exactly one, and it is the
 * `LinkMigration` report (#61, "The tiles and their grip"). So it hangs off
 * something — a tile, an ⓘ, the button a confirmation belongs to — flips
 * upward where there is no room below, stays inside the stage, and **closes
 * when its anchor is no longer visible**. One rule for all its inhabitants
 * rather than a special case per case, which is the whole reason this is a
 * function and not four handlers.
 *
 * Measuring the boxes is the shell's one unproven rind (#61, "The measuring
 * rind" — `getBoundingClientRect` für das Anhängen der Blase). Doing sums on
 * them is not: numbers go in, numbers come out, so this half sits on the
 * proven side with `node --test` behind it. Whether the result is off by ten
 * pixels on a real screen is an acceptance at the picture, and the spec says
 * so outright.
 */

/** The air between the anchor and the bubble, and between the bubble and the
 *  stage's edges. The prototype's two numbers (`placePop()`), kept as names so
 *  a test can hold the arithmetic without pasting them in twice. */
export const GAP = 6;
export const MARGIN = 8;

/**
 * Inside the frame, with the near edge winning where the two bounds cross.
 * They do cross — a bubble taller than the stage has no position that keeps
 * both margins — and then the top edge is the one to keep: a bubble pinned to
 * the top scrolls its own content, one pinned to the bottom starts out of
 * sight.
 */
function inside(value, low, high) {
  return Math.max(low, Math.min(value, high));
}

/**
 * `{ anchor, bubble, stage }` → `{ left, top, flipped }`, in the stage's own
 * coordinates. `anchor` and `stage` are boxes as the DOM reports them,
 * `bubble` needs only its two sizes.
 *
 * `flipped` comes back beside the numbers because the screen has a use for it
 * the numbers do not carry: the little arrow, if one is ever drawn, points the
 * other way.
 */
export function bubblePosition({ anchor, bubble, stage, gap = GAP, margin = MARGIN }) {
  const bottom = anchor.top + anchor.height - stage.top;
  const wanted = bottom + gap;
  const flipped = wanted + bubble.height > stage.height - margin;
  const top = flipped ? anchor.top - stage.top - bubble.height - gap : wanted;
  const centred = anchor.left - stage.left + anchor.width / 2 - bubble.width / 2;
  return {
    left: inside(centred, margin, stage.width - bubble.width - margin),
    top: inside(top, margin, stage.height - bubble.height - margin),
    flipped,
  };
}

/**
 * Whether the anchor is still on the stage at all. Anything less than "no
 * overlap" counts as visible: a tile half over the scroll edge is one the
 * CommunityLead can still see and still means, and closing on it would make
 * the bubble flicker while he scrolls.
 *
 * A missing anchor is not visible — that is the case where a page switch, the
 * fullscreen or a shrinking player count has taken the tile out of the DOM
 * entirely.
 */
export function anchorVisible(anchor, stage) {
  if (!anchor) return false;
  if (anchor.top + anchor.height <= stage.top) return false;
  if (anchor.top >= stage.top + stage.height) return false;
  if (anchor.left + anchor.width <= stage.left) return false;
  if (anchor.left >= stage.left + stage.width) return false;
  return true;
}
