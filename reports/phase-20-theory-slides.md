# Phase 20 Report — Theory as a Slide Deck

## 1. Summary

Theory is now a **PowerPoint-style slide deck** instead of a scrolling article. A theory doc is split
into slides on top-level `---` breaks and shown on a **fixed 16:9 canvas (1280×720) scaled to fit** the
viewport (centered, letterboxed) so every slide looks identical when screen-shared, at large slide-
scale type, one slide per screen. The deck reuses the transport chrome (`Slide k / N`, prev/next,
progress dots, `←/→`/Home/End keys) and adds a **fullscreen presentation surface** (`f` / `Esc`) — the
primary screen-share view — plus a persistent **"Continue to the visualization →"** bridge and the
course · topic · Theory breadcrumb. The Markdown engine gained **nested lists** and deck-level slide
splitting (`splitSlides`). The old book-style `ReadingView` is **removed**. The two exemplar docs are
rewritten as well-paced decks. Theory remains a separate content type (one `theory.md` per topic,
discovered as before); no trace-format change, `validateTrace` untouched. `typecheck`/`lint`/`test`
(124)/`build` all pass; no `any`; Markdown still rendered safely (React, no raw HTML).

Branch: `phase-20-theory-slides`, cut from `main` after Phase 19 was merged.

## 2. What I built

- **Slide splitting** — `src/engine/markdown.ts` `splitSlides(src)`: splits the body on a **top-level
  `---`** (ignoring `---` inside fenced code), trims, drops empty/trailing slides → ≥1 slide. The
  `---` is a deck separator, never an inline rule.
- **Nested lists** — `markdown.ts` `parseListAt`: indentation-based recursive list parsing. The list
  AST is now `{ ordered, items: ListItem[] }` where `ListItem = { content, children }` (children hold
  sub-lists). (+ updated `markdown.test.ts`: nested-list + `splitSlides` cases — 13 tests.)
- **Two type scales in the renderer** — `src/components/Markdown.tsx`: a `scale` prop
  (`'reading' | 'slide'`) provided via context picks compact vs large type maps; nested lists render
  recursively. C code blocks (`highlightC`, ligatures off), coach-token callouts, tables, bold/inline
  code all scale up for slides.
- **The slide-deck renderer** — `src/components/TheoryDeck.tsx` (replaces `ReadingView`): a
  self-measuring **16:9 canvas scaled with a CSS transform** (`useFitScale`), an **auto title slide**
  (frontmatter `title` + `course · topic`) followed by the authored `---` segments, the transport
  (Slide k/N, prev/next, dots), `←/→`/Home/End/`f`/`Esc` keys, a **fullscreen presentation** overlay,
  the breadcrumb, and the persistent continue bridge. Over-long slides scroll internally (last resort).
- **App wiring** — `src/App.tsx`: Theory selection now renders `<TheoryDeck>`; `ReadingView.tsx`
  deleted.
- **Migrated decks** — `se200/pointers-arrays-strings/theory.md` (15 slides) and
  `se200/recursion/theory.md` (11 slides): title (auto) → why → mental model → syntax/rules →
  patterns → pitfalls (callouts) → worked example → recap → "see it run". Light, large-text slides.
- **Docs** — `docs/THEORY_AUTHORING.md` rewritten for the slide format (separator, per-slide budget,
  deck arc, large-text guidance, nested lists, code/callout rules, viz bridge); `CONTENT_AUTHORING.md`
  pointer updated.

## 3. Acceptance criteria — self-assessment

- [x] **1. gates pass; no unjustified `any`; modules/traces & `validateTrace` unaffected; Markdown
  safe (no raw HTML).** typecheck/lint/test (124)/build green. No `any`. Theory is still additive (one
  `theory.md` per topic); no trace/`validateTrace` change. The renderer never uses
  `dangerouslySetInnerHTML` (the `<script>` test still asserts literal text).
- [x] **2. Theory renders as a fixed 16:9 deck scaled to fit, large type, one slide per screen; split
  on top-level `---`; legible screen-shared in both themes.** `TheoryDeck` + `useFitScale`
  (1280×720 × CSS scale, letterboxed). Verified the Recursion deck (11 slides) and Pointers deck in
  **dark and light**.
- [x] **3. Navigation: `Slide k / N`, prev/next, `←/→`, fullscreen presentation; reduced-motion
  honored; keyboard-accessible.** All present; `f` toggles a fullscreen overlay, `Esc` exits (verified
  in-browser). No slide-transition animation, so reduced-motion is honored trivially; buttons + dots
  are real `<button>`s with labels.
- [x] **4. Engine supports nested lists (and `---` is deck-level); `markdown.test` green; C code
  highlighted ligatures off; callouts via coach tokens.** `parseListAt` (nested) + `splitSlides`
  (deck-level, fence-aware); 13 engine tests pass. Verified the nested `factorial(4→1)` list slide,
  the table slide, and the amber `watch-out` callout.
- [x] **5. Two exemplar docs migrated to well-paced decks, still pass theory validation; continue
  bridge works; no nav regressions.** Both rewritten with `---` breaks; `theory.test.ts` still green
  (frontmatter/topic resolution). The continue button (verified from fullscreen) opened
  **factorial(n)**. Sidebar dropdown/collapsibles unaffected.
- [x] **6. Old book-style reading view is gone.** `src/components/ReadingView.tsx` deleted; App renders
  the deck.
- [x] **7. `docs/THEORY_AUTHORING.md` documents the slide convention.** Separator, per-slide budget,
  deck arc, large-text-first, nested lists, code/callout rules, viz bridge.

### The slide convention + deck renderer (contract for the content pass)

- **Separator:** a **top-level `---`** (own line, blank lines around) splits slides; not a rendered
  rule; `---` inside a code fence is ignored.
- **Title slide:** **auto-generated** from frontmatter (`title` + `course · topic`) as slide 1 —
  authors do **not** write one; they start with the first concept slide.
- **Per-slide budget:** one idea = a `##` title + one of {3–6 bullets (nesting allowed) / one short
  code block / one callout / a ≤6-row table / 2–3 sentences}. Author to fit 16:9 at large type.
- **Deck arc:** title → why → mental model → syntax/rules → patterns → pitfalls → worked example →
  recap → "see it run / continue".
- **Renderer:** fixed **1280×720** canvas, `scale = min(w/1280, h/720) × 0.96`, centered + letterboxed
  (`bg-bg`); slide is `bg-surface`. Nav: Slide k/N, prev/next, dots, `←/→`/Home/End, `f` fullscreen,
  `Esc` exit. **Overflow:** an over-tall slide scrolls internally (authoring keeps slides light).

## 4. How to run & verify

```bash
npm install
npm run typecheck && npm run lint && npm run test && npm run build   # all pass
npm run dev
```

- Sidebar (SE 200) → expand **Recursion** (or **Pointers, Arrays and Strings**) → click the azure
  **Theory** entry. The deck opens on the title slide (16:9, letterboxed).
- `→`/`←` (or the footer buttons / dots) move between slides; the readout shows `Slide k / N`. Check
  the nested-list slide ("a stack of frames"), the table slide ("Recursion vs. iteration"), and a
  `watch-out` callout slide.
- Press **`f`** for fullscreen presentation; **`Esc`** exits. Toggle the theme (top-right) — legible
  in both. **Continue to the visualization →** jumps to the topic's first module.

## 5. Key decisions & deviations

- **Auto title slide from frontmatter** (rather than "content before the first `---`"). It guarantees
  a consistent title slide for every deck and frees authors from re-typing the title; the authored
  body is purely concept slides. Documented.
- **Hand-rolled, dependency-free engine kept.** Nested lists + slide splitting were added to the
  Phase 19 engine rather than adopting a Markdown/MDX/Marp library — preserves the "safe by
  construction / no `any` / zero-dep" posture. Scope stays a documented subset.
- **Slide scaling via CSS `transform: scale` on a fixed 1280×720 box**, not `vw`/`vh` font units —
  gives a true "every slide identical" PowerPoint feel and exact letterboxing for screen-share.
- **No slide-transition animation.** Keeps it crisp for screen-share and makes reduced-motion a
  non-issue. (If desired later, gate a fade on `useReducedMotion`.)
- **Fullscreen is an in-app overlay** (`fixed inset-0 z-50`), consistent with the existing
  `PresentationMode`, not the browser Fullscreen API — predictable and exitable with `Esc`.
- **Two type scales on `Markdown`** via context: I kept the `reading` scale even though the only
  current consumer is the deck (`slide`), so the renderer stays reusable; it adds no `any` and no
  runtime cost.

## 6. Trace format / API notes

**No trace-format change.** Engine/shared surface (all additive to Phase 19):

- `splitSlides(src): string[]` and nested-list parsing (`parseListAt`) in `src/engine/markdown.ts`.
- The list AST changed shape: `Block` list is now `{ ordered, items: ListItem[] }` with
  `ListItem = { content: InlineNode[]; children: Block[] }` (was `InlineNode[][]`). Internal to the
  Markdown engine + renderer; nothing outside theory consumes it.
- `Markdown` gained a `scale?: 'reading' | 'slide'` prop (default `reading`).
- New component `TheoryDeck` replaces `ReadingView` (same props: `doc`, `firstModule`, `theme`,
  `onToggleTheme`, `onSelect`).
- Theory discovery (`theory.ts`), the `theory:` selection-id scheme, and the catalog merge are
  unchanged from Phase 19.

## 7. Known issues / follow-ups

- **Broad theory authoring is the next content pass** — only the two exemplars are decks now.
- **Overflow is graceful, not automatic-fit.** A too-tall slide scrolls internally; the renderer does
  not auto-shrink text to guarantee fit. The authoring budget keeps slides light; an auto-fit pass
  could be added later.
- **Markdown subset is still intentionally small** (no images/footnotes/multi-paragraph list items;
  the C tokenizer is line-based). Extend the engine + `markdown.test.ts` if a future deck needs more.
- Slide count is unbounded for the progress dots; very long decks (≫20 slides) would crowd the dots —
  fine for the per-topic budget, revisit if needed.

## 8. File map

```
src/engine/
  markdown.ts            # + splitSlides (deck-level ---) + nested lists (parseListAt); ListItem AST
  markdown.test.ts       # + nested-list + splitSlides tests (13)
src/components/
  TheoryDeck.tsx         # NEW — 16:9 scaled slide deck (title slide, nav, dots, fullscreen, bridge)
  Markdown.tsx           # + reading/slide type scales (context) + nested-list rendering
  ReadingView.tsx        # DELETED (replaced by TheoryDeck)
  ../App.tsx             # Theory selection → TheoryDeck
src/content/se200/
  pointers-arrays-strings/theory.md   # migrated to a slide deck
  recursion/theory.md                 # migrated to a slide deck
docs/
  THEORY_AUTHORING.md    # rewritten for the slide format (separator, budget, deck arc, nested lists)
  CONTENT_AUTHORING.md   # pointer updated (slide deck)
reports/phase-20-theory-slides.md     # this file
```
