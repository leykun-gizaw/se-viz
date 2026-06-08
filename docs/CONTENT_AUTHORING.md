# Content Authoring Conventions (read before any content phase)

Shared rules for every **content** phase (the ones that author curriculum traces, not engine
changes). Each content prompt references this file instead of repeating the boilerplate.

## What a content phase is

You author hand-written, **verifiably-correct** execution traces that play on the existing engine.
You do **not** change the trace format, the renderer, or the design system. If you think you need
to, stop — that belongs in an engine/foundation phase, not here.

> **Theory documents** (the read-first prose for a topic) are a **separate content type** — not a
> trace. They are authored as Markdown (`src/content/<course>/<topic>/theory.md`) and rendered as a
> **slide deck** (the theory reading surface). See [`docs/THEORY_AUTHORING.md`](./THEORY_AUTHORING.md)
> for that contract (location, frontmatter, slide separator + per-slide budget, deck arc, code +
> callout conventions, viz link).

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

**The one rule:** each module file `export default`s a `ContentModule` (from
`src/content/module.ts`). That is the entire registration contract — no shared-file edit:

```ts
import type { Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

export const traverseTrace: Trace = {
  id: 'se201-traverse',
  title: 'Traverse a linked list',
  course: 'SE 201', // grouping comes from these — set them from docs/CURRICULUM.md
  topic: 'Linked lists',
  file: 'traverse.c',
  language: 'c',
  source: SOURCE,
  steps,
};

const contentModule: ContentModule = {
  trace: traverseTrace,
  summary: 'One line on what this module teaches.', // required (sidebar tooltip)
  label: 'Traverse', // optional; defaults to trace.title
  order: 10, // optional; ≈ 10 × curriculum week
};
export default contentModule;
```

The catalog auto-discovers this by file location and groups it by the trace's `course`/`topic`.
**Do not edit `catalog.ts`, `module.ts`, `types.ts`, `docs/TRACE_FORMAT.md`, or any renderer file**
— that is what keeps parallel phases conflict-free. Every `*.ts` you add under a topic folder must
default-export a `ContentModule` (helpers go elsewhere) or the catalog throws at load. If your
module won't register without editing a shared file, the refactor is incomplete — flag it in your
report rather than hand-editing the shared file. See `docs/TRACE_FORMAT.md § Content catalog` for
the full contract.

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

## Concept-view content (Phases 12–14)

Three concepts are **not** live-memory and use a concept **view** instead of the memory canvas:
the static-library build pipeline (`view: 'pipeline'`), the preprocessor before→after
(`view: 'before-after'`), and debugging (`view: 'dual-trace'`). Phase 11 built the renderers; you
author **data only** — no engine/renderer edits. Set `Trace.view` and give each step the matching
payload (`pipeline` / `beforeAfter` / `dualTrace`), then `export default` a `ContentModule` exactly
as for memory modules (auto-discovered by folder). The shared chrome — breadcrumb, transport,
keyboard, presentation, narration — works unchanged. The exact payload shapes and the copy-from
fixtures (`src/content/fixtures/{buildPipeline,preprocessor,dualTrace}.ts`) are in
`docs/TRACE_FORMAT.md § Phase 11 additions — concept views`. Memory concepts are unaffected: omit
`view` and author as before.

## Coach notes (Phase 17+)

Coach notes are the **occasional teaching layer** — a coach that steps in at the moments that
matter, points at the relevant thing, and says one sharp thing. They are NOT a replacement for the
one-line narration (the running subtitle stays on every step). Add `coach?: CoachNote` to a step
(see `docs/TRACE_FORMAT.md § Phase 17 additions`). Conventions:

- **Selective.** Only annotate steps that add real insight — a key idea, a classic pitfall, a "what
  happens next?" beat, or a section recap. Most steps get **no** coach note. Aim for a handful per
  module, not one per step.
- **Short — one idea.** 1–3 sentences, plain spoken language, like a coach talking. If you need more,
  it belongs in the narration across several steps, not one bubble.
- **Pick the right variant:**
  - `idea` — a key concept ("every recursion needs a base case").
  - `watch-out` — a common bug or misconception ("rewire in the wrong order and you lose the list").
  - `predict` — prompt the learner before a reveal ("what happens to p after free?"). Put it on the
    step _before_ the change (or, with two-beat stepping, set `beat: 'arrive'`).
  - `recap` — a short section summary ("on the way back up, each frame multiplies its n").
- **Anchor to what it's about.** Set `anchorId` to the frame/cell/heap-block (or pipeline node) the
  note discusses, or `anchorLine` to a source line. Leave both unset for a general note (it falls
  back to a corner). `validateTrace` checks the anchor resolves.
- **Predict on arrive, explain on apply.** When two-beat (execute-to-reveal) stepping is active, a
  `predict` note reads best on `arrive` (before the change) and explanations on `apply` (the
  reveal). Set `beat` accordingly; it's ignored when two-beat stepping isn't present.
