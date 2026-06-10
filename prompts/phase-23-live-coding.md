# Phase 23 — Live Coding mode (editor → tracer API → render) + local end-to-end guide

## Your role and context
You are Claude Code, implementing **SE-Viz** (the frontend, this repo). A separate backend —
**SE-Viz Tracer** — now exists: it takes a C program over HTTP and returns a SE-Viz `Trace` (the same
JSON this app already renders), by compiling and running the program under instrumentation in a
hardened sandbox. This phase adds the **missing link**: a **Live Coding** mode where a user types
their own C, hits **Run**, and the app calls the tracer and **plays the returned trace in the existing
renderer**. It also delivers a **local end-to-end run guide** so the whole loop can be tested on one
machine before any deployment.

Read first: `README.md`, `docs/TRACE_FORMAT.md`, `src/App.tsx`, the existing player/renderer
(`src/components/Stage.tsx`, `src/components/memory/*`, `Transport`, the debugger-stepping work), and
`src/engine/trace/{types,validate}.ts`. The returned trace conforms to the **canonical `Trace`**, so
the existing memory view, transport, inline values, and two-beat stepping should all just work.

## The tracer API contract (canonical: the tracer repo's `docs/API.md`)
- `POST {TRACER_URL}/trace` with JSON `{ source: string, stdin?: string }`.
- Success: `200 { trace }` or `200 { trace, truncated: { reasons: ('step_limit'|'output_limit')[], originalSteps } }`.
- Errors: `{ error: { code, message, details? } }` with codes: `invalid_request` (400), `too_large`
  (413), `compile_error` (400; `details` = the gcc messages), `timeout` (408), `recorder_error` (502).
- `GET {TRACER_URL}/healthz` → `200 { status: 'ok' }`.

## Hard constraints
- Frontend only, React + TS strict, no `any` without justification. `typecheck`/`lint`/`test`/`build`
  pass. Reuse the design tokens and the existing player — **do not fork the renderer** or change the
  trace format.
- **Do not ship a broken/dead feature to production.** The live site (se-viz.vercel.app) has **no
  tracer yet**, so this feature must **degrade gracefully**: gate it on a configured tracer URL (see
  below) and handle an unreachable backend cleanly.

## What to build

### A. Config
- Read the tracer base URL from a Vite env var **`VITE_TRACER_URL`** (e.g. `http://localhost:8080`
  for local dev). Optionally read **`VITE_TRACER_TOKEN`** and send it as a bearer/header **if set**
  (the backend has no auth yet — Phase 04 adds it — so this is forward-compat; it works without one
  locally). Document both in `.env.example`.
- **Gate the Live Coding entry on `VITE_TRACER_URL` being set.** Unset (e.g. production today) →
  the feature is hidden (or shown disabled with a clear "not available" note). Set → it appears.

### B. The API client (small, tested)
- A module `postTrace(source, stdin?) → { trace, truncated? } | { error }` that POSTs to the tracer,
  with a sensible client-side timeout and **typed** handling of every response shape above.
- Map outcomes to UI states: `loading`, `success` (trace, maybe truncated), and each error:
  - `compile_error` → show the **gcc `details`** in a console-style panel (students must see *why* it
    didn't compile — this is the teaching value).
  - `timeout` → "Your program ran too long (likely an infinite loop)."
  - `too_large` → "Program is too large."
  - `recorder_error` / network failure / non-2xx → "The visualizer service is unavailable."
  - truncated success → render the partial trace **plus a banner** ("trace truncated — too many
    steps/too much output to show all of it").
- Validate the returned trace with the ported/`src` `validateTrace` before playing it; on invalid,
  show the generic unavailable state (don't crash the renderer).

### C. The Live Coding UI
- A distinct **Live Coding** entry (top bar or a clearly-separate sidebar section — not mixed into
  the curriculum tree), opening a view with: a **code editor**, a **Run** button (disabled while
  loading), an optional small **stdin** field, the **error/console panel**, and — on success — the
  **existing player/Stage** rendering the returned trace. Breadcrumb shows "Live coding".
- **Editor:** use **CodeMirror 6** (lightweight, modular) with a C/clike mode, line numbers, and
  ligatures-off monospace to match the app. (A syntax-highlighted textarea reusing `highlightC` is an
  acceptable lighter fallback, but CodeMirror is the better editing experience and the right tool
  here — this is a legitimate dependency, unlike a heavy diagram lib.) Seed it with a small default
  program so Run works on first load.
- Live traces have **no coach notes and minimal narration** (the backend synthesizes plain narration)
  — that's expected; the renderer already handles their absence.

### D. Local end-to-end run guide (`docs/LOCAL_LIVE_CODING.md`)
Write a short, plain-English guide to run the **whole loop on one machine** (this is the test the
user asked for). The real topology — state it clearly:
- The **recorder** runs as per-request **Docker containers** (in the tracer repo).
- The **tracer API** runs as a **host process** (NOT a container — it spawns the recorder containers;
  containerizing it would need the Docker socket, which we deliberately avoid).
- This **frontend** runs via the **Vite dev server**, pointed at the tracer.

Exact steps (adjust paths to the user's checkout):
```
# 1) Tracer backend (in the se-viz-tracer repo)
npm run recorder:build          # build/tag the recorder image
npm run serve                   # host API on http://localhost:8080

# 2) Frontend (in this repo)
echo 'VITE_TRACER_URL=http://localhost:8080' > .env.local
npm run dev                     # open the printed URL → "Live Coding"
```
What to verify by hand: a normal program (e.g. `factorial`) **animates**; a **syntax error** shows the
**gcc message**; an **infinite loop** comes back as a clean **timeout** (not a hang). Note Docker must
be running, and on an arm64 dev machine the recorder runs under emulation (fine for local testing).

## Out of scope
No backend changes, no deployment, no CORS/auth/rate-limit (the backend's Phase 04). No trace-format
change, no renderer fork, no restyle. Don't try to run the tracer here in CI — the frontend's tests
**mock** the API.

## Acceptance criteria
1. `typecheck`/`lint`/`test`/`build` pass; no unjustified `any`; existing content/tests unaffected.
2. A **Live Coding** mode (editor + Run + stdin + console panel) renders the returned `Trace` in the
   **existing player** (memory view, transport, inline values, two-beat) — no renderer fork.
3. The API client posts to `VITE_TRACER_URL` (sends `VITE_TRACER_TOKEN` if set) and handles **every**
   response: success, `truncated` (+ banner), and each error code (`compile_error` shows the gcc
   message), plus an unreachable backend → clean "unavailable".
4. The feature is **gated on `VITE_TRACER_URL`** so production (no var) doesn't show a dead feature;
   returned traces are `validateTrace`-checked before rendering.
5. Tests (mocked fetch): the client's response/error mapping and the mode's loading/error/success
   states. No real backend needed for tests.
6. `.env.example` documents the vars; **`docs/LOCAL_LIVE_CODING.md`** gives the exact local
   end-to-end steps and what to verify.

## When done
Write `reports/phase-23-live-coding.md` from `reports/TEMPLATE.md`. In §4 note how you tested the
client/state mapping (mocked) and confirm the env-gating + graceful-unavailable behavior. In §5 flag
any deviations (e.g. editor choice). Do not start another phase.
