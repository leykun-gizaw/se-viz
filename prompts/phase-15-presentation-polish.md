# Phase 15 — Presentation, Theming & Accessibility Polish (SOLO, last)

## Why this phase exists
The engine and all content are done. This final pass makes SE-Viz a confident PowerPoint replacement
for live classes and a polished self-study tool. It touches shared chrome/theme, so run it **solo,
last**, after all content (Waves 1–2) is merged.

## Context to read
- `docs/design/` — the locked design (all 9 screens + legend); this phase tightens fidelity to it.
- `src/components/**` (chrome, `PresentationMode`, `Transport`, `TopBar`, `ContentSidebar`),
  `src/hooks/{useTheme,useKeyboardControls}.ts`, `src/index.css` (tokens).
- All reports `reports/phase-0*..1*` — pick up any "known issues / follow-ups" worth resolving.

## Hard constraints
- Frontend only, TS strict, no `any` without justification. `typecheck`/`lint`/`test`/`build` pass.
- **Do not change the trace format or break any content.** This is polish, not new capability. All
  existing traces/views must still render and validate.

## What to do
1. **Presentation mode for a classroom** — verify/raise fidelity: large legible type, generous
   spacing, the focal element obvious from the back of a room; clean enter/exit; `←/→` step, `Space`
   play/pause, `Esc` exit, `Home/End`; hide editing chrome. Confirm it works for **every** view kind
   (memory + pipeline + before-after + dual-trace).
2. **Theming** — confirm the light/dark toggle is correct and high-contrast across **all** screens
   (the busy ones: hash table, linked-list surgery, dual-trace). No token regressions; dark remains
   primary. Resolve the dev first-paint flash noted in the Phase 1 report if cheaply possible.
3. **Accessibility** — keyboard navigability end to end; visible focus states; ARIA roles/labels on
   transport, sidebar, tooltips, and the legend; respect `prefers-reduced-motion` (animations should
   degrade gracefully — instant state changes instead of springs); check color-contrast on text and
   on colored fills/badges; ensure hover-only detail also has a non-hover path (focus/disclosure) so
   it isn't mouse-only.
4. **Consistency sweep** — unify the cell/node hover treatment if still split (Phase 1 noted some
   native `title` tooltips vs styled popovers); tidy leftover dead code (e.g. the legacy
   `fixtures/index.ts` `FIXTURES` export if now unused); ensure the sidebar lists every catalog group
   cleanly and the breadcrumbs are correct everywhere.
5. **A short "how to present" note** in `README.md` (keyboard shortcuts, entering presentation mode,
   switching modules) so an instructor can drive it cold.

## Acceptance criteria
1. `typecheck`/`lint`/`test`/`build` pass; no `any` without justification; all existing content still
   renders and `validateTrace` passes.
2. Presentation mode is classroom-ready and works across all four view kinds with full keyboard
   control.
3. Light/dark both read correctly on every screen, including the busiest; dark remains primary.
4. Accessibility: keyboard-complete, visible focus, ARIA on interactive chrome, `prefers-reduced-
   motion` honored, adequate contrast, no mouse-only detail.
5. Dead code/inconsistencies from earlier phases' "known issues" are resolved or explicitly deferred
   with a reason; README has an instructor "how to present" note.

## When done
Write `reports/phase-15-presentation-polish.md`. In §3 note what you verified across view kinds and
themes; in §5 list anything intentionally deferred. This is the last planned phase before the
optional WASM-interpreter effort.
