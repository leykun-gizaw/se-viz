# Phase 07 — Linked Lists (SE 201) — CONTENT, Wave 1 (parallel)

Read `docs/CONTENT_AUTHORING.md` first (shared rules). This prompt states only what's unique. Run on
your own branch/worktree; touch only your content folder.

## Context
- `src/content/fixtures/linkedList.ts` — the Phase 1 traversal fixture (heap nodes, `head`/`current`
  pointers, azure `next` arrows, `NULL` sink, arrow glide on advance). Your starting point + quality bar.
- `docs/design/SE-ViZ-visual-style-exploration.pdf` screen 02 — the target look (already implemented).

## Curriculum rows (from `docs/CURRICULUM.md`, SE 201, weeks 1–4)
1. **Introduction to Singly Linked Lists — `Singly Linked Lists`**
2. **Singly Linked Lists Part 1 — `More Singly Linked Lists—Part 1`**
3. **Singly Linked Lists Part 2 — `More Singly Linked Lists—Part 2`**
4. **Doubly Linked Lists — `Doubly Linked Lists`**

## Folder
`src/content/se201/linked-lists/` (course `SE 201`; topics per CURRICULUM.md — verify exact strings).

## What to author
Each node is a heap-allocated `struct` (value + `next`, and `prev` for doubly); the `head` lives on
the stack. Cover, across focused modules:
- **Traversal** — promote/refine the fixture: walk `current` to `NULL`, arrow gliding node→node,
  a counter/visit pulsing. (Singly, intro.)
- **Insert at head** — `malloc` a node, `new->next = head; head = new;` — show the two pointer
  rewires in order (and why order matters). (Part 1.)
- **Insert at tail / middle, and delete a node** — the pointer surgery: re-point the predecessor's
  `next` around the removed/!inserted node; for delete, `free` the node (it becomes `freed`). Show
  the classic bug shape in narration (losing the rest of the list if you rewire in the wrong order).
  (Part 1 / Part 2.)
- **Doubly linked list** — nodes with both `next` and `prev` (two arrow directions); insert/delete
  must fix **both** links; traverse forward and backward. (Doubly.)

## Teaching focus
Pointer rewiring is the whole subject: the **order** of assignments matters, and a dropped pointer
loses the list. Make each `->next`/`->prev` reassignment a visible **arrow retarget**, and free'd
nodes show the `freed` state. Reuse heap blocks, struct cells, arrows, the `NULL` sink, arrow-glide,
allocation states — all already implemented.

## Acceptance (in addition to CONTENT_AUTHORING.md)
- Modules covering all four rows: singly traversal, insert-at-head, insert/delete (mid/tail) with
  `free`, and doubly (both links, both directions). Pointer rewires render as arrow retargets.
- Every node address, link, and value verified correct (report §4); auto-discovered + passes
  `validateTrace`; no shared-file edits; no format/renderer/design change; `linkedList` fixture
  de-duplicated into content (keep one canonical copy).

Report: `reports/phase-07-linked-lists.md`.
