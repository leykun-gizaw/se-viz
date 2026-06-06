# Phase 08 — Stacks & Queues / LIFO & FIFO (SE 201) — CONTENT, Wave 1 (parallel)

Read `docs/CONTENT_AUTHORING.md` first (shared rules). This prompt states only what's unique. Run on
your own branch/worktree; touch only your content folder.

## Context
- `docs/design/SE-ViZ-visual-style-exploration.pdf` screen 06 — the target look (LIFO with a `top`
  cursor; FIFO with `front`/`rear`), already implemented by the engine.
- `src/content/fixtures/{pointerArith,linkedList}.ts` — array cells and list nodes both exist; you may
  back the ADTs with either.

## Curriculum rows (from `docs/CURRICULUM.md`, SE 201, weeks 5–6)
1. **Stacks, Queues, LIFO, FIFO Part 1 — `Stacks, Queues, LIFO, FIFO—Part 1`**
2. **Stacks, Queues, LIFO, FIFO Part 2 — `Stacks, Queues, LIFO, FIFO—Part 2`**

## Folder
`src/content/se201/linear-adts/` (course `SE 201`; topics per CURRICULUM.md — verify exact strings).

## What to author
- **Stack (LIFO)** — `push`/`pop` at one end with a highlighted **`top`** cursor; show LIFO order
  (last pushed is first popped). Show pushing several, then popping to confirm reverse order.
- **Queue (FIFO)** — `enqueue` at `rear`, `dequeue` at `front`, the **two cursors moving
  independently** (this is the crux vs a stack). Show FIFO order (first in, first out).
- Part 1 vs Part 2: use the split to go from the **array-backed** implementation (cursors are
  indices; mind wrap-around if you do a circular queue) to a **linked** implementation, or from
  basic ops to edge cases (empty/full, underflow/overflow) — your choice, but cover both ops sets and
  make the LIFO-vs-FIFO contrast explicit. Reuse `Step.condition` for empty/full tests.

## Teaching focus
One cursor (stack) vs two (queue), and the ordering discipline each enforces. Make `top` /
`front`/`rear` visibly move (use `activeId` + value pulses); narrate why pop returns what it does.
If array-backed, show indices and addresses; if list-backed, reuse nodes/arrows. No new primitive
needed.

## Acceptance (in addition to CONTENT_AUTHORING.md)
- Modules for both rows: a LIFO stack (push/pop, `top`) and a FIFO queue (enqueue/dequeue,
  `front`/`rear`), with the contrast clear and at least one empty/full edge case.
- Every cursor position, stored value, and pop/dequeue result verified correct (report §4);
  auto-discovered + passes `validateTrace`; no shared-file edits; no format/renderer/design change.

Report: `reports/phase-08-stacks-queues.md`.
