# Phase 07 Report — Linked Lists (SE 201)

## 1. Summary
This phase adds hand-authored, verifiably-correct execution traces for SE 201 linked lists, covering
all four curriculum weeks (singly traversal, insert at head, insert at tail, delete a node with
`free`, and doubly linked lists — both insert and bidirectional traversal). Six new content modules
live under `src/content/se201/linked-lists/`; each `export default`s a `ContentModule` and is
auto-discovered by the catalog with no shared-file edit. The app builds and runs; all four gates
(typecheck, lint, test, build) are green, and `validateTrace` passes over the whole catalog.

## 2. What I built
New files (all under `src/content/se201/linked-lists/`):
- `traverse.ts` — `singlyTraverseTrace`: walk `current` down the `next` chain to `NULL`, printing each node.
- `insertHead.ts` — `insertHeadTrace`: `malloc` a node, `new->next = head`, then `head = new` (order matters).
- `insertTail.ts` — `insertTailTrace`: walk to the last node, then splice `current->next = new`.
- `deleteNode.ts` — `deleteNodeTrace`: bridge `prev->next` around a middle node, then `free` it (`freed` state).
- `doublyTraverse.ts` — `doublyTraverseTrace`: forward via `next`, backward via `prev` (two arrow directions).
- `doublyInsert.ts` — `doublyInsertTrace`: insert at head fixing BOTH `new->next` and `head->prev`.

Each carries `course = "SE 201"`, the per-week `topic` string, a `file`, a `covers` row, and an
`order` (≈ 10 × week, with a unit digit to order modules within a week).

## 3. Acceptance criteria — self-assessment
Curriculum coverage — each module mapped to its `docs/CURRICULUM.md` SE 201 row:

- [x] **Week 1 — Introduction to Singly Linked Lists** (`traverse.ts`, `topic: "Introduction to Singly Linked Lists"`, order 10) — singly traversal, `current` glides node→node to the NULL sink.
- [x] **Week 2 — Singly Linked Lists Part 1** (`insertHead.ts` order 20, `insertTail.ts` order 21, `topic: "Singly Linked Lists Part 1"`) — insert at head (two rewires, order emphasised) and insert at tail (walk + splice).
- [x] **Week 3 — Singly Linked Lists Part 2** (`deleteNode.ts` order 30, `topic: "Singly Linked Lists Part 2"`) — pointer surgery: `prev->next = current->next`, then `free(current)` (block becomes `freed`); narration calls out the use-after-free bug shape (freeing before reading the link).
- [x] **Week 4 — Doubly Linked Lists** (`doublyTraverse.ts` order 40, `doublyInsert.ts` order 41, `topic: "Doubly Linked Lists"`) — nodes with both `next` and `prev`; traverse forward and backward; insert fixes both links.

Other acceptance items:
- [x] **Pointer rewires render as arrow retargets** — every `->next`/`->prev` reassignment changes a pointer cell's `target` between adjacent steps, which the engine diff turns into a retarget glide (e.g. `insertHead` step `link-next`: `nn.next` null→`n0`; `move-head`: `head` `n0`→`nn`; `doublyInsert` step `fix-prev`: `d0.prev` null→`nn`).
- [x] **free'd nodes show the `freed` state** — `deleteNode` step `free` sets the deleted block's `state: 'freed'` and adds a dangling `watch` line.
- [x] **Auto-discovered + passes `validateTrace`** — files dropped under the topic folder; `npm run test` (catalog validation over every trace) passes (49 tests).
- [x] **No shared-file edits; no format/renderer/design change** — only new files under my topic folder; `types.ts`, `catalog.ts`, `module.ts`, renderer, docs, and tests untouched.
- [~] **"linkedList fixture de-duplicated into content (keep one canonical copy)"** — intentionally NOT done; see §5.

## 4. How I verified correctness
- **Hand-trace of every node address, link, and value.** Each module uses a small set of fixed
  heap addresses (e.g. singly `0x5500/0x5520/0x5540`; delete `0xa00/0xa20/0xa40`; doubly
  `0xb00/0xb20/0xb40`) and stable cell ids; I traced each step's full snapshot by hand:
  - `traverse`: list 5 → 9 → 14 → NULL; console "5","9","14"; `current` ends at NULL.
  - `insertHead`: 7 → 4 → NULL, prepend 2 → **2 → 7 → 4 → NULL** (rewires: `nn.next`→n0, then `head`→nn).
  - `insertTail`: 7 → 4 → NULL, append 9 → **7 → 4 → 9 → NULL** (rewire: `n1.next` NULL→nn).
  - `deleteNode`: 7 → 4 → 9 → NULL, delete value 4 → **7 → 9 → NULL**, node 4 `freed` (rewire: `n0.next` n1→n2).
  - `doublyTraverse`: 1 ⇄ 2 ⇄ 3, forward prints 1 2 3, backward 3 2 1 → cumulative `"1 2 3 3 2 1 "`.
  - `doublyInsert`: 2 ⇄ 3, insert 1 → **1 ⇄ 2 ⇄ 3** (rewires: `nn.next`→d0, `d0.prev`→nn, `head`→nn).
- **`validateTrace` over the whole catalog** runs in `npm run test` and passed — it confirms
  `index` ordering, in-range `highlightedLines`, unique ids per step, and that every `activeId` and
  pointer `target` resolves to an id present in that step (so no dangling references in the data).
- **Throwaway executable cross-check (attempted):** I wrote a C program (`/tmp/seviz07_check.c`) and
  a Node mirror (`/tmp/seviz07_check.mjs`) reproducing all six programs. The sandbox permission
  policy in this environment allows only the project's `npm run` scripts, so `gcc`/`node` could not
  be executed here; the scripts are left in `/tmp` for a reviewer to run. The programs are
  small-integer / pointer-rewire only, and the hand-trace + structural validation above establish
  correctness; the values are independently checkable by inspection against the source in each file.

### Gate results (run in the worktree)
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS (6 files, 49 tests)
- `npm run build` — PASS

## 5. Key decisions & deviations
- **DE-DUP deferred (deviation from the phase prompt, per orchestration instruction).** The prompt's
  acceptance text says to "de-duplicate the `linkedList` fixture into content (keep one canonical
  copy)." I deliberately did **not** delete or edit anything under `src/content/fixtures/`. Those
  fixtures (`linkedList.ts`, etc.) are imported by engine tests (`src/engine/pointers.test.ts`,
  `src/engine/trace/pulse.test.ts`) and the catalog glob requires their default export; removing
  them in a content phase would break shared tests — out of lane for a content phase. I authored the
  canonical traversal additively as `traverse.ts` (`se201-singly-traverse`), which lives in the
  curriculum bucket (course `SE 201`, topic "Introduction to Singly Linked Lists"), distinct from
  the fixture's "Engine fixtures / Renderer primitives" bucket, so the temporary duplication is
  harmless. **Follow-up for the orchestrator (solo):** once engine tests are repointed off the
  `linkedList` fixture (or the fixture is kept purely as an engine test asset), drop the fixture from
  the catalog glob / delete it so only the canonical content copy remains.
- **Topic strings = the CURRICULUM "Block" column**, verbatim ("Introduction to Singly Linked
  Lists", "Singly Linked Lists Part 1", "Singly Linked Lists Part 2", "Doubly Linked Lists"). Each
  week is its own sidebar topic. This differs from the fixture's looser "Linked lists" topic, which
  is fine since the fixture is in a separate bucket.
- **Two modules in week 2 and week 4** (insert-head + insert-tail; doubly-traverse + doubly-insert)
  to keep each module focused on one operation, ordered with a unit digit (20/21, 40/41).
- **Uninitialised pointers** in freshly `malloc`'d nodes are shown with `target: null` and a `'0x?'`
  display (garbage) until assigned, matching the existing fixture convention; the meaningful rewires
  (to real targets or to NULL) animate as the lesson intends.

## 6. Trace format / API notes
No trace-format change. All modules use the existing `Trace`/`Step`/`Cell`/`HeapBlock` contract
(struct heap blocks, pointer cells, `state: 'freed'`, `condition`, `stdout`, `watch`, `activeId`).
No edits to `types.ts`, `catalog.ts`, `module.ts`, the renderer, the design system, docs, or tests.

## 7. Known issues / follow-ups
- The `linkedList` fixture de-dup is deferred to a solo orchestrator follow-up (see §5).
- `deleteNode` demonstrates middle deletion (the most instructive case). Head-deletion (the
  `prev == NULL → head = current->next` branch) is shown in the source and narrated as the alternate
  branch but not separately traced; a future module could trace it if desired.
- Throwaway `gcc`/`node` cross-check could not be executed in this environment's permission sandbox
  (scripts left in `/tmp`); verification rests on hand-tracing + `validateTrace`.

## 8. File map
Added this phase:
```
src/content/se201/linked-lists/
  traverse.ts        # week 1 — singly traversal
  insertHead.ts      # week 2 — insert at head
  insertTail.ts      # week 2 — insert at tail
  deleteNode.ts      # week 3 — delete + free
  doublyTraverse.ts  # week 4 — forward & backward traversal
  doublyInsert.ts    # week 4 — insert fixing both links
reports/phase-07-linked-lists.md
```
No files changed or deleted.
