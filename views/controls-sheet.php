<?php
/**
 * The Details sheet (#64): the Set block, then all seventeen controls — the
 * four hot ones first, without a group title of their own, then the groups.
 *
 * PHP composes it because none of it changes while a slider is dragged
 * (#61, "The seam": "Gerüst, die Flächen-Container, Gruppentitel,
 * Erklärtexte, die ⓘ-Texte"). What a control *shows* — its number, its two
 * ends, whether a ± is still allowed — comes from `planApp()` over
 * `public/ui/controls.mjs`, which is where the caps live so that slider and
 * counter cannot disagree (#64: "Schieber und Zählwerk kennen denselben
 * Deckel").
 *
 * Why this is a partial of its own and not an extension of
 * `controls-hot.php`: that file is the fixed rail under `Plan` and #63 owns
 * it. Two things here are true only of the sheet — the explanation text under
 * every title (#64's last criterion says it appears *only* here) and the
 * counter — so the two forms differ, and the sheet's cannot be reached by
 * adding to the rail's without changing the rail. Both call the same handlers
 * in `plan.mjs`, so they cannot drift in what they *do*; when #71 folds the
 * page into columns, the rail disappears into this sheet and the question
 * settles itself.
 *
 * Where `Rank pool` went: #61's fourth group is "how deep, how flat, how
 * steep" — `depth`, `rankFloor`, `curve` — and those three are exactly the
 * hot ones hoisted to the top, which #64 says carry no group title. What
 * would be left of the group is the Display reservation list, and that is set
 * at the tile (#66), not here. So the group is not drawn.
 */

/**
 * One control: title, counter, explanation, slider — in that order, and the
 * number appears once, in the counter. `$unit` belongs on the title because
 * it says what the number means and is part of the label, not a note under
 * the slider.
 */
function sheet_control(string $key, string $label, string $desc, string $unit = ''): void
{
    $k = htmlspecialchars($key, ENT_QUOTES);
    $l = htmlspecialchars($label, ENT_QUOTES);
    ?>
  <div class="sheet-control">
    <div class="sheet-control-head">
      <span class="sheet-control-label"><?= htmlspecialchars($label) ?><?php if ($unit !== ''): ?>
        <span class="sheet-control-unit"><?= htmlspecialchars($unit) ?></span><?php endif; ?></span>
      <span class="counter">
        <button type="button" @click="step('<?= $k ?>', -1)" :disabled="!canStep('<?= $k ?>', -1)"
                aria-label="<?= $l ?>, one less">&minus;</button>
        <span class="counter-value" x-text="value('<?= $k ?>')"></span>
        <button type="button" @click="step('<?= $k ?>', 1)" :disabled="!canStep('<?= $k ?>', 1)"
                aria-label="<?= $l ?>, one more">+</button>
      </span>
    </div>
    <p class="sheet-desc"><?= htmlspecialchars($desc) ?></p>
    <input type="range" aria-label="<?= $l ?>"
           :min="bounds('<?= $k ?>').min" :max="bounds('<?= $k ?>').max" :value="value('<?= $k ?>')"
           @input="setSlider('<?= $k ?>', $event.target.value)">
  </div>
    <?php
}
?>

<!--
  The Set block stands in the body, above the hot four, and scrolls with them:
  fixed in the column head it would cost a measured 101px permanently, a
  quarter of the height in phone landscape, for a row touched once an evening
  (#41, CONTEXT.md `TournamentType`). Two levels, and the indent is the whole
  form of the nesting — no disclosure, no frame, no rule: a line is only
  allowed where it separates data (#15), and here it subordinates.
-->
<div class="set-block">
  <div class="set-row">
    <span class="set-label">Game</span>
    <span class="set-chips">
      <template x-for="game in games" :key="game.id">
        <!--
          Already chosen, and tapping it does nothing. It is not disabled: the
          button is the invitation — "yours could stand here" — and a greyed
          one would read as broken rather than settled (CONTEXT.md, `Game`).
        -->
        <button type="button" class="set-chip" :aria-pressed="game.id === gameId"
                @click="setGame(game.id)" x-text="game.title"></button>
      </template>
    </span>
    <button type="button" class="info" @click="toggleInfo('game')"
            :aria-expanded="openInfo === 'game'" aria-label="About the game level">i</button>
  </div>

  <!--
    One ⓘ per level, each with its own sentence: what tells the two apart — a
    complete sheet above, deviations only below — is exactly what has to be
    explained, and a sentence about "the sets" would not say it (#26, #41).
  -->
  <div class="set-info" x-cloak x-show="openInfo === 'game'">
    <p>The card game this tournament runs for. It carries a full sheet of starting
      values — every slider below starts somewhere here.</p>
    <p class="set-info-muted">One Piece is the only one set up so far. The address names
      a single game; the app does not — built for One Piece, other games welcome.</p>
    <p class="set-info-foot">Run a different game? Say so on Discord —
      <!--
        Tag and profile URL are the maintainer's own, given in #64 ("Lauf 8 ·
        Angabe"); the value the prototype carried as a placeholder happened to
        be the same number, and it is no longer one.

        The link opens the Discord app, and a reader without an account lands
        on a sign-in page instead of the profile. That is known and taken: #64
        asks for the profile URL and not for a server invite, which would be
        the robust form. The tag therefore stays visible beside it — where the
        link goes nowhere, it has to be typeable.
      -->
      <a href="https://discord.com/users/428891117220659241" target="_blank"
         rel="noreferrer"><strong>ditshej</strong></a></p>
  </div>

  <div class="set-sub">
    <div class="set-row">
      <span class="set-label">Type</span>
      <span class="set-chips">
        <template x-for="type in types" :key="type.id">
          <button type="button" class="set-chip" :aria-pressed="type.id === typeId"
                  @click="setType(type.id)" x-text="type.title"></button>
        </template>
      </span>
      <button type="button" class="info" @click="toggleInfo('type')"
              :aria-expanded="openInfo === 'type'" aria-label="About the tournament type level">i</button>
    </div>

    <!--
      The full name is carried here, and that is what the shortened label is
      allowed to lean on: `Type` beside the buttons is a shortening of
      `TournamentType`, not a replacement for it, so it needs no `_Label_` line
      in the glossary — on the condition CONTEXT.md states in the same breath,
      that "der volle Name steht zwei Zentimeter weiter im ⓘ der Ebene"
      (CONTEXT.md, `TournamentType`). Without this opening the label would be a
      shortening of nothing on screen.
    -->
    <div class="set-info" x-cloak x-show="openInfo === 'type'">
      <p><strong>Tournament type</strong> — the format inside the game, and a Weekly is
        set up differently from a weekend event. A type carries only what it does
        differently; the rest it takes from the game above.</p>
      <!--
        The sentence that was wrong in the prototype's own group heading and is
        corrected here: a switch overwrites nothing set by hand (#26, ADR 0003).
      -->
      <p class="set-info-muted">Switching replaces the whole sheet. Sliders you set by
        hand stay where you put them.</p>
    </div>
  </div>
</div>

<!--
  The four hot ones, first and without a group title — the page head above is
  their title (#64). "First" is an arrangement and not an assurance: the
  column scrolls, and a glued block of four costs a measured 330 of 375px in
  phone landscape, which rules it out (#38, #61).
-->
<div class="sheet-block">
  <?php sheet_control('players', 'Players', 'How many players are registered. Every pool below is counted from this number.'); ?>

  <div class="sheet-control">
    <div class="sheet-control-head">
      <span class="sheet-control-label">Served ranks</span>
      <span class="counter">
        <button type="button" @click="step('depth', -1)" :disabled="!canStep('depth', -1)"
                aria-label="Served ranks, one less">&minus;</button>
        <span class="counter-value" x-text="value('depth')"></span>
        <button type="button" @click="step('depth', 1)" :disabled="!canStep('depth', 1)"
                aria-label="Served ranks, one more">+</button>
      </span>
    </div>
    <p class="sheet-desc">How far down the standings the prizes reach. Ranks below get nothing.</p>
    <!--
      The step grid is `depthStep`, the seventeenth field: a DefaultSet entry
      that supplies the starting value while the slider itself stays absolute
      (CONTEXT.md, `RankPoolDepth`). It is therefore part of this control, not
      a control beside it.
    -->
    <div class="step-grid">
      <template x-for="step in depthSteps" :key="step.id">
        <button type="button" class="step-chip" :aria-pressed="settings.depthStep === step.id"
                @click="setSlider('depthStep', step.id)" x-text="step.label"></button>
      </template>
    </div>
    <input type="range" aria-label="Served ranks"
           :min="bounds('depth').min" :max="bounds('depth').max" :value="value('depth')"
           @input="setSlider('depth', $event.target.value)">
    <p class="sheet-foot" x-text="`the pool covers ${plan.depthCap} ranks at this floor`"></p>
  </div>

  <div class="sheet-control">
    <div class="sheet-control-head">
      <span class="sheet-control-label">Curve</span>
    </div>
    <p class="sheet-desc">How steeply the boosters drop from one rank to the next. It only
      shapes what is left over the floor.</p>
    <div class="curve-steps">
      <template x-for="step in curveSteps" :key="step.id">
        <button type="button" class="curve-step" :aria-pressed="settings.curve === step.id"
                :title="`${step.id} · ×${step.ratio}`" @click="setSlider('curve', step.id)">
          <template x-for="(height, i) in curveBars(step)" :key="i">
            <i :style="`height:${height}px`"></i>
          </template>
        </button>
      </template>
    </div>
    <p class="sheet-foot" x-text="`${settings.curve} — each rank gets ${Math.round(curveRatio * 100)}% of the rank above`"></p>
  </div>

  <?php sheet_control('rankFloor', 'Min boosters per rank', 'The smallest number of boosters any served rank may get. Raising it flattens the whole plan.'); ?>
</div>

<div class="sheet-group">
  <h2 class="sheet-group-head">Supply</h2>
  <p class="sheet-desc">What is in the box before anything is split — the boosters, the packs,
    and how they are boxed.</p>
  <?php sheet_control('boosterRate', 'Boosters per player (pool)', 'How many boosters the prize pool holds per player. This is the whole booster supply.'); ?>
  <?php sheet_control('displaySize', 'Boosters per display', 'How many boosters come in one display box — decides how many displays to fetch.'); ?>
  <?php sheet_control('tournamentPacks', 'Tournament packs available', 'How many tournament packs are on hand. Left alone it follows one per player.'); ?>
  <?php sheet_control('envelopeSize', 'Tournament Packs per Promo-Envelope', 'How many tournament packs one Promo-Envelope holds. Full envelopes are what yield the winner packs.'); ?>
  <?php sheet_control('envelopeYield', 'Winner packs per Promo-Envelope', 'How many winner packs one Promo-Envelope holds. An opened envelope counts them off as it empties.'); ?>
</div>

<div class="sheet-group">
  <h2 class="sheet-group-head">Split the pool</h2>
  <p class="sheet-desc">What comes off the top for everyone and for the judge, before the ranks
    are served.</p>
  <?php sheet_control('participationBooster', 'Participation boosters', 'Boosters every player gets just for showing up. Taken off the pool before the ranks.', 'per player'); ?>
  <?php sheet_control('participationPack', 'Participation packs', 'Same for tournament packs — handed to everyone before the ranks are served.', 'per player'); ?>
  <?php sheet_control('judgeBooster', 'Judge boosters', 'Boosters set aside for the judge before anything else is distributed.'); ?>
  <?php sheet_control('judgeWinner', 'Judge winner packs', 'Winner packs reserved for the judge.'); ?>

  <div class="sheet-control">
    <h3 class="sheet-subhead">Handout</h3>
    <p class="sheet-desc">Whether participation prizes travel in the same handful as the rank
      prizes, instead of being handed out separately.</p>
    <label class="sheet-check">
      <input type="checkbox" :checked="settings.combinedHandout"
             @change="setSlider('combinedHandout', $event.target.checked)">
      <span>Hand participation prizes out together with rank prizes</span>
    </label>
  </div>
</div>

<div class="sheet-group">
  <h2 class="sheet-group-head">Winner packs</h2>
  <p class="sheet-desc">The scarce prize. Either strictly by rank, or drawn by the Winner raffle.</p>
  <?php sheet_control('winnerPacks', 'Winner packs available', 'The ceiling for winner packs. The Promo-Envelopes yield a number; by hand you may put more on the table.'); ?>
  <?php sheet_control('ranked', 'Winner packs by rank', 'How many winner packs go out strictly by rank, starting at rank 1. The rest stay open for the raffle.'); ?>

  <!--
    The RaffleRange is **no control** but session state of the WinnerRaffle's
    operating step (#69, #61): no pin mark, no reset button, not counted in
    `Drop all N`, never in the SetupLink, and a Set switch leaves it standing.
    So what stands here is a **pointer** — and above all the explanation text:
    the bar has no room for one, and without this line the RaffleRange would
    lose its only explanation in the whole program (prototype, `winnerBlock()`).

    It carries the current step so the pointer is worth reading even when one
    is not going to the legend; it carries no way to change it, because the
    place to change it is the one this text points at.
  -->
  <div class="sheet-control">
    <h3 class="sheet-subhead">Raffle range</h3>
    <p class="sheet-desc">Which ranks the Winner raffle may draw from when it places an open
      winner pack.</p>
    <p class="sheet-foot">Raffled from the legend above the tiles — the handle on
      <strong>winner</strong>, where the range is set too. Currently
      <strong x-text="raffle.rangeName"></strong>,
      <span x-text="`${raffle.open} winner ${raffle.open === 1 ? 'pack' : 'packs'} still open`"></span>.</p>
  </div>
</div>
