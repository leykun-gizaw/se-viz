# Phase 20 — Theory as a Slide Deck (presentation format) — SOLO engine

## Why this phase exists
Phase 19 added theory, but as a narrow, book-style scrolling article. For live teaching and
screen-sharing that's wrong: instructors need **PowerPoint-style slides** — large type, one concept
broken into slides, one slide per screen, navigable and fullscreen-able so remote students can read
it on their own screens. This phase **replaces the reading view with a slide-deck renderer** and
extends the Markdown engine so authors aren't constrained. A later content pass then writes a theory
deck for **every** topic in both curriculums.

This is a **solo** phase (it changes the theory renderer + the Markdown engine + the authoring
convention). It depends on **Phase 19 being merged first** (build on `main` after that).

## Decisions already made (build to these)
- **Slide-deck presentation style**, not a reading article. **Fixed 16:9 slide canvas scaled to fit**
  the viewport (real PowerPoint feel; consistent sizing for screen-share). Large, legible type.
- **Author as Markdown with slide breaks** (Marp/reveal-style): a top-level `---` separates slides.
- **Format first** (this phase) + migrate the 2 existing theory docs; full content pass is later.

## Context to read
- `reports/phase-19-theory-reading-view.md` — what exists (theory discovery, `markdown.ts`,
  `Markdown.tsx`, `ReadingView.tsx`, `theory.ts`, catalog merge, `docs/THEORY_AUTHORING.md`).
- `src/engine/markdown.ts` (+ test), `src/components/{Markdown,ReadingView,CoachBubble}.tsx`,
  `src/content/{theory.ts,catalog.ts}`, `src/App.tsx`, `src/components/PresentationMode.tsx`,
  `src/components/Transport.tsx`, `src/engine/highlightC.ts`, `src/index.css` (tokens).
- `src/content/se200/{pointers-arrays-strings,recursion}/theory.md` — the two docs to migrate.
- `docs/THEORY_AUTHORING.md`, `docs/CURRICULUM.md`, `docs/design/`.

## Hard constraints
- Frontend only, TS strict, no `any` without justification. `typecheck`/`lint`/`test`/`build` pass.
- **Additive to the content model:** theory is still one `theory.md` per topic, discovered as today;
  no trace-format change; all existing modules/traces and `validateTrace` untouched.
- Reuse the design tokens (no restyle of the system — this is a new layout built from them). Keep
  Markdown rendering **safe** (render to React, no raw HTML / `dangerouslySetInnerHTML`).

## Feature A — slide parsing
- Split a theory doc's Markdown into an ordered list of **slides** on a top-level `---` thematic
  break. (Decide and document how the title slide is formed — e.g. an implicit first slide from the
  frontmatter `title` + topic, or the content before the first `---`.)
- The `---` is a **slide separator**, not a rendered horizontal rule inside a slide.
- A deck has ≥1 slide; empty trailing slides are ignored.

## Feature B — the slide-deck renderer (replaces `ReadingView`)
- A **fixed 16:9 slide canvas** (e.g. 1280×720 logical px) **scaled to fit** the available area
  (CSS transform/`scale`, centered, letterboxed) so every slide looks identical regardless of window
  size — ideal for screen-sharing.
- **Large, slide-scale typography**: headings and body sized relative to the canvas so they stay big
  and readable when shared. One slide fills the screen at a time.
- Render each slide's Markdown with the existing renderer: headings, **nested** lists (see Feature
  C), short prose, **C-highlighted code blocks (ligatures off)**, callouts (coach-variant tokens),
  tables, bold/inline code. Keep it safe (React, no raw HTML).
- **Navigation:** reuse the transport chrome — `Slide k / N`, prev/next buttons, `←/→` keyboard,
  progress dots — and the **fullscreen presentation mode** (`f`), which is the primary screen-share
  surface. Dark (primary) + light; `prefers-reduced-motion` honored; keyboard-accessible.
- **Overflow:** slides are authored to fit the 16:9 frame at large type (content budget — see Feature
  E). The renderer should degrade gracefully if a slide is slightly tall (scale text down a touch or
  allow internal scroll as a last resort), but the authoring convention keeps slides light.
- Keep a **"Continue to the visualization →"** affordance (e.g. a final "next steps" slide or a
  persistent button) that jumps to the topic's first module. Keep the breadcrumb (course · topic ·
  Theory) in the chrome.
- Selecting a topic's **Theory** entry opens this deck; remove/repurpose the old book-style
  `ReadingView` so there's no leftover reading layout.

## Feature C — extend the Markdown engine
Extend `markdown.ts` for what slides need — at minimum **nested lists** (the gap noted in Phase 19),
and verify the `---` slide separator is handled at the deck level (not as an inline rule). Keep the
engine typed and dependency-free; extend `markdown.test.ts` accordingly.

## Feature D — migrate the two exemplar decks
Rewrite `se200/pointers-arrays-strings/theory.md` and `se200/recursion/theory.md` as **well-paced
slide decks** (with `---` breaks): a title slide, then concise concept slides, a pitfalls/callout
slide or two, a worked-example slide, a summary, and a "continue to the visualization" close. Each
slide light and large-text-friendly. These set the standard for the content pass.

## Feature E — update the authoring convention
Rewrite the relevant part of `docs/THEORY_AUTHORING.md` for the slide format: the `---` separator,
the **per-slide content budget** (a title + a few bullets / one short code block / one callout — keep
it light so it fits 16:9 at large type), large-text-first guidance, the recommended **deck arc**
(title → why it matters → mental model → syntax/rules → patterns → pitfalls → worked example →
summary → continue), nested lists now allowed, and the code/callout conventions. This is the contract
the content pass depends on.

## Non-goals
- No broad theory authoring (only migrate the existing two — the full pass is the next phase).
- No trace-format change, no restyle of the design system, no change to the visualization rendering,
  no nav redesign beyond the deck. Don't touch coach/narration.

## Acceptance criteria
1. `typecheck`/`lint`/`test`/`build` pass; no unjustified `any`; existing modules/traces and
   `validateTrace` unaffected; Markdown still rendered safely (no raw HTML).
2. Theory renders as a **fixed 16:9 slide deck scaled to fit**, large type, one slide per screen;
   slides split on top-level `---`; legible when screen-shared in both themes.
3. Navigation works: `Slide k / N`, prev/next, `←/→`, and **fullscreen presentation mode**;
   reduced-motion honored; keyboard-accessible.
4. Markdown engine supports **nested lists** (and the `---` separator is deck-level); `markdown.test`
   updated and green; C code blocks highlighted with ligatures off; callouts styled via coach tokens.
5. The two exemplar theory docs are migrated to well-paced decks and still pass theory validation;
   the "Continue to the visualization →" bridge still works; no nav regressions.
6. The old book-style reading view is gone (replaced by the deck).
7. `docs/THEORY_AUTHORING.md` documents the slide convention (separator, per-slide budget, deck arc,
   large-text, nested lists, code/callouts) — ready for the content pass.

## When done
Write `reports/phase-20-theory-slides.md` from the template. In §2/§3 document the slide convention
and the deck renderer (canvas size/scaling, navigation, overflow handling) — the contract the content
pass depends on. In §5 flag deviations. Do not start the content pass.
