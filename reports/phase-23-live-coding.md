# Phase 23 Report — Live Coding mode (editor → tracer API → render)

## 1. Summary

SE-Viz now has a **Live Coding** mode: a CodeMirror 6 editor seeded with a small factorial
program, a **Run** button (and ⌘/Ctrl+Enter), and an optional stdin field. Run POSTs the source to
the SE-Viz Tracer backend (`POST {VITE_TRACER_URL}/trace`), validates the returned canonical
`Trace` with the existing `validateTrace`, and plays it in the **existing player** — same
`useTrace`, `Transport`, `Stage`, memory canvas, inline values, two-beat stepping, keyboard
transport, and presentation mode as every curriculum module. Nothing was forked. Every API
outcome is handled: compile errors show the raw gcc messages in a console-style panel, timeouts
read as "ran too long", truncated runs play with an amber banner, and a missing/unreachable
backend degrades to one generic "service unavailable" state. The whole feature is **gated on
`VITE_TRACER_URL`**: production (no var) hides the entry entirely and the code is lazy-loaded, so
the production bundle doesn't even download CodeMirror. `docs/LOCAL_LIVE_CODING.md` gives the
exact one-machine end-to-end steps.

## 2. What I built

- **`src/live/config.ts`** — `tracerConfig()`: reads `VITE_TRACER_URL` / `VITE_TRACER_TOKEN`;
  `null` when the URL is unset (the gate). Also exports the `LIVE_CODING_ID` selection id.
- **`src/live/tracerClient.ts`** — `postTrace(source, { stdin?, config?, timeoutMs? })` → a
  discriminated union: `{ ok: true, trace, truncated? }` or `{ ok: false, error: { code, message,
  details? } }`. Typed handling of every contract shape (`compile_error`, `invalid_request`,
  `too_large`, `timeout`, `recorder_error`, truncated success), plus client-side classifications
  `unavailable` (network failure, abort-timeout, malformed JSON, untyped non-2xx) and
  `invalid_trace` (a 200 whose trace fails `validateTrace`). Sends `Authorization: Bearer <token>`
  only when `VITE_TRACER_TOKEN` is set. 30s client-side `AbortController` timeout.
- **`src/live/runState.ts`** — the mode's pure state machine (`idle → loading → success/error`,
  stale settles ignored, `seq` counter remounts the player per run) plus the learner-facing
  copy: `errorHeadline()` and `truncationBanner()`.
- **`src/live/defaultProgram.ts`** — the seeded factorial program (first Run works untouched).
- **`src/components/live/CodeEditor.tsx`** — CodeMirror 6 (modular packages, not the kitchen-sink
  meta package): C/C++ mode, line numbers, history, bracket matching, Mod-Enter run keybinding,
  and a theme built entirely from the existing `--se-*` design tokens (re-themes with the
  light/dark toggle; ligatures OFF per the locked spec).
- **`src/components/live/LiveCodingView.tsx`** — the mode: header with "Live coding" breadcrumb +
  theme toggle, editor card with stdin + Run (disabled while loading), the error/console panel
  (gcc details for compile errors), the truncation banner, and on success the existing player
  (`Transport` strip + `Stage`, keyboard transport, presentation mode via `f`).
- **Wiring** — `src/App.tsx` (gated entry, `React.lazy` so CodeMirror is a separate chunk
  production never loads), `src/components/ContentSidebar.tsx` (a pinned "Live coding" section
  **below** the curriculum tree, plus an icon on the collapsed rail).
- **Shared-code touches** — `src/components/TopBar.tsx`: extracted/exported `Mark` and
  `ThemeToggle` (no behavior change) so the live header reuses them;
  `src/hooks/useKeyboardControls.ts`: the global key handler now also ignores
  **contenteditable** targets (CodeMirror), so typing in the editor can't step the player;
  `src/vite-env.d.ts`: typed the two env vars.
- **Tests** — `src/live/tracerClient.test.ts` (16), `src/live/runState.test.ts` (8),
  `src/live/config.test.ts` (4) — all against mocked `fetch` / stubbed env; no backend.
- **Docs** — `.env.example` (both vars), `docs/LOCAL_LIVE_CODING.md` (the one-machine guide).

## 3. Acceptance criteria — self-assessment

- [x] **`typecheck`/`lint`/`test`/`build` pass; no unjustified `any`; existing content/tests
  unaffected** — all four green; 198 tests (167 pre-existing all passing + 31 new). No `any`
  anywhere new (`@typescript-eslint/no-explicit-any` is an error in this repo); JSON narrowing
  uses `unknown` + guards.
- [x] **A Live Coding mode (editor + Run + stdin + console panel) renders the returned `Trace` in
  the existing player — no renderer fork** — `LiveCodingView` mounts the unmodified `useTrace` +
  `Transport` + `Stage` (memory view, inline values, two-beat stepping, presentation mode).
  Verified in-browser against a local mock tracer (see §4).
- [x] **The API client posts to `VITE_TRACER_URL` (sends `VITE_TRACER_TOKEN` if set) and handles
  every response** — `tracerClient.test.ts` asserts the request shape (URL, method, JSON body
  with/without stdin, bearer header present/absent), both success shapes (plain + truncated), all
  five error codes (compile_error keeps the gcc `details`), unknown codes, network failure,
  non-JSON bodies, untyped non-2xx, and the abort timeout → all mapped to typed results.
- [x] **Gated on `VITE_TRACER_URL`; returned traces are `validateTrace`-checked** —
  `config.test.ts` (unset/blank → `null`); verified in-browser: no entry without the var, entry
  appears with it. `postTrace` runs `validateTrace` (plus a structural pre-check so junk can't
  crash the validator) and returns `invalid_trace` → generic unavailable UI, never the renderer.
- [x] **Tests (mocked fetch): the client's response/error mapping and the mode's
  loading/error/success states** — client mapping in `tracerClient.test.ts`; the mode's state
  machine is extracted pure (`runState.ts`) and `runState.test.ts` drives idle→loading→
  success/error (+ truncation carry-through, stale-settle guard, re-run seq). The view is a thin
  `useReducer` shell over it (the test config is `environment: 'node'` — no DOM — so state logic
  was deliberately made testable without rendering).
- [x] **`.env.example` documents the vars; `docs/LOCAL_LIVE_CODING.md` gives the exact local
  end-to-end steps and what to verify** — both written; the guide states the topology (recorder =
  per-request Docker containers; tracer = host process, not a container; frontend = Vite dev
  server), the exact commands, the four hand-checks, and the Docker/arm64 notes.

## 4. How to run & verify

```sh
npm install
npm run typecheck && npm run lint && npm test && npm run build   # all green

# Frontend-only (no backend): feature gating
npm run dev                      # → NO "Live coding" entry anywhere (production behavior)

# Full local loop (needs the se-viz-tracer repo + Docker) — docs/LOCAL_LIVE_CODING.md:
#   tracer repo: npm run recorder:build && npm run serve        (http://localhost:8080)
#   this repo:   echo 'VITE_TRACER_URL=http://localhost:8080' > .env.local && npm run dev
# → "Live coding" appears at the bottom of the sidebar; Run plays the trace in the player.
```

**How I tested the client/state mapping (mocked):** unit tests stub `fetch`
(`vi.stubGlobal`) and the env (`vi.stubEnv`) — every contract shape above; no backend in CI.
**End-to-end wiring check:** I additionally ran the dev server against a small local mock of the
tracer API (a throwaway node script implementing `POST /trace` per the contract) and verified in
the browser: no env → no entry; env set → entry appears; Run on the seeded program → the player
animates (transport, two-beat, memory canvas, narration); a `compile_error` response → gcc text
in the "Compiler output" panel (via ⌘Enter from inside the editor); a truncated success → amber
banner + partial trace; a `timeout` → the "ran too long" line; mock killed → "The visualizer
service is unavailable."; theme toggle re-themes the editor (CSS-var theme). The real-backend
walk-through remains the §"What to verify" list in `docs/LOCAL_LIVE_CODING.md`.

## 5. Key decisions & deviations

- **Editor: CodeMirror 6**, as the prompt recommends — six modular packages
  (`@codemirror/state|view|commands|language|lang-cpp`, `@lezer/highlight`), not the `codemirror`
  meta package, to keep the dependency lean. Themed from the existing tokens; no new colors.
- **Lazy-loaded route** (small addition beyond the prompt): `LiveCodingView` is a `React.lazy`
  chunk, so CodeMirror (~427 kB pre-gzip) is never downloaded in production where the mode is
  hidden. Main bundle stayed at its pre-phase size (the >500 kB chunk warning predates this phase).
- **Gate style: hidden, not disabled-with-note** — the prompt allowed either; an entry production
  users can see but never use is noise, and the local guide covers discoverability for devs.
- **Sidebar placement** — a pinned section at the bottom of the sidebar (plus a collapsed-rail
  icon), visually distinct (azure + terminal glyph), deliberately outside the curriculum tree.
- **Client-side timeout maps to `unavailable`, not `timeout`** — the backend enforces the
  program-run limit itself (408). If *our* 30s abort fires, the service didn't answer at all, so
  "service unavailable" is the honest message; "your program ran too long" is reserved for the
  backend's verdict.
- **Two tiny shared-code edits** (called out since the prompt said don't touch the renderer —
  these are chrome, not renderer): exported `Mark`/`ThemeToggle` from `TopBar.tsx` (pure
  extraction), and `useKeyboardControls` now ignores contenteditable targets — without this,
  typing/space/arrows in CodeMirror would drive the player. Both are behavior-preserving for all
  existing screens.
- **`stdin` is omitted from the request body when empty** rather than sent as `""`.

## 6. Trace format / API notes

The trace format is **unchanged**. New shared surface (frontend-internal):
- `postTrace(source, opts) → { ok: true, trace, truncated? } | { ok: false, error: { code,
  message, details? } }` with codes `invalid_request | too_large | compile_error | timeout |
  recorder_error | unavailable | invalid_trace` (last two are client-side classifications).
- Env contract: `VITE_TRACER_URL` (gate + base URL), `VITE_TRACER_TOKEN` (optional bearer,
  forward-compat for the tracer's auth phase). Documented in `.env.example`.
- The tracer API contract consumed here is the tracer repo's `docs/API.md` (`POST /trace`,
  `GET /healthz`), as quoted in the phase prompt.

## 7. Known issues / follow-ups

- The collapsed sidebar rail shows the Live Coding icon but (as with modules) the full entry
  needs the expanded rail; acceptable, matches existing behavior.
- The editor document doesn't persist across leaving/re-entering the mode (the view unmounts).
  Persisting to `localStorage` à la `usePersistentState` would be a small follow-up if instructors
  want it.
- `VITE_TRACER_TOKEN` is wired but untestable against the real backend until its auth phase lands.
- When CORS arrives backend-side (its Phase 04), no frontend change should be needed (plain
  `fetch` + JSON header), but the local guide should be re-verified then.

## 8. File map

```
.env.example                                 new — documents VITE_TRACER_URL / VITE_TRACER_TOKEN
docs/LOCAL_LIVE_CODING.md                    new — one-machine end-to-end guide
src/live/config.ts                           new — env gate (tracerConfig), LIVE_CODING_ID
src/live/config.test.ts                      new — gating tests (4)
src/live/tracerClient.ts                     new — postTrace + typed response mapping
src/live/tracerClient.test.ts                new — mocked-fetch contract tests (16)
src/live/runState.ts                         new — pure run state machine + learner copy
src/live/runState.test.ts                    new — state mapping tests (8)
src/live/defaultProgram.ts                   new — seeded factorial program
src/components/live/CodeEditor.tsx           new — CodeMirror 6 wrapper, token-based theme
src/components/live/LiveCodingView.tsx       new — the mode (editor/run/errors/player)
src/App.tsx                                  edit — gated entry, lazy LiveCodingView
src/components/ContentSidebar.tsx            edit — pinned Live coding section + rail icon
src/components/TopBar.tsx                    edit — export Mark, extract+export ThemeToggle
src/hooks/useKeyboardControls.ts             edit — ignore contenteditable targets
src/vite-env.d.ts                            edit — typed env vars
package.json / package-lock.json             edit — @codemirror/* + @lezer/highlight
```
