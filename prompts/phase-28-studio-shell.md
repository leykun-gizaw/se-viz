# Phase 28: Studio shell (resizable workspace and step explanation panel)

## Why this phase exists
SE-Viz is getting a Python mode for DS 200 and DS 210 (see `docs/PYTHON_DS_ROADMAP.md`). Before any
Python work, the player chrome moves to the chosen "Studio" layout (Direction A on the "SE-Viz
Redesign Directions" design canvas). This phase ships that shell for the **existing C modules**, so
SE 200 / SE 201 sessions get it first and the Python phases plug into a finished frame.

The design is an evolution, not a rebrand: same tokens (`--se-*`), same fonts (Manrope, JetBrains
Mono), same color semantics, same dark and light themes.

## Target layout (left to right)
1. **Course map** (existing `ContentSidebar`): resizable width, collapsible to a slim rail with an
   expand button. Labels in sentence case, readable size, no truncation at the default width.
2. **Stage:** code panel and memory panel side by side (the existing `Stage` split stays), with the
   one-line narration moved into a card **under the code**, next to the line it describes.
3. **Step explanation panel** (new, right): resizable width, collapsible to a slim rail with a
   vertical label. Sections are collapsible (`<details>`), with these defaults open: "What this
   step did", "What changed", "Previous step". "Coming next" and "Concept" start closed.
4. **Timeline** (bottom of the stage): the step bar plus labeled event markers (e.g. "loop
   iteration 2", "factorial(3) returns"), clickable to jump.

Every vertical boundary is resizable by pointer and keyboard. Widths and collapsed states persist
(`usePersistentState`). Presentation mode is unchanged except that it may show the explanation
panel if the presenter left it open (default: hidden).

## Context to read
- `src/App.tsx`, `src/components/Stage.tsx` (already uses `react-resizable-panels`),
  `ContentSidebar.tsx`, `TopBar.tsx`, `Transport.tsx`, `NarrationBar.tsx`, `CoachBubble.tsx`,
  `PresentationMode.tsx`.
- `src/engine/trace/types.ts` (`Step`, `CoachNote`), `diff.ts`, `beats.ts`, `useTrace.ts`.
- `src/hooks/usePersistentState.ts`, `useTheme.ts`, `src/index.css`.
- The design canvas, Direction A, dark and light artboards (Leykun will share the link).

## Hard constraints
- Frontend only, TS strict. `typecheck` / `lint` / `test` / `build` pass.
- **No new dependencies.** Use `react-resizable-panels` (already installed) for every split.
- Trace format changes are **additive and optional only**. Every existing trace renders and steps
  exactly as before; all existing tests and snapshots pass untouched unless a snapshot covers chrome
  you intentionally changed (list each one in the report).
- Both themes are first-class. Every new surface uses `--se-*` tokens, no hard-coded colors.
- No AI, no quiz, no "predict" UI added by this phase. Existing coach notes keep working as they are.
- Accessibility: resize handles are focusable and operable with arrow keys; collapse buttons have
  `aria-label`s; the explanation panel is a labeled landmark.

## What to build
1. **Workspace layout:** one outer horizontal panel group: course map | stage | explanation. Collapse
   uses the library's collapsible panels; the rail shows only an expand button (and a vertical label
   for the explanation panel). Sensible min/max widths; the stage never drops below a usable width.
2. **Step explanation model (additive):** add an optional `explain?: StepExplanation` to `Step` with
   `did?: string[]` (ordered breakdown, Markdown inline allowed), `concept?: string`. Document it in
   `docs/TRACE_FORMAT.md` and `types.ts`.
3. **Explanation panel content**, computed per beat:
   - Header chip: step number and highlighted line(s), plus the current source line.
   - **What this step did:** `explain.did` if present, else the step's `narration`.
   - **What changed:** derived from `diffSteps(prev, current)` (value changes old to new, pointer
     retargets, frames pushed or popped, heap blocks allocated or freed). Show "Nothing changed" when
     the diff is empty.
   - **Previous step:** previous step's line(s) and narration.
   - **Coming next:** next step's line(s) and narration. Respect two-beat mode: on an `arrive` beat
     the panel describes the step as "About to run" and does not reveal its effects yet.
   - **Concept:** `explain.concept` if present, else hidden.
4. **Narration placement:** narration card under the code panel; remove the separate bottom
   narration bar from the normal view (presentation mode keeps whatever it shows today).
5. **Timeline markers:** derive event labels from the trace (frame push/pop, loop back-edges where
   detectable from `highlightedLines`, authored `beats` if any). Keep it simple: if a reliable label
   can't be derived, show no marker rather than a wrong one.
6. **Sidebar polish:** sentence-case labels, larger type, no ellipsis at default width, current item
   clearly marked.
7. **Exemplar:** add `explain` data to two existing modules (one SE 200 recursion module, one SE 201
   linked-list module) so the panel shows authored content, not just fallbacks.

## Tests
- Explanation derivation (pure function): authored vs fallback, diff to "What changed" rows,
  first step (no previous), last step (no next), arrive vs apply beat.
- Persistence: widths and collapsed states survive reload (hook-level test).
- Resize and collapse: the layout state logic (keyboard step size, min/max clamping, collapse and
  restore) lives in a pure helper with unit tests. Markup checks use `renderToStaticMarkup`, like
  `Diagram.test.tsx`. The test environment is `node`; do not add jsdom or Testing Library.
- Existing traces validate and render unchanged.

## Acceptance criteria
1. Gates pass; no new dependency; trace changes are additive and documented.
2. All three panels resize by pointer and keyboard; course map and explanation collapse to rails and
   restore; state persists across reloads.
3. The explanation panel shows correct content for every step of the two exemplar modules, in both
   stepping modes, and sensible fallbacks for every other module.
4. Both themes look right on every new surface (screenshots of each in the report).
5. Live Coding, Theory decks and presentation mode still work.

## When done
Write `reports/phase-28-studio-shell.md` from the template, with dark and light screenshots of a
recursion module mid-trace, the collapsed rails, and a narrow-width layout. Work on branch
`phase-28-studio-shell`. **Stop without merging** (when running under `prompts/RUNNER-ds-python.md`, follow its merge
rule instead).
