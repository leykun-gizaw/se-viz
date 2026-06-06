# Content Authoring Conventions (read before any content phase)

Shared rules for every **content** phase (the ones that author curriculum traces, not engine
changes). Each content prompt references this file instead of repeating the boilerplate.

## What a content phase is
You author hand-written, **verifiably-correct** execution traces that play on the existing engine.
You do **not** change the trace format, the renderer, or the design system. If you think you need
to, stop — that belongs in an engine/foundation phase, not here.

## Hard rules
- Frontend only. Traces-first (no interpreter). React + TS (strict). No `any` without justification.
- `npm run typecheck`, `lint`, `test`, `build` must all pass when you finish.
- **Reuse** the trace format (`src/engine/trace/types.ts`), the renderer (`src/components/memory/*`,
  chrome), and the design tokens. No reshaping, no restyling, no new memory primitive.
- Metadata (`course`, `topic`, `file`, `covers`) comes from `docs/CURRICULUM.md`. **Never fabricate
  a course code.** Verify the course/week for your concept against CURRICULUM.md.
- Operators must read literally (ligatures are already off): write `->`, `!=`, `<=`, `*p`, `\0` as-is.

## Where files go (auto-discovery — no shared-file edits)
After the catalog refactor (`phase-05`), the catalog **auto-discovers** content modules by file
location. To add content you ONLY create new files under:

```
src/content/<course>/<topic>/<module>.ts      e.g. src/content/se201/linked-lists/traverse.ts
```

and export the module in the convention the refactor established (see `src/content/catalog.ts` and
`docs/TRACE_FORMAT.md`). **Do not edit `catalog.ts`, `types.ts`, `docs/TRACE_FORMAT.md`, or any
renderer file** — that is what keeps parallel phases conflict-free. If your module won't register
without editing a shared file, the refactor is incomplete — flag it in your report rather than
hand-editing the shared file.

## Authoring quality bar (match these exemplars)
- `src/content/se200/variables-control-flow/controlFlow.ts` — narration, step granularity, pulses.
- `src/content/se200/more-pointers-arrays-strings/swap.ts` — cross-frame pointers, frames.
- `src/content/fixtures/{linkedList,mallocFree,pointerArith}.ts` — heap, structs, arrays, arrows.

Per step: a precise one-line `narration`, correct `highlightedLines`, exactly one `activeId` focal
element, and `stdout`/`watch`/`condition` where they aid teaching. Keep step granularity fine
enough that each state change is visible (one statement per step in loops), but not padded.

## Correctness is the product
This is a teaching tool — a wrong value mis-teaches. Before finishing:
- Hand-trace every value, address, loop count, and console line.
- Cross-check determinate arithmetic/output with a **throwaway** calculation (a quick Node/Python
  snippet or a one-off `gcc` run on your machine is fine — **do not ship an interpreter**).
- `validateTrace` runs over the whole catalog in CI and will catch structural errors (bad line
  numbers, unresolved ids, dup ids). Make sure your modules pass it.
- Your report's §4 must explain how you verified correctness.

## Stay in your lane (parallel-safety)
Work only inside your assigned content folder. Don't touch other phases' folders, the engine, the
renderer, or shared docs. Run on your own git branch/worktree. This is what lets several content
phases run at once without colliding.

## Report
Write `reports/<your-phase>.md` from `reports/TEMPLATE.md`: §3 list each module + the CURRICULUM
row it covers; §4 show correctness checks; §5 flag deviations; §6 should say "no trace-format
change" (or, if truly unavoidable, stop and escalate). Do not start another phase.
