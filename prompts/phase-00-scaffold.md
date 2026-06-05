# Phase 0 — Scaffold, Trace Format, and One Vertical Slice

## Your role and context
You are Claude Code, the implementer for **SE-Viz**, a frontend-only teaching tool that
replaces PowerPoint for SE 200 (C Programming I) and SE 201 (DSA I) live sessions. Read
`README.md` and `docs/CURRICULUM.md` before starting — they define the product, the
traces-first architecture, and the concept coverage you are ultimately building toward.

This is **Phase 0**. Do not build content modules for the curriculum yet. Your job is to lay
a foundation the rest of the project plugs into, and to prove that foundation works with one
small end-to-end example.

## Hard constraints (do not violate)
- **Frontend only.** No backend, no server, no database, no network calls at runtime.
- **Traces-first.** Do NOT build, embed, or call any C interpreter/compiler. Execution is
  represented by hand-authored trace data only. (An interpreter is an explicit later phase.)
- **Stack:** React + TypeScript (strict) + Tailwind CSS + Framer Motion, built with Vite.
- **No `any`** in committed code except where unavoidable and commented with justification.
- Keep everything in a single repo at the root (where this `prompts/` folder lives). Do not
  create a nested project subfolder — `package.json` belongs at the repo root.

## Mission for Phase 0
Deliver four things:

### A. Project tooling
- Initialize a Vite + React + TypeScript app at the repo root (keep the existing
  `prompts/`, `reports/`, `docs/`, `README.md`, `.gitignore`).
- Add and configure Tailwind CSS and Framer Motion.
- TypeScript in **strict** mode. Set up ESLint + Prettier.
- Scripts in `package.json`: `dev`, `build`, `preview`, `lint`, `typecheck`, and `test`.
- Add a test runner (Vitest) with at least one passing test (see item D).

### B. The trace format (the most important deliverable)
Design and document a typed trace format in `src/engine/trace/types.ts`. It must be generic
enough to express everything on the roadmap (stack frames, heap blocks, pointers, arrays,
strings, linked-list nodes, hash buckets), even though Phase 0 only exercises a slice of it.
Requirements:

- A trace is metadata + an **ordered array of steps**.
- **Each step carries the FULL memory state at that moment** (not a delta). The engine derives
  animations by diffing adjacent steps. This keeps authoring deterministic and verifiable.
- A step includes at minimum:
  - `id` / index, and a short `narration` string.
  - `highlightedLines`: which source line(s) are executing.
  - `stack`: an ordered array of **frames** (top of stack = most recent call). Each frame has a
    function `name`, a call id, and an ordered list of **variables**.
  - `heap`: an array of allocated **blocks** (empty in Phase 0, but the type must exist).
  - A **variable** / memory **cell** model that can represent: a scalar value, an address, an
    array of cells, and a **pointer** (a reference to another cell/block by stable id). Cells
    carry a stable `id`, a `name`, a `type` label (e.g. `int`, `int *`, `char[]`), and an
    optional displayed `address`.
- Pointers must reference targets by **stable id** so the renderer can draw an arrow from a
  pointer cell to its target across steps. Design ids to be stable across steps for the same
  logical entity (so diffing/animation works).
- Document the format with TSDoc comments and a short `docs/TRACE_FORMAT.md` that explains the
  shape and shows the Phase 0 example trace as a worked example.

> Treat this as a public API. Later phases and the reviewer will depend on it. If you must
> change it later, that is fine — but get it as right as you can now and document it clearly.

### C. Minimal engine scaffolding
You do NOT need the full player UI yet (that's Phase 1). Build only what the vertical slice
needs:
- A `TracePlayer` state hook/store (e.g. `useTrace`) holding the current step index with
  `next()`, `prev()`, `goTo(i)`, `reset()`, and `canNext`/`canPrev`.
- A diffing helper that, given step `n-1` and `n`, reports what changed (frames pushed/popped,
  cells added/removed, values changed, pointers retargeted) — enough for the renderer to
  animate. Keep it small but real; later phases extend it.

### D. One vertical slice (proof the architecture works)
Author ONE trace by hand for this exact program and render it end to end:

```c
int add(int a, int b)
{
    int sum = a + b;
    return sum;
}

int main(void)
{
    int x = 3;
    int y = 4;
    int z = add(x, y);
    return 0;
}
```

The trace must walk through, at minimum: `main` frame created → `x = 3` → `y = 4` → call
`add` (push `add` frame with `a = 3`, `b = 4`) → `sum = 7` → return 7 → pop `add` frame →
`z = 7` → return. Render three synchronized panels:
- **Code panel** showing the source with the current line(s) highlighted per step.
- **Memory panel** drawing the stack frames as boxes containing their variable cells, with a
  visible push animation when `add` is called and a pop animation when it returns (use Framer
  Motion). Show each variable's name, type, value, and address.
- **Narration** line for the current step.

Plus minimal controls: **Step back**, **Step forward**, **Reset**, and a step counter
(`Step k / N`). Hover on a frame should reveal a tooltip listing its variables (proves the
hover-detail pattern that later phases expand).

Tests (Vitest): at least one test that loads the Phase 0 trace and asserts the diff between two
specific adjacent steps is correct (e.g. calling `add` pushes a frame named `add` with cells
`a` and `b`). This locks the trace/diff contract.

## Non-goals for Phase 0 (do NOT do these yet)
- No curriculum content modules (recursion, linked lists, etc.).
- No play/pause autoplay, scrub bar, speed control, or presentation mode (Phase 1).
- No heap/pointer-arithmetic visuals beyond having the types exist.
- No routing/navigation shell across courses.
- No interpreter.

## Project structure (suggested)
```
src/
  engine/
    trace/        # types.ts, diff.ts, and the player store/hook
  components/     # CodePanel, MemoryCanvas, StackFrame, Cell, Controls, Tooltip
  content/
    phase0/       # the hand-authored add/main trace + its source string
  App.tsx
  main.tsx
docs/
  TRACE_FORMAT.md
```

## Acceptance criteria (the reviewer will check these)
1. `npm install` then `npm run dev` serves the app; the Phase 0 slice is visible on load.
2. `npm run build`, `npm run typecheck`, `npm run lint`, and `npm run test` all pass cleanly.
3. Stepping forward/back through the slice updates code highlight, memory, and narration in
   sync; the `add` frame visibly animates in on call and out on return.
4. Hovering a stack frame shows a tooltip with its variables.
5. `src/engine/trace/types.ts` is strict-typed, TSDoc-commented, and expressive enough (per
   section B) to represent heap blocks, arrays, and pointers even though the slice doesn't use
   them. `docs/TRACE_FORMAT.md` explains it.
6. At least one Vitest test asserts a correct diff between two adjacent steps of the slice.
7. No backend, no interpreter, no `any` without justification.

## When done
Write your report to `reports/phase-00-scaffold.md` using `reports/TEMPLATE.md`. Be explicit
about the final trace-format shape (section 6 of the template) and any deviations from this
prompt. Do not start any later phase.
