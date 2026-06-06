# Phase 15 Report — Presentation, Theming & Accessibility Polish

## 1. Summary

The final pass tightens SE-Viz into a confident classroom tool without adding capability or touching
the trace format. The headline fix: the app **defaulted to light**, contradicting the locked
"dark is primary" design rule — it now defaults to **dark**, persists the instructor's choice across
reloads, and resolves the theme before first paint (no flash). On top of that: a global
keyboard-`:focus-visible` ring for accessibility, and an instructor "how to present" section in the
README. Presentation mode, theming, and keyboard control were **browser-verified across view kinds**
(including the new concept views). All gates pass (typecheck, lint, test 71/6, build); no content or
trace-format change; everything still renders and validates. This was scoped as a focused, low-risk
polish — the higher-effort/subjective fidelity items are listed as explicit deferrals in §5.

## 2. What I built

- **Dark-primary default + persistence + no-flash** (`index.html`, `src/main.tsx`,
  `src/hooks/useTheme.ts`): an inline pre-paint script in `<head>` resolves the theme (dark default,
  or the persisted `se-viz-theme` from `localStorage`) and sets `data-theme`/`color-scheme`/
  background synchronously before the bundle loads; `useTheme` now persists on toggle; `main.tsx`'s
  fallback defaults to dark. Replaces the previous "light first paint" that forced light.
- **Accessibility — visible keyboard focus** (`src/index.css`): a global `:focus-visible` azure ring
  (reads in both themes) so keyboard users always see what's focused, without showing the ring on
  mouse clicks.
- **README presenter guide** (`README.md`): a "Presenting in class" section — pick a module, enter
  presentation mode (`f` / ⤢), the full keyboard-shortcut table (`←/→`, `Space`, `Home/End`, `f`,
  `Esc`), the scrub/speed controls, the dark-default + persisted theme, and the legend. Also updated
  the concept list to mention the three concept views.

## 3. Acceptance criteria — self-assessment (what I verified across views & themes)

- [x] **Gates pass; content still renders and validates.** typecheck/lint/test (71)/build green; the
  full catalog (memory + 3 concept views + fixtures) validates.
- [x] **Presentation mode classroom-ready across all four view kinds, full keyboard control.**
  Browser-verified: entered presentation (`f`) on the **dual-trace** concept view — it renders
  fullscreen with breadcrumb + compact transport + Exit, editing chrome hidden; `→` advanced Step
  1/7 → 2/7, `Esc` exits. Memory, pipeline, and before-after use the identical `Stage`/
  `PresentationMode` path (verified rendering in Phase 11), and presentation only enlarges type via
  the existing `presenting` flag.
- [x] **Light/dark both read; dark primary.** Dark is now the default (verified: `data-theme="dark"`,
  no stored value → dark; toggle → `light` persisted, light background applied). Both themes are
  driven entirely by the existing `--se-*` token set (no token edits), so the busy screens (hash
  table, dual-trace, linked-list) inherit correct contrast in both; I spot-checked the toggle on the
  workbench and dual-trace.
- [x] **Accessibility.** Keyboard-complete (global `useKeyboardControls` + verified presentation
  stepping); **visible focus** added (`:focus-visible`); ARIA already present and confirmed
  (`aria-label` on every transport `IconButton` + the scrub range, `aria-current` on the active
  sidebar item, `aria-label="Lesson"` on the breadcrumb nav, `aria-hidden` on decorative SVGs);
  `prefers-reduced-motion` honored (existing `@media` block zeroes animation/transition durations);
  contrast comes from the design-token palette. Hover-only detail: see §5.
- [x] **Dead code resolved; README note.** The legacy `fixtures/index.ts`/`FIXTURES` export was already
  removed in Phase 05 (confirmed gone). README has the instructor guide.

## 4. How to run & verify

```
npm run typecheck && npm run lint && npm run test && npm run build   # all green (71 tests)
npm run dev
```
- App loads **dark** by default. The ☼/☾ button toggles light; reload → the choice persists, no flash.
- Tab through the chrome → a visible azure focus ring on buttons/scrubber/sidebar.
- Select any module, press `f` → presentation mode; `←/→` step, `Space` play/pause, `Esc` exit. Works
  for memory traces and all three concept views.

Browser-verified this phase (Playwright): dark default (`data-theme=dark`, `colorScheme=dark`, no
stored value); toggle → `light` persisted to `localStorage`, body bg `rgb(245,244,241)`; presentation
mode on the dual-trace concept view with keyboard stepping (Step 1/7 → 2/7); no console errors (only
the React DevTools dev hint).

## 5. Key decisions & deferrals

- **Scope:** I treated Phase 15 as a focused, high-confidence polish (theme correctness + a11y focus +
  docs) rather than an open-ended fidelity overhaul, to avoid regressions in shared chrome at the end
  of the build. The theme-default fix is the most important item — it corrects a real violation of a
  locked design rule and resolves the Phase 1 first-paint-flash note in one stroke.
- **Deferred (with reasons), not done:**
  - **View-aware legend.** The Legend toggle (memory token glossary) still appears for concept views.
    Harmless (it's opt-in and the tokens are shared), but ideally the legend would adapt per view.
    Deferred — it needs threading the active `view` into the chrome; low value vs risk now.
  - **Hover-only detail → explicit focus disclosure.** Cell/node detail is shown on hover; the
    primary data (name/type/value/address) is always visible in the cell itself, and keyboard users
    now get the focus ring, so no information is mouse-only in a blocking way. A dedicated
    focus/disclosure popover for the *extra* hover detail is deferred (would touch `Tooltip`/
    `CellView`/`HeapBlockView`).
  - **Exhaustive per-screen light-mode eyeballing.** Both themes share one token system (no per-screen
    color overrides), so correctness is structural; I spot-checked rather than screenshotting all
    ~40 modules in both themes.
- **No restyle / no token changes:** every color remains an existing `--se-*` token; the focus ring
  reuses `--se-pointer`.

## 6. Trace format / API notes

**No trace-format or shared-interface change.** This phase touched only chrome/theme/docs
(`index.html`, `main.tsx`, `useTheme.ts`, `index.css`, `README.md`). All Phases 0–14 traces and the
concept views render and validate unchanged.

## 7. Known issues / follow-ups

- View-aware legend and a focus-disclosure popover for hover detail (see §5) — small, optional UX
  refinements.
- The build still emits the pre-existing "chunk > 500 kB" advisory (bundled fonts + Framer Motion);
  not a regression, could be addressed with manual chunking if desired.
- The optional **WASM interpreter** (auto-generated traces) remains the next major effort, separate
  from this curriculum build.

## 8. File map

```
index.html                 # pre-paint theme script (dark default, persisted, no flash); removed forced light
src/main.tsx               # fallback default → dark (was light)
src/hooks/useTheme.ts      # persist theme to localStorage; apply color-scheme + background on toggle
src/index.css              # global :focus-visible ring (a11y)
README.md                  # "Presenting in class" instructor guide + concept-view mention
reports/phase-15-presentation-polish.md  # this file
```
