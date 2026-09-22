# SetupLink: the URL encoding is a public interface

The `SetupLink` carries the `pinned` sliders of a `Tournament` in the URL. People
bookmark it — pinned in Discord, kept in a note, opened again months later. Between
sending and opening, the code moves on and the link does not. **The encoding is
therefore an interface, and it must be versioned.**

Decided in ADR 0007. This file is the working rule that follows from it.

## Not yet — the rule has a start date

**There is no encoding yet, no version, and no `SetupLink` in circulation.** Until
there is, renaming a slider key is free: there is no version to bump and no old link
a migration could rewrite. Decided in
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

## What counts as a breaking change

| Change | Migration needed? |
|---|---|
| Rename a slider key | **Yes** — rewrite old key to new |
| Remove a slider | **Yes** — drop the value, and the report names it |
| Change a slider's meaning or unit (count → fraction, absolute → rate) | **Yes** — this is the one a name-stability contract would miss |
| Rename a named step (a `DistributionCurve` level, a `RaffleRange` level) | **Yes** — rewrite old label to new |
| Rename a `Game` or `TournamentType` identifier | **Yes** |
| Remove a `TournamentType` | **Yes** — name its successor; leaving it open is not an option |
| Add a new slider | No — an absent key means "not `pinned`" |
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
It appears only when the chain actually ran — a current-version link shows nothing.

## Caps are not a migration concern

A value from a link is a `pinned` value like any other. ADR 0006 never truncates a
`pinned` value: if it now exceeds a cap, it stands and the `ConflictNotice` offers
the clickable ways out. Do not add a link-specific clamp — the app does not track
that a value came from a URL, and it must not start.
