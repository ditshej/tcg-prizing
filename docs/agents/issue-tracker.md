# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either — resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## The closing keyword is English, inside a German description

PR descriptions in this repo are German (`AGENTS.md`). The keyword that makes
GitHub close the ticket on merge is **not** — it only recognises `closes`,
`fixes`, `resolves` and their variants, in English. „Schliesst #53" links
nothing: the PR merges, the ticket stays open, and every ticket blocked by it
stays blocked.

So a PR that finishes a ticket carries a bare English line, on its own, at the
top of the German body:

```md
Closes #53

Der Rechenkern, die nackte Verteilung über die Ränge. …
```

This is not an exception to the language rule but an instance of it: `AGENTS.md`
puts "everything an agent or a compiler reads" in English, and this line is read
by GitHub, not by the maintainer.

Verify it took, rather than trusting the wording — the failure is silent:

```sh
gh api graphql -f query='{repository(owner:"ditshej",name:"tcg-prizing"){
  pullRequest(number:<n>){closingIssuesReferences(first:10){nodes{number}}}}}'
```

An empty list means nothing is linked — **aber erst beim zweiten Mal.** GitHub
baut die Verknüpfung asynchron auf; die Abfrage ist verzögert konsistent, und
ein erster Blick direkt nach dem Öffnen oder Bearbeiten des PR kann leer
antworten, obwohl die Zeile steht und greift. Die Prüfung ist deshalb **einmal
zu wiederholen**, ein paar Sekunden später. Erst eine zweite leere Antwort ist
ein Befund; die erste allein kostet nur eine Korrektur an einem Text, der schon
richtig war.

### And sometimes it never takes — what to do then

Waiting longer is not always the answer. Measured on **2026-09-30** (run 10,
batch #89 · #104): PR #107 and PR #108 each carried `Closes #104` / `Closes #89`
as the bare first line of the body, and the link never appeared — **in neither
direction**, still empty 24 minutes after the PRs were opened.

Ask the other direction too before concluding anything, because it is the one
that tells a missing edge from a delayed query:

```sh
gh issue view <n> --json number,state,closedByPullRequestsReferences \
  --jq '"#\(.number) state=\(.state) closedBy=\(.closedByPullRequestsReferences|map(.number))"'
```

That run got `#89 closedBy=[]` and `#104 closedBy=[]` against `#52 closedBy=[101]`
and `#66 closedBy=[102]` — so the mechanism works in this repo, and the cause is
not the text. Ruled out by measurement: wording (byte-identical in form to the
PRs that did link), base branch (`main` in all four), draft state, author, and
the state of the tickets. What was left sat at GitHub's end and no session could
reach it.

**Do not rewrite a body that is already right, and do not keep waiting.** Decided
in run 10: merge as built, then `gh issue close <n>` by hand. The machine-readable
edge is gone for good, and that is accepted — the price is one lookup, not one
rewrite.

Pay that price the same minute, or the edge is gone twice: **put a comment on the
ticket naming the PR that did the work** ("dieses Ticket wird erledigt von PR
#108, Zweig `…`"). A comment is what the next session reads anyway
(`gh issue view <n> --comments`), and it answers the question GitHub's link list
can no longer answer — "welche Arbeit hat #89 erledigt".

And the reason this matters beyond tidiness: a finished ticket that stays open
sits in the frontier and gets counted into the next batch. Run 9 made exactly
that mistake once.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`. Two things the body carries **from the moment it is created** — both load-bearing for `/map-closure`, neither addable usefully later:
  - A line in `## Notes` pointing at the closure check: „**Leere Frontier ist nicht das Ende.** Sind keine offenen Tickets mehr da, läuft `/map-closure` — mechanisches Gate, Fächer-Lauf mit frischen Linsen, Skeptiker, Triage zu viert. Die Karte ist erst zu, wenn ein **vollständiger** Durchgang null überlebende Funde bringt. Verbrauchte Linsen stehen unten im `## Prüfprotokoll`." This is the load-bearing half. The `## Notes` block is the only part of the map every session is guaranteed to load in full; without this line the session that first sees an empty frontier never finds the skill — the one moment it matters. A section further down does not help: nothing gives that session a reason to scroll there.
  - An empty `## Prüfprotokoll` section, carrying the comment from the skill:

    ```md
    ## Prüfprotokoll

    <!-- verbrauchte Linsen des Abschluss-Checks, eine Zeile je Linse und Durchgang; siehe /map-closure -->

    Noch kein Durchgang gelaufen.
    ```

    A section that appears late is a section no session finds.

  A map already under way retrofits **both, now** — not on its first closure pass. A map close to an empty frontier is precisely the one where retrofitting still changes something.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies** — the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only — the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Read a ticket**: `gh issue view <n> --comments`. **Never the body alone** — not `--json body`, not `gh issue view <n>` without the flag. A wayfinder ticket's body is only its opening question, frozen at charting time; everything a neighbouring ticket learned about it arrives later as a **comment** ("Aus #12 hinzugekommen: …"), posted by whichever session resolved that neighbour. The body therefore goes stale the moment a sibling closes, and a ticket read without its comments is a ticket read wrong — you will re-ask a settled question or miss a constraint that already narrowed it. The same holds when you zoom a **closed** ticket for detail: its answer lives in the resolution comment, never in the body.
- **Claim**: `gh issue edit <n> --add-assignee @me` — the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
