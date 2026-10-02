<?php
/**
 * The row every number on screen is drawn with (#113): title, state word,
 * counter, way back — `− [number] +`, and the number is a field one types
 * into. It has two callers, the Details sheet (`controls-sheet.php`) and the
 * fixed rail under `Plan` (`controls-hot.php`), and that is the whole point of
 * it standing in a file of its own: the rail "ist `Details` und war nie ein
 * eigener Inhalt" (#61), and it only had a form of its own because of the
 * slider. With the slider gone the rail is the same row, without the
 * explanation text the sheet puts beside it (#64 AC 9) — one function, two
 * callers, so the two cannot drift in what they show or do.
 *
 * The three controls that pick rather than count are not this row and stay as
 * they were: `curve` its glyphs, `depthStep` its chips inside `Served ranks`,
 * `combinedHandout` its box (#113 AC 2).
 *
 * Loaded with `require_once` by both callers. The rail is composed first
 * (`app.php` puts `plan.php` before `details.php`), so the definitions cannot
 * live in either caller.
 */

/**
 * The marking and the first reach (#67), as one head for every control: the
 * word `pinned` or `auto`, and the button that puts this one control back on
 * the chosen `TournamentType`.
 *
 * The word is drawn from the **stored** pin and never from a comparison with
 * the sheet (ADR 0006) — `stateWord()` is `plan.mjs`'s, over `isPinned()` on
 * the proven side, so a number stepped back onto its default still reads
 * `pinned`. Both words stand on screen as the glossary writes them
 * (CONTEXT.md, `Pinned`: "Beide Wörter stehen so auch am Schirm").
 *
 * The reset asks nothing, and that is the decision rather than an omission:
 * at a single control there is a visible value and one grip sets it again
 * (#33, ADR 0006). It is also not hidden while the control is `auto` and not
 * `disabled` either — it is the prototype's dimmed, live button
 * (`resetBtn()`): a control that grows a button when it is pinned moves the
 * counter beside it on the first press, and a disabled one reads as broken
 * where it is merely idle (the same argument the `Game` chip carries).
 */
function sheet_pin_head(string $key): void
{
    $k = htmlspecialchars($key, ENT_QUOTES);
    ?>
      <span class="pin-state" :class="`is-${stateWord('<?= $k ?>')}`"
            x-text="stateWord('<?= $k ?>')"></span>
    <?php
}

function sheet_pin_reset(string $key, string $label): void
{
    $k = htmlspecialchars($key, ENT_QUOTES);
    $l = htmlspecialchars($label, ENT_QUOTES);
    ?>
      <button type="button" class="pin-reset" :class="{ 'is-idle': !isPinned('<?= $k ?>') }"
              @click="resetSlider('<?= $k ?>')"
              aria-label="<?= $l ?>, back to the chosen type">&#8634;</button>
    <?php
}

/**
 * One number, as one line: title (with its unit and an optional note),
 * state word, counter, way back. The number appears once, in the counter
 * (#64). `$unit` belongs on the title because it says what the number means.
 * `$note` is an Alpine expression drawn as a short note on the title line —
 * today only `cap N` at `Served ranks`, which #104 put on the title line in
 * its short form, and which wrapped there only because the slider line under
 * it was the row's second line (K4 of run 11, settled by #113). The title
 * does not wrap; where a column is too narrow for title and counter side by
 * side, the counter goes under the title as a whole.
 *
 * **The field** (#113). A typed number counts at Enter or when the field is
 * left — on a phone there is no gesture to cancel, so every leaving is a
 * commit — and until then the plan stands still and the counter is marked
 * `is-draft`: every keystroke computed would drive the plan through wrong
 * intermediate stands. A commit that changes nothing writes and pins nothing,
 * and one that is not a number falls back (`commitTyped()`, over
 * `typedValueAfter()` on the proven side). Escape discards; it exists only at
 * a desk, and nothing hangs on it. After every commit the field is set back to
 * what stands — the bound `:value` alone would not redraw where a typed
 * number was held at a wall onto the value already showing. `−` and `+` write
 * and pin at once.
 *
 * `type="text"` with `inputmode="numeric"` rather than `type="number"`: the
 * latter reads back an empty string for anything it cannot parse, so "not a
 * number falls back" could not be told from "emptied", and its own spinner
 * would be a third pair of arrows beside the `−` and `+`.
 *
 * `data-number-field` is what `confirm-first.mjs` knows a number field by:
 * while one holds an unconfirmed number, a press anywhere else only confirms
 * it (K4 of run 12), and a press into another number field is no activation.
 */
function control_row(string $key, string $label, string $unit = '', string $note = ''): void
{
    $k = htmlspecialchars($key, ENT_QUOTES);
    $l = htmlspecialchars($label, ENT_QUOTES);
    $n = htmlspecialchars($note, ENT_QUOTES);
    ?>
    <div class="sheet-control-head" :class="{ 'is-pinned': isPinned('<?= $k ?>') }">
      <span class="sheet-control-title">
        <span class="sheet-control-label"><?= htmlspecialchars($label) ?><?php if ($unit !== ''): ?>
          <span class="sheet-control-unit"><?= htmlspecialchars($unit) ?></span><?php endif; ?></span>
        <?php sheet_pin_head($key); ?>
        <?php if ($note !== ''): ?>
        <span class="sheet-control-note" x-text="<?= $n ?>"></span>
        <?php endif; ?>
      </span>
      <span class="counter" :class="{ 'is-draft': isDraft('<?= $k ?>') }">
        <button type="button" @click="step('<?= $k ?>', -1)" :disabled="!canStep('<?= $k ?>', -1)"
                aria-label="<?= $l ?>, one less">&minus;</button>
        <input type="text" inputmode="numeric" class="counter-value" aria-label="<?= $l ?>"
               data-number-field="<?= $k ?>"
               autocomplete="off" spellcheck="false"
               :value="value('<?= $k ?>')"
               @focus="$el.select()"
               @input="draft('<?= $k ?>', $el.value)"
               @keydown.enter.prevent="commitTyped('<?= $k ?>', $el.value); $el.value = value('<?= $k ?>')"
               @keydown.escape="discardDraft('<?= $k ?>'); $el.value = value('<?= $k ?>')"
               @blur="commitTyped('<?= $k ?>', $el.value); $el.value = value('<?= $k ?>')">
        <button type="button" @click="step('<?= $k ?>', 1)" :disabled="!canStep('<?= $k ?>', 1)"
                aria-label="<?= $l ?>, one more">+</button>
      </span>
      <?php sheet_pin_reset($key, $label); ?>
    </div>
    <?php
}
