# Phase 2 — C Fundamentals (the first real curriculum content)

## Your role and context
You are Claude Code, implementing **SE-Viz**. Phases 0 and 1 are complete and committed: the trace
format, the full memory renderer (stack frames, scalars, pointers/arrows, arrays, structs, heap +
allocation states), diff-driven animation (green value pulse, frame springs, arrow retarget),
the full transport (step/play/scrub/speed/keyboard), the locked design system, presentation mode,
the console panel, and four validation fixtures. Read before starting:
- `README.md`, `docs/CURRICULUM.md` (the authoritative concept list).
- `docs/TRACE_FORMAT.md` and `src/engine/trace/*` — the contract you author against.
- `reports/phase-00-scaffold.md` and `reports/phase-01-engine.md` — what exists and the conventions.
- `src/content/fixtures/*` — the Phase 1 fixtures; **match their authoring quality and style.**
- `docs/design/` — the locked visual design (already implemented; do not restyle it).

Phase 2 is **content, not engine.** You are authoring the first real curriculum modules — the
SE 200 C-fundamentals concepts — as hand-authored, verifiably-correct traces that play on the
existing engine. The engine should need little or no change; if a change is genuinely warranted it
must be **additive and documented** (see "Engine changes" below).

## Hard constraints (unchanged)
- Frontend only. Traces-first (no interpreter). React + TS (strict) + Tailwind + Framer Motion.
- No `any` without justification. `typecheck`, `lint`, `test`, `build` must all pass at the end.
- **Do not reshape the trace format or restyle the design system.** Reuse what Phases 0–1 built.

## Concepts to cover (from `docs/CURRICULUM.md`, all SE 200)
Author a polished content module for each. Metadata (`course`, `topic`, `file`, `covers`) must come
from `docs/CURRICULUM.md` — never fabricate course codes.

1. **Hello, World** *(gentle intro)* — a single `main` frame and the **console panel** showing
   `printf` output. Minimal, but proves the on-ramp. (SE 200, wk 1.)
2. **Variables, if / else, while** — the core control-flow module. One program that:
   declares and assigns scalars (value **pulses** on change), takes an **if / else branch**
   (clearly show which branch is taken and why), and runs a **while loop** that visibly **iterates**
   (the loop counter changes each pass; the condition is re-evaluated and shown true → … → false).
   (SE 200, wk 1.)
3. **Functions and nested loops** — `main` **calls a function** (frame push/return, argument copy,
   return value assigned back — reuse the Phase 1 stack rendering) **and** a **nested loop** with
   distinct **outer/inner counters**, producing console output (e.g. a small multiplication table
   or a printed pattern). (SE 200, wk 2.)
4. **More functions, more nested loops** — a slightly richer example: more than one function and/or
   deeper nesting (e.g. a helper called inside nested loops), still small and legible. (SE 200, wk 3.)

Quality over quantity: one clear, correct, well-narrated trace per concept is better than many
shallow ones. A concept may include 2–3 short traces if it genuinely aids teaching, but each must be
correct and pedagogically sharp. **No pointers, arrays, or heap content in this phase** — those are
Phase 3+.

## The teaching focus of this phase: making control flow legible
This is the new pedagogical element Phase 1's fixtures didn't exercise. Make loops and branches
unmistakable:
- **While loops:** step through each iteration. Each pass re-highlights the condition line, shows
  the condition result, runs the body (counter/accumulator scalars **pulse** as they change), and
  loops back — until the condition is false and control exits. The learner should *see* the loop go
  around, not just jump to the end.
- **if / else:** highlight the condition, show its boolean result, then highlight only the branch
  actually taken; narration says why.
- **Nested loops:** keep outer and inner counters visibly distinct and show the inner loop
  completing for each outer iteration.

Prefer the **existing mechanisms** (line highlighting, narration, scalar value pulses, `activeId`)
to express this. If — and only if — a small **additive** trace-format field materially improves
clarity (e.g. an optional per-step boolean/condition chip like `"i < 5 → true"`), you may add it,
but: keep it optional, keep Phase 0/1 traces valid, render it tastefully in the existing design
system, and document it in `docs/TRACE_FORMAT.md`. Do not over-build.

## Content organization (introduce a catalog)
Phase 1 used an ad-hoc fixture tab switcher. Phase 2 introduces real content, so give it structure:
- Organize modules under `src/content/` by course/topic (e.g. `src/content/se200/<topic>/…`).
- Add a single **content catalog** (e.g. `src/content/catalog.ts`) that registers every module
  grouped by course → topic, each entry carrying its `Trace` plus display metadata. This is the one
  source of truth a future navigation shell (a later phase) will consume.
- Update the workbench to list modules from the catalog (a clean grouped list/switcher is fine — a
  full course→week→project navigation shell is NOT this phase). Keep the Phase 1 fixtures available
  (you may fold them into the catalog under their topics, or keep a "fixtures" group).

## Build a trace-validation utility (correctness infrastructure — important)
Authoring errors are the biggest risk for a teaching tool. Add a reusable validator and run it over
the whole catalog in tests:
- `validateTrace(trace)` checking invariants: `steps[i].index === i`; every `highlightedLines` entry
  is within the source's line count; `activeId` (when present) resolves to an existing frame/cell/
  block id; every pointer `target` and every `annotation` `fromId`/`toId` resolves to an id present
  in that step; ids are unique within a step.
- A Vitest test that runs `validateTrace` over **every trace in the catalog**, so any future content
  error fails CI loudly. This utility outlives Phase 2 — every later content phase benefits.

## Non-goals for Phase 2 (do NOT build)
- No pointer/array/string/heap content (Phase 3+). No new memory primitives.
- No full curriculum navigation shell (course→week→project). No persistence/back end. No interpreter.
- No concept-views (build pipeline, preprocessor, dual-trace) — still a later phase.
- No restyling of the design system or reshaping of the trace format.

## Acceptance criteria (the reviewer will check these against the code)
1. `typecheck`, `lint`, `test`, `build` all pass; no `any` without justification.
2. A correct, well-narrated content module exists for each of the four concepts, with metadata
   sourced from `docs/CURRICULUM.md` (correct course codes).
3. **Control flow is legible:** a `while` loop visibly iterates step-by-step with its counter
   pulsing and the condition re-evaluated each pass; an `if/else` shows the branch taken; nested
   loops show distinct outer/inner counters. (Reviewer will step through in the browser.)
4. Functions show call/return frames with argument copy and return-value assignment (reusing the
   Phase 1 stack renderer); `printf` examples render in the console panel.
5. Content is organized under `src/content/` and registered in a single `catalog`; the workbench
   lists modules from it.
6. `validateTrace` exists and a test runs it over **every** catalog trace; all pass.
7. Any engine/trace-format change is additive, leaves Phase 0/1 traces valid, and is documented.
8. Every authored value, computed result, loop count, and console line is **verifiably correct** —
   the report's §4 must explain how you checked them (hand-trace or a tiny throwaway C run is fine;
   do not ship an interpreter).

## When done
Write your report to `reports/phase-02-c-fundamentals.md` using `reports/TEMPLATE.md`. In §3 list
each module and the concept it covers; in §4 explain how you verified correctness; in §5 flag any
deviations; in §6 document any additive trace-format change. Do not start a later phase.
