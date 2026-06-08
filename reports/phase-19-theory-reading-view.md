# Phase 19 Report — Theory & Reading View

## 1. Summary

SE-Viz now *tells* as well as *shows*. This phase adds a **theory layer**: long-form, read-first
conceptual explanations authored as Markdown, one per sidebar **topic**, discovered automatically and
surfaced as a **Theory** entry pinned at the top of each topic group. Selecting it opens a
typography-focused **reading view** (breadcrumb · article · "Continue to the visualization →"), so a
session runs **theory → visualization**. The phase delivers the full **capability** — a dependency-
free, typed Markdown engine; a `theory.md` content type discovered via a `?raw` glob and merged into
the catalog; a safe Markdown renderer (headings, prose, lists, tables, C-highlighted code, and
coach-styled callouts); sidebar + app integration — and proves it with **two thorough exemplar docs**
(Pointers/Arrays/Strings and Recursion). It is fully **additive**: theory is a separate content type,
not a `Trace`; the trace format, `validateTrace`, and every existing module are untouched.
`typecheck`/`lint`/`test` (120)/`build` all pass; no `any`.

Branch: `phase-19-theory-reading-view`, cut from `main`.

## 2. What I built

- **Markdown engine** — `src/engine/markdown.ts`: `parseFrontmatter` (flat YAML-ish) +
  `parseMarkdown` → a **typed AST** (`Block`/`InlineNode`). Pure, dependency-free, and rendered to
  React (never to an HTML string), so it is **safe by construction**. (+ `markdown.test.ts`, 9 tests.)
- **Theory content type + discovery** — `src/content/theory.ts`: `TheoryDoc`, a `?raw`
  `import.meta.glob('./**/theory.md')`, frontmatter parse, and `THEORY_BY_TOPIC` / `THEORY_BY_ID`
  lookups + a `theoryId()` selection-id scheme that never collides with a trace id.
- **Catalog merge** — `src/content/catalog.ts`: `CatalogTopic.theory?` (pinned first), theory-only
  topics surfaced, `firstModuleOfTopic()` for the continue bridge. Module auto-discovery unchanged.
- **Markdown renderer** — `src/components/Markdown.tsx`: headings (h1–h3 scale), readable prose,
  lists, blockquotes, GFM tables, fenced **C code blocks highlighted via `highlightC` in `.se-code`
  (ligatures off)**, and **callouts reusing the coach variant tokens + glyph** (`VariantIcon` now
  exported from `CoachBubble.tsx`). Links sanitised to http(s)/mailto/in-page.
- **Reading view** — `src/components/ReadingView.tsx`: breadcrumb (course · topic · Theory), title,
  scrollable keyboard-focusable article at a comfortable measure (`max-w-[70ch]`), and a
  **"Continue to the visualization →"** button to the topic's first module.
- **Sidebar + app** — `ContentSidebar.tsx` renders a distinct **Theory** entry (book icon, azure,
  "read") pinned above a topic's modules; `App.tsx` resolves a selection as theory-or-module and
  renders `ReadingView` or `Workbench` accordingly.
- **Exemplars** — `src/content/se200/pointers-arrays-strings/theory.md` and
  `…/recursion/theory.md` (≈180–210 lines each, accurate C, all callout variants, worked examples).
- **Docs** — new `docs/THEORY_AUTHORING.md` (the content-pass contract) + pointers added to
  `docs/CONTENT_AUTHORING.md` and `docs/TRACE_FORMAT.md`.
- **Validation** — `src/content/theory.test.ts` (frontmatter required fields + course/topic resolve
  against the catalog and are pinned in).

## 3. Acceptance criteria — self-assessment

- [x] **1. `typecheck`/`lint`/`test`/`build` pass; no unjustified `any`; existing modules/traces and
  `validateTrace` unaffected.** All four green; 120 tests (was 105 + 15 new). No `any`
  (`import.meta.glob<string>` is typed). Theory is additive — no trace, renderer, or `validateTrace`
  change; the catalog per-trace validation test still passes for every trace.
- [x] **2. Theory `.md` (with frontmatter) discovered + merged into the course→topic tree, pinned
  first; module auto-discovery contract unchanged.** `theory.ts` `?raw` glob → `catalog.ts` attaches
  `topic.theory`; the sidebar renders it before the modules. The module glob (`./*/*/*.ts`) is
  untouched.
- [x] **3. Reading view renders markdown with design tokens — headings, prose, lists, callouts, and
  C code blocks (highlighted, ligatures off) — in both themes, safely (no raw HTML), legible at
  presentation scale.** Verified in-browser (light + dark): headings, lists, tables, `idea`/`watch-
  out`/`recap` callouts, and highlighted C blocks. No `dangerouslySetInnerHTML`; a `<script>…` test
  asserts angle brackets render as literal text.
- [x] **4. Theory entries appear distinctly at the top of each topic; selecting opens the reading
  view; the continue link jumps to the topic's first module; no nav regressions.** Verified: book-
  icon azure "Theory · read" entry; clicking it opens the reading view; "Continue to the
  visualization →" opened **Pointer basics** (the topic's first module) in the Stage. Course
  dropdown + collapsibles still work.
- [x] **5. 1–2 thorough exemplar docs that demonstrate structure/depth and pass the theory
  validation.** Two docs (Pointers/Arrays/Strings, Recursion) — what/why, mental model, syntax/rules,
  patterns, pitfalls (callouts), worked example, "see it run", summary. Both pass `theory.test.ts`.
- [x] **6. Authoring convention documented (location, frontmatter, structure, depth, code/callout
  rules, viz-link).** `docs/THEORY_AUTHORING.md`, linked from CONTENT_AUTHORING + TRACE_FORMAT.
- [x] **7. A test validates theory frontmatter + course/topic resolution.** `theory.test.ts`:
  required fields present + `course`/`topic` resolve to a real catalog topic and the doc is pinned in.

### The theory file convention (the contract the content pass depends on)

- **Location / name:** one `theory.md` per topic at `src/content/<course>/<topic>/theory.md`. Auto-
  discovered; no shared-file edit needed.
- **Frontmatter (required):** `course` (must match `docs/CURRICULUM.md`), `topic` (must match the
  topic its modules use), `title`; `order` recommended (theory pins first regardless).
- **Callout syntax:** a blockquote starting `> [!idea] Optional title` → a callout styled with the
  coach variant tokens. Set = `idea`, `watch-out`, `predict`, `recap` (unknown → plain blockquote).
- **Code:** ```` ```c ```` blocks get C highlighting, ligatures off. **Underscores are not emphasis**
  (so `node_t` reads literally); wrap C in backticks. Full subset + depth expectation
  ("as detailed as the concept deserves") in `docs/THEORY_AUTHORING.md`.
- **Exemplars written for:** *Pointers, Arrays and Strings* (SE 200) and *Recursion* (SE 200).

## 4. How to run & verify

```bash
npm install
npm run typecheck && npm run lint && npm run test && npm run build   # all pass
npm run dev
```

- In the sidebar (SE 200), expand **Pointers, Arrays and Strings** (or **Recursion**) → click the
  azure **Theory** entry at the top. The reading view opens: breadcrumb (SE 200 · Pointers, Arrays
  and Strings · Theory), the article (headings, lists, a table, highlighted C blocks, `idea` /
  `watch-out` / `recap` callouts).
- Scroll to the end → **Continue to the visualization →** jumps to the topic's first module
  (Pointer basics) and opens the Stage. Toggle the theme (top-right) — legible in both.

## 5. Key decisions & deviations

- **Hand-rolled Markdown engine (no library).** The prompt allowed "a tiny parser or a lib." I chose
  a small, fully-typed, dependency-free engine that renders to React (not to an HTML string). This
  guarantees the "no raw HTML" requirement **by construction**, needs no sanitiser, integrates the
  custom `[!callout]` syntax and `highlightC` directly, and matches the project's zero-dependency
  ethos (`highlightC`, the hand-rolled YAML-ish frontmatter). Cost: it supports a **documented subset**
  of Markdown (headings, paragraphs, lists, tables, blockquotes/callouts, fenced code, `**bold**`
  `*italic*` `` `code` `` links) — authored content stays within it. `_underscores_` are deliberately
  **not** emphasis so C identifiers render literally.
- **Theory `order` = the topic's min module order (50 / 80).** Keeps each topic in its existing place
  while theory still pins first *within* the topic.
- **No separate "presentation mode" for theory.** The `f` presentation toggle is module/player-
  specific. The reading view is instead made comfortable and legible at large window scale (criterion
  3's "presentation scale"); a dedicated theory-present mode wasn't required and would be scope creep.
- **Theory entries only where a `theory.md` exists** (per the prompt: "missing theory is fine"). No
  empty "Theory" rows; theory-only topics (none currently) are still supported by the catalog merge.
- **Two exemplars** (the suggested pair), matching the "1–2" target — not a broad pass (a non-goal).

## 6. Trace format / API notes

**No trace-format change.** New, additive shared surface:

- `CatalogTopic.theory?: TheoryDoc | undefined` (in `src/content/catalog.ts`) — pinned-first theory.
- `TheoryDoc` + `THEORY_BY_TOPIC` / `THEORY_BY_ID` / `theoryId()` (in `src/content/theory.ts`).
- `firstModuleOfTopic(course, topic)` (catalog helper) for the continue bridge.
- `Block` / `InlineNode` / `parseMarkdown` / `parseFrontmatter` (in `src/engine/markdown.ts`).
- `VariantIcon` is now **exported** from `CoachBubble.tsx` (shared with theory callouts).
- Selection ids are now either a trace id **or** a `theory:<course>::<topic>` id; `App` discriminates.

## 7. Known issues / follow-ups

- **Broad theory authoring is a later content pass** — only the two exemplars exist now.
- **Markdown subset is intentionally small.** No nested lists, no inline images, no footnotes, no
  multi-line block comments inside code highlighting (the C tokenizer is line-based, as in the code
  panel). Add to the engine if a future doc needs more — and extend `markdown.test.ts`.
- Theory `order` is authored to match the topic; if a topic's module orders change drastically, the
  theory `order` should be revisited (it only affects topic position, never the pin-first behavior).

## 8. File map

```
src/engine/
  markdown.ts            # NEW — typed, dependency-free Markdown parser (frontmatter + AST)
  markdown.test.ts       # NEW — parser unit tests
src/content/
  theory.ts              # NEW — TheoryDoc type + ?raw discovery + lookups
  theory.test.ts         # NEW — frontmatter + course/topic resolution validation
  catalog.ts             # + CatalogTopic.theory (pinned first) + firstModuleOfTopic (additive)
  se200/pointers-arrays-strings/theory.md   # NEW — exemplar
  se200/recursion/theory.md                 # NEW — exemplar
src/components/
  Markdown.tsx           # NEW — safe AST→React renderer (tokens, C code, callouts, tables)
  ReadingView.tsx        # NEW — reading pane (breadcrumb, article, continue-to-viz)
  ContentSidebar.tsx     # + pinned Theory entry (book icon, azure) + selection
  CoachBubble.tsx        # export VariantIcon (shared glyph for theory callouts)
  ../App.tsx             # selection model: theory → ReadingView, module → Workbench
docs/
  THEORY_AUTHORING.md    # NEW — the theory authoring contract (content-pass seed)
  CONTENT_AUTHORING.md   # + pointer to THEORY_AUTHORING
  TRACE_FORMAT.md        # + "not a trace: theory docs" note
reports/phase-19-theory-reading-view.md     # this file
```
