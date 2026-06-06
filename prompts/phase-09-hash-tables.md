# Phase 09 — Hash Tables (SE 201) — CONTENT, Wave 1 (parallel)

Read `docs/CONTENT_AUTHORING.md` first (shared rules). This prompt states only what's unique. Run on
your own branch/worktree; touch only your content folder.

## Context
- `docs/design/SE-ViZ-visual-style-exploration.pdf` screen 05 — the target look: a bucket array, a
  **hash-function process box** mapping a key to an index, and a **collision chain** (a small linked
  list) hanging off one bucket. Already implemented by the engine.
- `src/content/fixtures/linkedList.ts` — chains are just linked nodes; reuse that mechanism.

## Curriculum row (from `docs/CURRICULUM.md`, SE 201, week 7)
- **Hash Tables — `Hash Tables`**

## Folder
`src/content/se201/hash-tables/` (course `SE 201`, topic `Hash Tables` — verify exact string).

## What to author
- **The bucket array** `table[N]` — fixed-size array of head pointers (mostly `NULL`).
- **Hashing** — a **process box** showing `hash(key) % N → index` (use the `process` token / a
  process-style element; this is NOT live memory, it's the mapping). The chosen bucket pulses.
- **Insert with chaining on collision** — `put(key, v)`: hash to a bucket, `malloc` an entry, and
  **prepend** it (`e->next = table[i]; table[i] = e;`) so a collision grows a chain without
  overwriting the existing entry. Show the two pointer rewires (arrow retargets).
- **Lookup** — `get(key)`: hash to the bucket, then **walk the chain** comparing keys until found or
  `NULL` (arrow glide along the chain; `Step.condition` for the key comparison).
- Show at least one **collision** (two keys landing in the same bucket) so the chain is the point.

## Teaching focus
Hashing maps a key to a bucket in O(1); **collisions are normal** and handled by chaining; lookup is
hash-then-walk. Keep the hash function simple and **state your exact hash so the index is
verifiable** (e.g. sum of char codes `% N`, or a small documented polynomial). Reuse buckets
(array), entries (heap structs), `next` arrows, the process box, arrow-glide — all implemented.

## Acceptance (in addition to CONTENT_AUTHORING.md)
- A module (or two) covering: bucket array, hash→index mapping, insert with a real collision forming
  a chain, and lookup walking the chain. The hash function is explicit and its computed indices are
  correct.
- Every key→index computation, bucket content, and lookup result verified correct (report §4) —
  state the hash function and show the arithmetic; auto-discovered + passes `validateTrace`; no
  shared-file edits; no format/renderer/design change.

Report: `reports/phase-09-hash-tables.md`.
