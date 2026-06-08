# Phase 21 — Theory Content Pass: a slide deck for every topic — CONTENT (parallelizable)

Read `docs/CONTENT_AUTHORING.md` and **`docs/THEORY_AUTHORING.md`** (the slide-deck contract) first.
This is a **content** pass: you author `theory.md` slide decks — no engine/renderer edits. It depends
on **Phase 20 being merged** (the slide-deck renderer + the authoring contract). Run on your own git
branch/worktree; touch only your assigned topic folders.

## Goal
Every topic collapsible in **both** curriculums must have a Theory entry. Author a slide-deck
`theory.md` for **every topic folder that has modules but no `theory.md` yet**. Two already exist
(`se200/pointers-arrays-strings`, `se200/recursion`) — leave them. Match their quality and the
recursion exemplar's pacing.

## Topics to cover (one `theory.md` per folder)
**SE 200 (10):**
`se200/hello-world`, `se200/variables-control-flow`, `se200/functions-nested-loops`,
`se200/debugging`, `se200/more-functions-loops`, `se200/more-pointers-arrays-strings`,
`se200/even-more-pointers-arrays-strings`, `se200/static-libraries`, `se200/argc-argv`,
`se200/preprocessor`.

**SE 201 (4):**
`se201/dynamic-memory`, `se201/linked-lists`, `se201/linear-adts`, `se201/hash-tables`.

(If you find any other topic folder under `src/content/se200|se201` with modules but no `theory.md`,
cover it too. Total ≈ 14.)

## The one rule that guarantees correct grouping
For each folder, **open a sibling module in that same folder and copy its exact `course` and `topic`
strings** into the theory frontmatter. The theory `topic` MUST match the modules' `topic` verbatim,
or it won't pin into that collapsible. Never invent course/topic strings; verify against
`docs/CURRICULUM.md`.

```
---
course: <copied exactly from a sibling module in this folder>
topic:  <copied exactly from a sibling module in this folder>
title:  <a clean human title for the concept>
order:  <≈ the topic's module order, so the topic keeps its place; theory pins first regardless>
---
```

## How to author each deck (per `docs/THEORY_AUTHORING.md`)
- Slides separated by a top-level `---`. **Do not write a title slide** — it's auto-generated from
  frontmatter; start with the first concept slide.
- **Per-slide budget:** one idea per slide — a `##` title + one of {3–6 bullets (nesting allowed) /
  one short code block / one callout / a ≤6-row table / 2–3 sentences}. Keep slides light so they fit
  the 16:9 frame at large type.
- **Deck arc:** why it matters → mental model → syntax/rules → patterns → **pitfalls** (use
  `> [!watch-out]`) → a worked example → recap (`> [!recap]`) → a final **"See it run / Continue to
  the visualization →"** slide that names this topic's actual modules.
- Use callouts (`idea` / `watch-out` / `recap`), C code blocks (```` ```c ````, highlighted, ligatures
  off — write `->`, `!=`, `<=`, `*p`, `\0` literally), and tables where they help.
- **Depth:** as detailed as the concept deserves — thorough but not padded. Each topic should feel
  like a complete mini-lecture an instructor can present.

## Accuracy (this is a teaching tool)
Every line of C and every value in a worked example must be correct — hand-check, and cross-check any
computed result with a throwaway calc (no shipped interpreter). Tie each deck back to what its
visualizations actually show.

## Parallelizing
The 14 decks are independent — each is a new `theory.md` in its own folder (additive, auto-discovered,
no shared-file edits). You may shard across several agents (e.g. by course, or in slices of 3–4
folders), each on its own branch/worktree. Stay strictly within your assigned folders.

## Acceptance criteria
1. `typecheck`/`lint`/`test`/`build` pass; no shared-file edits; no trace-format/renderer/design change.
2. A slide-deck `theory.md` exists for **every** listed topic folder (and any other module-bearing
   topic folder lacking one); the two existing decks are untouched.
3. Each deck's frontmatter `course`/`topic` is copied exactly from a sibling module so it pins as the
   topic's Theory entry; `theory.test.ts` passes for all of them.
4. Each deck follows the slide convention (separator, per-slide budget, deck arc, callouts, C code,
   nested lists where used) and matches the exemplars' quality/depth.
5. All C and worked-example values are verified correct; each deck names/links its topic's modules in
   the closing slide.

## When done
Write `reports/phase-21-theory-content-pass.md` (or, if sharded, one report per slice, e.g.
`reports/phase-21a-…`) from `reports/TEMPLATE.md`: §3 list each topic + the deck you wrote; §4 how you
verified the C/values; §5 deviations; §6 "no trace-format change." Do not start another phase.
