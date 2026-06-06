# SE-Viz — Interactive Memory & Algorithm Visualizer

A frontend-only teaching tool that **replaces PowerPoint** for SE 200 (C Programming I) and
SE 201 (Data Structures & Algorithms I) live sessions. Instead of static slides, instructors
run code *visually* — stepping through execution while the call stack, heap, pointers, and
data structures animate in real time.

## What it does

For any supported concept, SE-Viz shows three synchronized panels:

1. **Code** — the C source, with the currently executing line highlighted.
2. **Memory** — an animated canvas of the stack region (frames), heap region (allocated
   blocks), value cells, addresses, and pointer arrows.
3. **Narration** — a plain-language description of what the current step is doing.

Instructors drive it with step controls (play / pause / step forward / step back / scrub /
speed). Learners explore with hover (hover a stack frame to see its locals; hover a node to
see its address and value).

Target concepts include: stack frames, recursion (stack growth/unwind), pointers and pointer
arithmetic, arrays and strings, `malloc`/`free` and the heap, singly & doubly linked lists
and their while-loop traversal patterns, stacks & queues (LIFO/FIFO), and hash tables. See
[`docs/CURRICULUM.md`](docs/CURRICULUM.md) for the authoritative concept list.

## Architecture (traces-first)

The core idea: **one generic engine, every concept is just data.**

- **Trace format** — each example is a sequence of *steps*. Every step holds the full memory
  state at that moment (frames, heap blocks, variables, pointers), the highlighted source
  line, and narration text. Traces are hand-authored and known-correct.
- **Engine + memory renderer** — a generic player that consumes any trace and animates the
  transitions between adjacent steps (frame push/pop, pointer reassignment, value change),
  with hover detail and presentation-mode navigation.
- **Content modules** — one per concept/project: the source code + its trace(s) + lesson
  metadata, plugged into the engine.

Because the engine is generic, a future **interpreter** (compile & run C via WASM, auto-emit
traces) becomes a drop-in *trace source* — no engine rewrite. That is an explicit later phase;
**Phase 1 is traces-first only.**

## Tech stack

React + TypeScript + Tailwind CSS + Framer Motion, built with Vite. Frontend-only, no backend.

## How we work — the prompt/report loop

This repo is built phase by phase by Claude Code, supervised by a reviewer (Claude in Cowork).

- `prompts/phase-NN-<name>.md` — the spec the reviewer writes for each phase.
- `reports/phase-NN-<name>.md` — the writeup Claude Code produces after implementing a phase,
  following [`reports/TEMPLATE.md`](reports/TEMPLATE.md).

Loop: reviewer writes a prompt → Claude Code implements it and writes a report → reviewer
checks the report **against the prompt** and spot-checks the actual code → only then does the
next phase begin. **Do not start a phase before its prompt exists in `prompts/`.**

## Roadmap

| Phase | Focus |
|-------|-------|
| 0 | Repo scaffold, tooling, trace-format spec, one end-to-end vertical slice |
| 1 | Full engine: player controls, code-sync, memory renderer (stack/heap/pointers), hover, animation |
| 2 | C fundamentals: variables, if/else/while, functions, nested loops |
| 3 | Pointers, arrays, strings, pointer arithmetic |
| 4 | Recursion (call-stack growth/unwind) |
| 5 | Catalog refactor — filesystem auto-discovery of content (unblocks parallel waves) |
| 6–10 | **Wave 1 (content, parallel):** `malloc`/`free` heap · linked lists · stacks & queues · hash tables · argc/argv |
| 11 | Concept-view model + view renderers (non-memory screens) |
| 12–14 | **Wave 2 (concept-view content, parallel):** static libraries · preprocessor · debugging dual-trace |
| 15 | Presentation-mode polish, theming, accessibility |
| Later | WASM interpreter (auto-generated traces) |

See `docs/PARALLELIZATION.md` for the wave/dependency plan and `docs/CONTENT_AUTHORING.md` for the
auto-discovery contract every content phase follows.

Trees / tree traversals are intentionally out of scope — they are not in the SE 200/SE 201
curriculum. The engine remains capable of representing them if a future course needs it.
