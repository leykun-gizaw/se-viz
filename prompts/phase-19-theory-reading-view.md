# Phase 19 — Theory & Reading View (capability + exemplars) — SOLO engine

## Why this phase exists
SE-Viz teaches by *showing* (code + animated memory) but has almost no *telling* — the conceptual
explanation a good lesson opens with. This phase adds a **theory layer**: detailed, long-form
written explanations, one per concept, surfaced in the sidebar and meant to be read **first**, so a
learning session runs **theory → visualization**.

This phase builds the **capability** (a markdown theory content type + a reading view + sidebar
integration) and proves it with **1–2 exemplar theory documents**. A later phase (the theory content
pass) authors detailed theory for every concept once you've validated the reading experience. This
is a **solo** phase (it touches the catalog, sidebar, and adds a renderer).

## Decisions already made (build to these)
- **Per concept / topic**: one theory doc per sidebar topic group (e.g. "Pointers, Arrays and
  Strings"), pinned at the **top** of that topic's collapsible, before its visualization modules.
- **Markdown authoring**: theory is written as `.md` files (headings, prose, code, callouts),
  discovered like modules and rendered by a reading view.
- **Capability + a few exemplars first** (this phase); the full content pass is a later phase.

## Context to read
- `src/content/catalog.ts` (auto-discovery + grouping), `src/content/module.ts`,
  `src/components/ContentSidebar.tsx`, `src/App.tsx`, `src/components/Stage.tsx` (what renders a
  selection), `src/engine/highlightC.ts` (C highlighting for code blocks), `src/index.css` (tokens).
- `docs/CURRICULUM.md` (authoritative course/topic names), `docs/CONTENT_AUTHORING.md`,
  `docs/TRACE_FORMAT.md`, `docs/design/` (reuse tokens — no restyle; comfortable reading typography).

## Hard constraints
- Frontend only, TS strict, no `any` without justification (markdown-lib types permitting; isolate
  and comment any unavoidable cast). `typecheck`/`lint`/`test`/`build` pass.
- **Additive**: theory is a **separate content type**, NOT a `Trace`. Do not reshape the trace
  format. All existing modules/traces and `validateTrace` keep working unchanged.
- Reuse the design system/tokens (no restyle). Render markdown **safely** — do not enable raw HTML.

## Feature A — theory content type + discovery
- Author theory as **Markdown files** living in the topic folders, e.g.
  `src/content/<course>/<topic>/theory.md` (pick a clear, consistent name/convention).
- Use **YAML frontmatter** for metadata: `course`, `topic` (must match `docs/CURRICULUM.md`),
  `title`, and `order` (theory sorts before that topic's modules). Parse frontmatter with a small,
  well-scoped approach (a tiny parser or a lib) — keep it simple and typed.
- Discover theory docs via a markdown glob (e.g. `import.meta.glob('./**/theory.md', { query:
  '?raw', eager: true })` or equivalent) and merge them into the existing course→topic catalog tree,
  **pinned first within each topic**. Keep the module auto-discovery contract unchanged.
- A topic may have a theory doc, modules, or both; missing theory is fine (just no Theory entry).

## Feature B — the reading view
A typography-focused reading pane shown when a Theory entry is selected (replacing the Stage), using
the design tokens:
- Render markdown: headings (map to the design's h1–h3 scale), paragraphs at a **comfortable reading
  measure and line-height**, lists, blockquotes, tables, inline code, and **fenced code blocks with
  C syntax highlighting and ligatures off** (reuse `highlightC`/the `.se-code` convention).
- Support a small set of **callouts/admonitions** (e.g. `> [!idea]`, `> [!watch-out]`) styled to
  match the coach variant tokens (idea / watch-out / etc.) — so theory and in-viz coaching share a
  visual language. Keep the set small and documented.
- Works in **dark (primary) and light**, and is legible at **presentation scale**; scrollable,
  keyboard-accessible, respects `prefers-reduced-motion`.
- A clear **"Continue to the visualization →"** affordance that jumps to the first visualization
  module in the same topic (the theory→viz bridge). Show a breadcrumb (course · topic · Theory).

## Feature C — sidebar integration
- Render the Theory entry **at the top of each topic group**, visually distinct from visualization
  modules (e.g. a reading/book icon + a subtle label treatment) so it reads as "start here."
- Selecting Theory opens the reading view; selecting a module opens the Stage exactly as today. No
  regression to existing navigation, the course dropdown, or collapsibles.

## Feature D — exemplar theory docs (set the depth bar)
Write **1–2 detailed exemplar theory docs** for high-value concepts — suggest **"Pointers, Arrays
and Strings" (SE 200)** and **"Recursion" (SE 200)**. Make them genuinely thorough and well
structured (this sets the standard for the content pass), e.g.: what the concept is and why it
matters; the mental model; syntax and key rules; common patterns; **common pitfalls/misconceptions**;
a worked example; an explicit pointer to the matching visualization ("see it run →"); a short
summary. Use callouts where they help. Accurate C throughout.

## Feature E — document the authoring convention
Add a "Theory documents" section to `docs/CONTENT_AUTHORING.md` (and note the type in
`docs/TRACE_FORMAT.md` or a new `docs/THEORY_AUTHORING.md`): file location/naming, required
frontmatter fields, the recommended document structure + **depth expectation ("as detailed as
possible")**, the code-block + callout conventions, and the link-to-visualization pattern. This
seeds the later content pass.

## Validation
Add a test that every discovered theory doc has valid required frontmatter and that its
`course`/`topic` resolve against the catalog/`docs/CURRICULUM.md` (additive; don't disturb
`validateTrace`).

## Non-goals
- No broad theory authoring (only the 1–2 exemplars here — the rest is a later content pass).
- No trace-format reshape, no restyle, no change to the visualization rendering, no nav redesign
  beyond adding the Theory entries. Don't replace narration/coach (theory is the upfront reading;
  those stay in the visualization).

## Acceptance criteria
1. `typecheck`/`lint`/`test`/`build` pass; no unjustified `any`; all existing modules/traces and
   `validateTrace` unaffected.
2. Theory `.md` files (with frontmatter) are discovered and merged into the course→topic tree,
   **pinned first** in each topic; the module auto-discovery contract is unchanged.
3. The reading view renders markdown with the design tokens — headings, readable prose, lists,
   callouts, and **C code blocks (highlighted, ligatures off)** — in both themes, safely (no raw
   HTML), legible at presentation scale.
4. Theory entries appear distinctly in the sidebar at the top of each topic; selecting one opens the
   reading view; the "continue to the visualization" link jumps to the topic's first module; no
   navigation regressions.
5. 1–2 thorough exemplar theory docs exist and demonstrate the structure/depth; they pass the theory
   frontmatter/topic validation.
6. The theory authoring convention (location, frontmatter, structure, depth, code/callout rules,
   viz-link) is documented.
7. A test validates theory frontmatter + course/topic resolution.

## When done
Write `reports/phase-19-theory-reading-view.md` from the template. In §2/§3 document the theory file
convention (location, frontmatter, callout syntax) — the contract the content pass depends on — and
which concepts you wrote exemplars for. In §5 flag deviations. Do not start the content pass.
