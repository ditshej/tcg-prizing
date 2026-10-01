# SetupLink: the URL encoding is a public interface

The `SetupLink` carries the `pinned` sliders of a `Tournament` in the URL. People
bookmark it — pinned in Discord, kept in a note, opened again months later. Between
sending and opening, the code moves on and the link does not. **The encoding is
therefore an interface, and it must be versioned.**

Decided in ADR 0007. This file is the working rule that follows from it.

## Not yet — the rule has a start date

**There is an encoding now (v1, `public/link/`), but no `SetupLink` in
circulation:** the app is not deployed (#30 is open). Until it is, renaming a slider
key is free: there is no old link a migration could rewrite. Look the deploy up
before you lean on this — `gh issue view 30` — rather than assuming it is still
open. Decided in
[Etiketten weichen von den Identifiern ab](https://github.com/ditshej/tcg-prizing/issues/27),
which set the deadline in those words — no code, no link out there — and applied it
again in [WinnerPack-Zahl](https://github.com/ditshej/tcg-prizing/issues/29).

From v1 on, everything below holds without exception. Write it down now anyway: the
expensive renames are the ones nobody thought were renames, and the list is easier
to keep honest than to reconstruct.

## The rule

**Whenever you rename a slider key, remove one, or change what one means: bump the
format version and write the `LinkMigration` in the same commit.**

Same for `Game` and `TournamentType` identifiers. They appear in the link as
**stable names, never as list positions** — the order of the `TournamentType` list
is meaningful and may change, so inserting a type is free, but renaming its
identifier is a migration.

**Every link names its base**, `Game` and `TournamentType` both, even when the
sender never touched the start choice. "Only deviations" is a rule about
_sliders_: an absent slider keeps computing and tracks the player count. An absent
type would not compute — it would be _picked_, and "first of the list" is a silent
decision. A link that leaves its base out points at whatever tops the list
tomorrow. Decided in
[Position 1 der TournamentType-Liste](https://github.com/ditshej/tcg-prizing/issues/44).

A version bump without its migration is worse than no version: the app then claims
a compatibility it does not have.

**The example URLs in #47 are examples, not the start choice.** They all read
`type=weekend`, and `weekend` is the *second* `TournamentType` — the first is
`weekly`, which is what a cold start shows. Copy an example string into a test as
an expected value and you get a red run with nothing wrong in the code; it has
cost one already. Read the list off `public/sets/onepiece.mjs`, never off a
sample link.

## What counts as a breaking change

| Change | Migration needed? |
|---|---|
| Rename a slider key | **Yes** — rewrite old key to new |
| Remove a slider | **Yes** — drop the value, and the report names it |
| Change a slider's meaning or unit (count → fraction, absolute → rate) | **Yes** — this is the one a name-stability contract would miss |
| Rename a named step (a `DistributionCurve` level, or a `RANGES` id — `depthStep` and `raffleRange` carry those since run 12) | **Yes** — rewrite old label to new |
| Rename a `Game` or `TournamentType` identifier | **Yes** |
| Remove a `Game` | **Yes** — name its successor |
| Remove a `TournamentType` | **Yes** — name its successor; leaving it open is not an option |
| Add a new slider | No — an absent key means "not `pinned`" |
| Add a key that is not a slider (`CHOICE_KEYS`) | No — an absent key means its term constant (`all`) |
| Insert or reorder `TournamentType`s | No — the link names them, not their position |
| Change a default value in a `DefaultSet` | No — the link carries `pinned` sliders, not defaults |
| Change a cap | No — see "Caps" below |

## Writing a migration

A `LinkMigration` **preserves the result, not the values.** It may set sliders that
never appeared in the old link, as long as the resulting `DistributionPlan` stays as
close as possible to what the sender saw. Reproducing the old numbers literally is
not the goal; reproducing the old plan is.

The counterpart is a hard limit: **invent nothing mechanically.** Where a slider is
gone with no successor, the value is dropped and the report names it. A made-up
replacement would sit there as `pinned` and assert a decision nobody made. What you
write by hand into a migration, you own; what the app would derive on its own, it
must not.

A `TournamentType` is the one thing that cannot simply be dropped — there is no
typeless state. The migration therefore **names the successor**, always; it may not
lean on the first type of the `Game` to catch it. That net still exists, but only
for a name no migration ever knew — a hand-edited URL, a type that left a list
without one. It is an exit for input we cannot read, not a tool of versioning.

Migrations chain: a `v1` link runs `v1→v2` then `v2→v3`. Keep each step small and
mechanical enough to read in one sitting — the chain is only as trustworthy as its
least-examined step.

## On open

The chain runs, the migrated state **applies immediately** (sliders `pinned`), and
the address bar rewrites itself to the current version via `replaceState` — the same
gesture ADR 0005 already prescribes for every slider drag. A one-time overlay above
everything reports what was rewritten and what was dropped, and tells the reader to
save the bookmark again; the original pinned link stays old forever otherwise.

The overlay is dismissible, never returns, and is never encoded in the `SetupLink`.
It appears whenever the report is non-`null` — not only when the chain ran: a
current-version link with an unreadable value loses something too, and stays
silent otherwise (ADR 0007, addendum). A clean link — every key known, every
value readable, no version to lift — shows nothing.

## A link with no readable version is broken, not from the future

Three cases, not two, and the third is the one a build keeps folding into the
second (ADR 0007, `## Nachtrag (#89)`; Lauf 10, Entscheid K1, in the comments of
#89):

| What came in | What happens |
|---|---|
| Nothing at all — a cold start | Not read, not reported, address bar untouched |
| `v` above today's | Base taken, no slider key read, **address bar untouched**, no call to save the bookmark again |
| No readable `v` — absent, `v=`, `v=0`, `v=abc`, `v=1.0` | Base taken, no slider key read, **address bar cleaned up**, and the report asks for the bookmark to be saved again |

The future link keeps its address because it would be complete again on an
updated app. A link with no readable version never becomes complete on any later
app, and `v=0` is a link from the *past* — calling either "newer than this app"
is a false statement, not a rough edge. Its sliders still go unread: without a
version we would be guessing which register to read them by.

**Tell the two apart at the wire, in `decode.mjs`, never at the caller.**
Separate entry kinds, so there is one place that decides and every caller reads
the same answer. And a read whose version was never established must not enter
the chain — `steps.slice(version - 1)` on `version: null` slices at `NaN`, which
is `0`, which is the whole chain over a link that never claimed to be v1.

## Nineteen keys and one more: the link carries everything set by hand

**Every pin travels, without exception** — the maintainer's principle (run 12,
K1 on #72; ADR 0005, addendum run 12): "der link soll alles tragen, was man
eingestellt hat." The wire therefore carries all **19** `Settings` fields
(`KEYS`), the step pin `depthStep` included, and the `Details` sheet draws
**17** — it drops `displays` and `manualWinner`, which are set at the tile. Do
not read a count off one of them to check the other — `CONTEXT.md`,
`SetupLink`, says which is which and names the trap that makes a third number.

**One key stands outside the nineteen: `raffleRange`** (`CHOICE_KEYS`; run 12,
K1b on #72: "Auch die RaffleRange reist im Link mit"). It is set by hand but is
**no `Regler`**: no `Settings` field, no pin, no reset at the element,
untouched by a Set switch. So it is kept out of `KEYS` and out of `pins` —
`encode()` and `decode()` carry it as `choices` — and it counts toward neither
number above. It is written only when it differs from `all`, its term
constant; an unknown range id drops with a report, like any unreadable
value.

_Overruled:_ until run 12 this section said the wire carries 18 and drops
`depthStep` because "the step is reproducible from the base", and told you not
to reconcile the counts. That held only for an **unpinned** step; since #67 the
step chip pins it, and a link that lost the pin showed the receiver a different
depth (`Weekly`, 48 players, `top quarter`: 12 ranks sent, 8 received). Adding
the key needed no version bump — a new key is not a breaking change (table
above), and the start date below the title had not been reached.

What is not set by hand stays out: page, fullscreen, folding, an open bubble,
the raffle bar (#61, "Session state" — overruled there only for the
`RaffleRange`, by K1b). The pin chip beside `Copy link` counts the
`RaffleRange` where it is off `all`, and its drop puts it back to `all` (run 12,
Phase G on #72) — the screen's business; the wire still carries it as a choice,
never as a pin. Of the WinnerRaffle, the `RaffleRange` is the **only** key that
travels: no throw count, no hit list, no last draw (Phase G, `G-raffle-hits`).
A thrown hit does reach the link — as a `manualWinner` pin, because a throw
writes the tile's own counters (#69 AC 5); that collision is open on #72.

## Caps are not a migration concern

A value from a link is a `pinned` value like any other. ADR 0006 never truncates a
`pinned` value: if it now exceeds a cap, it stands and the `ConflictNotice` offers
the clickable ways out. Do not add a link-specific clamp — the app does not track
that a value came from a URL, and it must not start.
