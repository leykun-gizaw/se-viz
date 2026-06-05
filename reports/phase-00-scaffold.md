# Phase 0 Report — Scaffold, Trace Format, and One Vertical Slice

## 1. Summary

Phase 0 lays the foundation the rest of SE-Viz plugs into and proves it with one end-to-end
example. The repo is now a Vite + React + TypeScript (strict) app at the root, with Tailwind CSS
v4, Framer Motion, ESLint, Prettier, and Vitest wired up. The centerpiece is the typed,
TSDoc-documented **trace format** in `src/engine/trace/types.ts` — generic enough for the whole
roadmap (stack frames, heap blocks, pointers, arrays, strings, structs/linked-list nodes, hash
buckets) — plus a pure-function step **differ** and a minimal **player** hook. A single
hand-authored trace for the `add(x, y)` program renders across three synchronized panels (code /
memory / narration) with step controls; the `add` frame visibly animates in on call and out on
return, and hovering a frame shows its variables. `npm run dev`, `build`, `typecheck`, `lint`, and
`test` all pass cleanly. No backend, no interpreter, no unjustified `any`.

## 2. What I built

**Tooling / config**

- `package.json` — scripts `dev`, `build`, `preview`, `lint`, `typecheck`, `test`.
- `tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json` — strict mode (+ `noUnusedLocals`,
  `noUnusedParameters`, `exactOptionalPropertyTypes`, `noImplicitReturns`, etc.).
- `vite.config.ts` — React + Tailwind v4 plugins; Vitest `test` block (node environment).
- `eslint.config.js` — flat config: `@eslint/js` + `typescript-eslint` recommended, react-hooks,
  react-refresh, `eslint-config-prettier`, and `@typescript-eslint/no-explicit-any: error`.
- `.prettierrc.json`, `index.html`, `src/index.css` (Tailwind v4 `@import`), `src/vite-env.d.ts`.

**The trace format (most important deliverable)**

- `src/engine/trace/types.ts` — `Trace`, `Step`, `StackFrame`, `HeapBlock`, and the recursive
  `Cell` union (`ScalarCell | PointerCell | ArrayCell | StructCell`), all fully TSDoc-commented.

**Engine scaffolding**

- `src/engine/trace/diff.ts` — `diffSteps(prev, next)` returning frames pushed/popped, cells
  added/removed, scalar value changes, and pointer retargets.
- `src/engine/trace/useTrace.ts` — `useTrace(trace)` player: `index`, `total`, `step`, `prevStep`,
  `canNext`/`canPrev`, `next()`, `prev()`, `goTo(i)`, `reset()`.

**Vertical slice content**

- `src/content/phase0/source.ts` — the exact `add`/`main` C source.
- `src/content/phase0/addTrace.ts` — the hand-authored 8-step trace.

**Components + app**

- `src/components/CodePanel.tsx`, `MemoryCanvas.tsx`, `StackFrame.tsx` (with hover tooltip),
  `Cell.tsx`, `Controls.tsx`; `src/App.tsx`, `src/main.tsx`.

**Tests + docs**

- `src/engine/trace/diff.test.ts` — two Vitest cases locking the trace/diff contract.
- `docs/TRACE_FORMAT.md` — prose spec + the Phase 0 worked example.

## 3. Acceptance criteria — self-assessment

- [x] **`npm install` then `npm run dev` serves the app; the Phase 0 slice is visible on load.** —
  Verified: dev server boots on `http://localhost:5173`, serves the page (title + `main.tsx` HTTP
  200). `App.tsx` renders the slice immediately at step 1/8.
- [x] **`npm run build`, `npm run typecheck`, `npm run lint`, and `npm run test` all pass cleanly.**
  — All four run green (build emits `dist/`; test = 2 passing). Also `prettier --check` passes.
- [x] **Stepping forward/back updates code highlight, memory, and narration in sync; the `add`
  frame visibly animates in on call and out on return.** — Single `useTrace` index drives all three
  panels. `MemoryCanvas` uses `AnimatePresence` (`mode="popLayout"`) so the `add` frame springs in
  at step 4 (`add-call`) and out at step 7 (`add-pop-assign-z`).
- [x] **Hovering a stack frame shows a tooltip with its variables.** — `StackFrame.tsx` tracks hover
  and renders a `role="tooltip"` panel listing each variable (`type name = value`).
- [x] **`types.ts` is strict-typed, TSDoc-commented, and expressive enough to represent heap blocks,
  arrays, and pointers even though the slice doesn't use them. `TRACE_FORMAT.md` explains it.** —
  `Cell` union includes `PointerCell` (id-referenced `target`), `ArrayCell`, `StructCell`;
  `HeapBlock` exists. Doc written.
- [x] **At least one Vitest test asserts a correct diff between two adjacent steps of the slice.** —
  `diff.test.ts` test 1 asserts `decl-y → add-call` pushes frame `add` with cells `a`, `b`; test 2
  asserts `add-return → add-pop-assign-z` pops `add` and changes `z` from `null` to `7`.
- [x] **No backend, no interpreter, no `any` without justification.** — Frontend-only; no
  compiler/interpreter; zero `any` in committed code (`no-explicit-any` is an ESLint error and lint
  passes).

## 4. How to run & verify

```bash
npm install
npm run dev        # open the printed URL (default http://localhost:5173)
```

The Phase 0 slice is the whole page. Use **Step forward → / ← Step back / Reset**; watch the step
counter (`Step k / 8`). Stepping to the `add(x, y)` call pushes the `add` frame (spring-in
animation) and computes `sum = 7`; stepping past the return pops `add` and assigns `z = 7`. Hover
either frame box to see its variables in a tooltip.

Checks:

```bash
npm run typecheck   # tsc -b --noEmit
npm run lint        # eslint .
npm run test        # vitest run  → 2 passed
npm run build       # tsc -b && vite build → dist/
```

## 5. Key decisions & deviations

- **No deviations from the prompt's required behavior or hard constraints.** All Phase 0 mission
  items (A–D) and non-goals were respected; no curriculum content, autoplay, scrub, heap visuals,
  routing, or interpreter were built.
- **Stack ordering convention:** `Step.stack` is **bottom-first** (`stack[0]` = `main`, last =
  top). The prompt said "top of stack = most recent call"; I kept the most-recent call as the last
  array element and document the convention in both the TSDoc and `TRACE_FORMAT.md`. The renderer
  reverses for display so the newest frame appears on top visually. This is a representational
  choice, not a behavioral deviation.
- **Tailwind v4** (current major) via the `@tailwindcss/vite` plugin and a CSS-first
  `@import "tailwindcss"` — no `tailwind.config.js`/PostCSS file needed.
- **Framer Motion** imported from the `framer-motion` package (v12), as the prompt names it.
- **Vitest runs in the `node` environment.** The required diff test is pure logic and needs no DOM,
  which keeps the test deps minimal. Component/DOM tests in later phases can switch to `jsdom`.
- **`z` appears (uninitialized) at the call step.** When `add(x, y)` is called, `int z` is shown in
  `main` with `value: null` (renders as `?`), then becomes `7` after the return. This makes the
  "assign the return value" moment a visible value change rather than a sudden cell appearance.
- **Repo observation (not changed):** the pre-existing `.gitignore` ignores `prompts/` and
  `reports/`, so this report and the phase prompt are untracked by git. The prompt told me to keep
  the existing `.gitignore`, so I left it as-is and am flagging it here for the reviewer to decide.

## 6. Trace format / API notes

Authoritative types: `src/engine/trace/types.ts`. Full prose + worked example:
`docs/TRACE_FORMAT.md`. Current shape:

- **`Trace`** = `{ id, title, language: 'c', source, steps, covers? }`. `source` is one string,
  `\n`-separated; line numbers are **1-based**. Invariant: `steps[i].index === i`.
- **`Step`** = `{ id, index, narration, highlightedLines: number[], stack: StackFrame[], heap:
  HeapBlock[] }`. **Each step is a FULL memory snapshot**, not a delta. `stack` is bottom-first.
- **`StackFrame`** = `{ id, name, callId, variables: Cell[] }`. `id` is stable per activation;
  recursion uses distinct ids/`callId`s so simultaneous frames are distinguishable.
- **`Cell`** is a discriminated union on `kind`, sharing `{ id, name, type, address? }`:
  - `scalar` → `value: string | number | boolean | null` (`null` = uninitialized).
  - `pointer` → `target: CellId | BlockId | null` (drives the drawn arrow) + optional `display`.
  - `array` → `elements: Cell[]` (arrays and C strings).
  - `struct` → `fields: Cell[]` (linked-list nodes, hash entries).
- **`HeapBlock`** = `{ id, label?, type?, address?, size?, cells: Cell[] }` (exists; empty in
  Phase 0).
- **Stability rule:** ids are stable across steps for the same logical entity. Pointers reference
  targets **by id**, never by object reference — this is what makes diffing and arrow animation work.
- **`diffSteps(prev: Step | null, next: Step): StepDiff`** where `StepDiff = { framesPushed,
  framesPopped, cellsAdded, cellsRemoved, valuesChanged: {id,from,to}[], pointersRetargeted:
  {id,from,to}[] }`. Pure function; recurses into array/struct cells when flattening.
- **`useTrace(trace): TracePlayer`** exposes `{ trace, index, total, step, prevStep, canNext,
  canPrev, next, prev, goTo, reset }`.

These are intended as a stable public API; later phases should extend (not reshape) them where
possible.

## 7. Known issues / follow-ups

- **Pointer/heap rendering is type-only.** The model supports pointers, arrays, structs, and heap
  blocks, but `MemoryCanvas` only draws stack frames + an empty heap placeholder, and no pointer
  arrows are drawn yet (no slice needs them). Phase 1 builds the full memory renderer.
- **No autoplay/scrub/speed/keyboard nav** — deliberately deferred to Phase 1.
- **Diff is computed but not yet consumed by the renderer.** Animations currently come from Framer
  Motion's layout/presence diffing on stable `key`s; `diffSteps` is tested and ready for Phase 1 to
  drive richer, diff-aware transitions (e.g. value pulses, arrow retargets).
- **`.gitignore` ignores `prompts/` and `reports/`** (see §5) — left untouched per the prompt; the
  reviewer may want to track these going forward.
- **Bundle size** (~326 kB JS, ~104 kB gzip) is dominated by React + Framer Motion; fine for a
  teaching tool, not optimized.

## 8. File map

Added this phase:

```
package.json, package-lock.json
index.html
vite.config.ts
tsconfig.json, tsconfig.app.json, tsconfig.node.json
eslint.config.js, .prettierrc.json
src/
  main.tsx
  App.tsx
  index.css
  vite-env.d.ts
  engine/trace/
    types.ts        # the trace format (public contract)
    diff.ts         # diffSteps(prev, next)
    diff.test.ts    # Vitest: locks the trace/diff contract (2 tests)
    useTrace.ts     # player hook
  content/phase0/
    source.ts       # the add/main C source string
    addTrace.ts     # the hand-authored 8-step trace
  components/
    CodePanel.tsx
    MemoryCanvas.tsx
    StackFrame.tsx  # + hover tooltip
    Cell.tsx
    Controls.tsx
docs/
  TRACE_FORMAT.md   # prose spec + worked example
reports/
  phase-00-scaffold.md   # this file
```

Pre-existing, unchanged: `README.md`, `docs/CURRICULUM.md`, `prompts/phase-00-scaffold.md`,
`reports/TEMPLATE.md`, `.gitignore`.
