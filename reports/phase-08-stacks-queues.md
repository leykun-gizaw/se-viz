# Phase 08 Report — Stacks & Queues / LIFO & FIFO (SE 201)

## 1. Summary
This phase authored four hand-traced execution visualizations for SE 201 weeks 5–6 (Stacks,
Queues, LIFO, FIFO — Parts 1 & 2), all new files under `src/content/se201/linear-adts/`. Each
default-exports a `ContentModule` and is auto-discovered by the catalog with no shared-file edits.
The set makes the one-cursor-vs-two-cursor distinction (stack `top` vs queue `front`/`rear`) and the
LIFO-vs-FIFO ordering contrast explicit, in both array-backed (Part 1) and linked (Part 2) form, and
includes empty/underflow and full/overflow edge cases via `Step.condition` chips. All four gates
(typecheck, lint, test, build) pass green; `validateTrace` runs over the whole catalog in the test
suite and passes.

## 2. What I built
- `src/content/se201/linear-adts/arrayStack.ts` — array-backed stack (LIFO), `top` cursor.
- `src/content/se201/linear-adts/arrayQueue.ts` — array-backed **circular** queue (FIFO), `front`/`rear`.
- `src/content/se201/linear-adts/linkedStack.ts` — linked-list stack (LIFO), heap chain, `top`.
- `src/content/se201/linear-adts/linkedQueue.ts` — linked-list queue (FIFO), heap chain, `front`/`rear`.
- `reports/phase-08-stacks-queues.md` — this report.

All four modules reuse the existing trace format, renderer and design tokens. No new primitive,
no format change, no engine/renderer/catalog/doc/test/fixtures edits.

## 3. Modules and curriculum coverage
Topics and `covers` strings are verbatim from `docs/CURRICULUM.md` (SE 201 table).

| Module file | Concept | `topic` (Block) | `covers` (Project row) | `order` |
| --- | --- | --- | --- | --- |
| `arrayStack.ts` | Array stack, push/pop, `top`, underflow | `Stacks, Queues, LIFO, FIFO Part 1` | `SE201: Stacks, Queues, LIFO, FIFO—Part 1` | 50 |
| `arrayQueue.ts` | Circular queue, enqueue/dequeue, `front`/`rear`, wrap, overflow | `Stacks, Queues, LIFO, FIFO Part 1` | `SE201: Stacks, Queues, LIFO, FIFO—Part 1` | 51 |
| `linkedStack.ts` | Linked stack, push/pop at head, `top` | `Stacks, Queues, LIFO, FIFO Part 2` | `SE201: Stacks, Queues, LIFO, FIFO—Part 2` | 60 |
| `linkedQueue.ts` | Linked queue, enqueue at rear / dequeue at front | `Stacks, Queues, LIFO, FIFO Part 2` | `SE201: Stacks, Queues, LIFO, FIFO—Part 2` | 61 |

Both curriculum rows (week 5 Part 1, week 6 Part 2) are covered, each with a LIFO stack and a FIFO
queue, so the contrast lives within each topic. `order ≈ 10 × week` (week 5 → 50/51, week 6 → 60/61).
`course` = `SE 201` everywhere.

## 4. Correctness checks
Every cursor position, stored value, and pop/dequeue result was hand-traced statement by statement.
The determinate arithmetic is the modular index math of the circular queue and the LIFO/FIFO
ordering; both were checked by hand (no interpreter shipped).

**arrayStack** (`top` starts -1):
- push 10,20,30: `top` -1→0→1→2, `data` = [10,20,30,_,_].
- pop: reads `data[top]` then `top--` → returns 30 (top 2→1), 20 (1→0), 10 (0→-1).
  LIFO confirmed: pushed 10,20,30 → popped 30,20,10 (reverse). Slots stay stale after pop (pop only
  moves the cursor), shown honestly.
- 4th pop: `top == -1` true → underflow guard returns -1 (condition chip). Empty test also shown at init.

**arrayQueue** (CAP=4, circular; `front`/`rear`/`count`):
- enqueue 10,20,30: `q`=[10,20,30,_], `rear` 0→1→2→3, `front` stays 0, `count` 0→3.
- dequeue: reads `q[front]` then `front=(front+1)%4` → 10 (front 0→1), 20 (1→2); `rear` unmoved
  (two cursors independent). FIFO confirmed.
- enqueue 40: `q[3]=40`, `rear=(3+1)%4=0` (wrap verified by hand: (3+1)%4 = 0).
- enqueue 50 → `q[0]=50` (reuses vacated slot), `rear` 0→1, `count`=3.
- enqueue 60 → `q[1]=60`, `rear`=2, `count`=4 == CAP → full (`front==rear==2`, disambiguated by `count`).
- enqueue 70 → `count == CAP` true → overflow guard, no store, cursors unchanged (condition chip).
- dequeue → `q[2]=30`, `front`=3, `count`=3. Net dequeue order 10,20,30 == enqueue order (FIFO).

**linkedStack** (`top` head pointer, heap chain):
- push 10,20,30: malloc n0,n1,n2; each links `next` to old top; chain top→30→20→10→NULL.
- pop: returns `top->value` then `top=top->next`, free old → 30 (top→n1), 20 (top→n0).
  LIFO confirmed; remaining live nodes after each pop verified (no dangling pointer targets;
  `validateTrace` enforces every `next`/`top` target is present in the step).
- empty test `top == NULL` shown at init.

**linkedQueue** (`front`/`rear` pointers, heap chain):
- enqueue 10: `rear == NULL` true → empty branch, node is both `front` and `rear`.
- enqueue 20,30: else branch links `rear->next` then moves `rear`; `front` stays at the 10 node
  (cursors independent). Chain front→10→20→30←rear.
- dequeue: reads `front->value`, `front=front->next`, free head → 10 (front→n1), 20 (front→n2);
  `rear` unmoved. FIFO confirmed. After dequeuing 20, `front==rear==n2` (single element).
- enqueue 40: appends after rear, moves only `rear`. Dequeue order 10,20 == enqueue order.

LIFO-vs-FIFO contrast is explicit: with the same inputs the stacks pop 30,20,10 (reverse) while the
queues dequeue 10,20,30 (same order); narration in each module states this.

`validateTrace` (run over the whole catalog by the existing Vitest test) passed: 6 test files, 47
tests green — this checks `index` order, line-number bounds, id uniqueness, and that every
`activeId`, pointer `target`, and annotation reference resolves within its step.

## 5. Key decisions & deviations
- **Call frames for `push`/`pop`/`enqueue`/`dequeue` are not shown.** The globals (`data`/`top`,
  `q`/`front`/`rear`/`count`) and the linked cursors live in a single persistent `main` frame, and
  each operation is one step that highlights both the call site and the relevant function-body
  line(s). This keeps the array + cursor (or the heap chain + cursors) the visual focus — the
  teaching point — instead of flickering a one-parameter frame on every op. This follows the
  existing `pointerArith` fixture precedent (top-level declarations rendered in `main`) and the
  `linkedList` fixture (a single illustrative frame). It is a deliberate teaching simplification, not
  a format change.
- **Topics = the CURRICULUM Block strings** (`Stacks, Queues, LIFO, FIFO Part 1` / `Part 2`), giving
  two sidebar topics, each containing one stack and one queue. `covers` uses the Project-column
  strings with the em dash (`—Part 1` / `—Part 2`), matching CURRICULUM exactly.
- **Popped/dequeued array slots are left stale** (not zeroed) and freed linked nodes are removed from
  the heap, both matching real C semantics; narration calls out that pop/dequeue only moves the
  cursor.
- **Circular queue uses capacity 4** (small enough to show wrap-around and full within one trace).
- No shared-file edits were needed; the auto-discovery contract was sufficient.

## 6. Trace format / API notes
No trace-format change. All four modules use existing fields only (`ArrayCell`, `ScalarCell`,
`HeapBlock`, `PointerCell`, `Step.condition`, `activeId`). `docs/TRACE_FORMAT.md` and
`src/engine/trace/types.ts` are untouched.

## 7. Known issues / follow-ups
- The hidden call frames (see §5) are a teaching trade-off; a future "show call frames" variant could
  add per-call frames if an instructor wants to emphasize the function-call mechanics of an ADT.
- Linked modules remove freed nodes rather than briefly showing a `freed` state; a future variant
  could use the `freed` allocation state to teach `free()` explicitly.

## 8. File map
```
src/content/se201/linear-adts/
  arrayStack.ts     (new) — array stack (LIFO), top cursor, underflow guard
  arrayQueue.ts     (new) — circular array queue (FIFO), front/rear, wrap + overflow guard
  linkedStack.ts    (new) — linked stack (LIFO), heap chain, top
  linkedQueue.ts    (new) — linked queue (FIFO), heap chain, front/rear
reports/
  phase-08-stacks-queues.md  (new) — this report
```
No other files added or changed.
