/**
 * The foot's marking (#158, F4 a): the active entry is marked over its whole
 * face — not only the field under the icon — and on a page switch the marking
 * slides to the new entry, sideways in the upright foot and up or down at the
 * strip turned to the right edge. It is a field, so it is depth and never a
 * stroke (#63, #15: a line only where it separates data).
 *
 * This overrules #63's "ein Wechsel hat keine Richtung" for the marking alone.
 * The pages themselves still have no direction: they only fade (`plan.css`,
 * `page-fade`).
 *
 * One element (`.foot-mark` in `views/foot.php`) is laid under the entries
 * and moved, rather than one field per entry turned on and off — a field that
 * appears at the new entry cannot slide. Where it stands is measured, not
 * reckoned: the upright entries are thirds of the foot, the turned ones are
 * spread evenly over its height, and an entry that has vanished into a column
 * (#71) is not there at all. So this is rind like `measure.mjs`: it reads
 * boxes and writes four lengths. `markBox()` is the arithmetic.
 */

/** How long the marking slides: as long as a page fades (proto:831-837). */
export const MARK_SLIDE_MS = 150;

/**
 * Where the marking stands inside the foot: the whole box of the active entry,
 * relative to the foot's own box. `null` where no active entry is on screen.
 */
export function markBox(footRect, itemRect) {
  if (!itemRect) return null;
  return {
    x: itemRect.left - footRect.left,
    y: itemRect.top - footRect.top,
    width: itemRect.width,
    height: itemRect.height,
  };
}

/**
 * Puts the marking under the active entry of `footEl`, and says whether it
 * stands. It **slides** (`data-mark-slide`, the transition in `plan.css`) only
 * where a page switch moved it from an entry it already stood on; a resize, a
 * fold that turned the foot, or a marking coming back from nowhere puts it in
 * place at once — anything else would fly it across the screen.
 *
 * From two columns on (#71) the one entry left is the folded page and never
 * the active one, so no entry is marked there and nothing slides.
 */
export function placeMark(footEl, { slide = false, shownBefore = false } = {}) {
  const mark = footEl.querySelector('.foot-mark');
  if (!mark) return false;
  const active = Array.from(footEl.querySelectorAll('.foot-item'))
    .find((item) => item.classList.contains('foot-active') && item.getClientRects().length > 0);
  const box = markBox(footEl.getBoundingClientRect(), active ? active.getBoundingClientRect() : null);
  if (slide && shownBefore && box) footEl.dataset.markSlide = '';
  else delete footEl.dataset.markSlide;
  if (box) {
    mark.style.setProperty('--mark-x', `${box.x}px`);
    mark.style.setProperty('--mark-y', `${box.y}px`);
    mark.style.setProperty('--mark-width', `${box.width}px`);
    mark.style.setProperty('--mark-height', `${box.height}px`);
  }
  mark.style.setProperty('--mark-shown', box ? '1' : '0');
  return !!box;
}

/**
 * The foot's own small component, nested in `planApp()`'s scope so it reads
 * `activePage` from there. A page switch places the marking with a slide once
 * Alpine has moved the `foot-active` class; any change of the foot's or an
 * entry's box (rotation, the fold, an entry vanishing into a column) places
 * it without one.
 */
export function footMark() {
  return {
    init() {
      const foot = this.$el;
      let shown = false;
      const place = (slide) => { shown = placeMark(foot, { slide, shownBefore: shown }); };
      this.$watch('activePage', () => this.$nextTick(() => place(true)));
      if (typeof ResizeObserver === 'undefined') { this.$nextTick(() => place(false)); return; }
      this._footObserver = new ResizeObserver(() => place(false));
      this._footObserver.observe(foot);
      foot.querySelectorAll('.foot-item').forEach((item) => this._footObserver.observe(item));
    },
    destroy() {
      if (this._footObserver) this._footObserver.disconnect();
    },
  };
}
