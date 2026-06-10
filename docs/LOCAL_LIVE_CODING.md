# Running the Live Coding loop locally (end to end)

This is how to test the whole pipeline — **editor → tracer API → renderer** — on one machine,
before anything is deployed. You need two checkouts: this repo (the frontend) and the
**se-viz-tracer** repo (the backend), plus Docker running.

## The topology (three pieces, who runs where)

- **Recorder** — the instrumented compile-and-run sandbox. It runs as **per-request Docker
  containers**, spawned by the tracer (it lives in the tracer repo; you only build its image).
- **Tracer API** — the HTTP service this app calls. It runs as a **host process, NOT a
  container**: it is the thing that spawns the recorder containers, and containerizing it would
  require handing it the Docker socket, which we deliberately avoid.
- **Frontend (this repo)** — the Vite dev server, pointed at the tracer with `VITE_TRACER_URL`.

## Steps

```sh
# 1) Tracer backend (in the se-viz-tracer repo)
npm run recorder:build          # build/tag the recorder Docker image (Docker must be running)
npm run serve                   # host API on http://localhost:8080

# 2) Frontend (in this repo)
echo 'VITE_TRACER_URL=/tracer-api' > .env.local
npm run dev                     # open the printed URL
```

Why `/tracer-api` and not `http://localhost:8080`? The backend doesn't send CORS headers yet
(that's its Phase 04), so the browser blocks a direct cross-origin call. The Vite dev server
proxies `/tracer-api/*` → `http://localhost:8080` (see `server.proxy` in `vite.config.ts`), which
makes the request same-origin. If your tracer runs elsewhere, set `TRACER_PROXY_TARGET=<url>`
in the shell when starting `npm run dev`. Once the backend ships CORS you can point
`VITE_TRACER_URL` at it directly.

Then open the app and click **Live coding** at the bottom of the left sidebar. (If you don't see
it, `VITE_TRACER_URL` isn't set — the entry is hidden on purpose when no tracer is configured.
Restart `npm run dev` after creating `.env.local`; Vite reads env files at startup.)

Quick backend sanity check, if you want one before touching the UI:
`curl http://localhost:8080/healthz` should return `{"status":"ok"}`.

## What to verify by hand

1. **A normal program animates.** The editor opens seeded with a small `factorial` program — just
   press **Run**. You should see the call stack grow and unwind in the memory view, the current
   line highlighted, and the transport (step/play/scrub, two-beat stepping) all working — the
   same player the curriculum modules use.
2. **A syntax error shows the gcc message.** Delete a semicolon and Run. You get a console-style
   "Compiler output" panel containing the actual gcc diagnostics — not a generic failure.
3. **An infinite loop comes back cleanly — the UI must not hang.** Change the program to
   `while (1) { }` in `main` and Run. Per the API contract you get the `timeout` error ("Your
   program ran too long (likely an infinite loop)."). *Observed with the current backend build:*
   it instead returns a short trace (it stops recording silently, with no `timeout` error and no
   `truncated` marker) — the UI plays it fine, but that's a backend deviation from its
   `docs/API.md` worth flagging on the tracer side.
4. **Stopping the tracer degrades gracefully.** Kill `npm run serve` and Run again: "The
   visualizer service is unavailable." No crash, no spinner forever.

## Notes

- **Docker must be running** before `npm run serve` handles its first request.
- On an **arm64 dev machine** (Apple Silicon) the recorder image runs under x86 emulation —
  noticeably slower, but fine for local testing.
- Truncated runs (very many steps or lots of output) play the partial trace with an amber
  "trace truncated" banner — that's expected behavior, not a bug.
- Live traces have **no coach notes and minimal narration** (the backend synthesizes plain
  text); the renderer handles their absence by design.
