# Phase 06 Report — malloc / free: the heap (SE 201)

## 1. Summary
This phase promotes the Phase 1 `mallocFree` heap fixture into proper SE 201 curriculum content and
expands it across five focused, hand-authored traces under `src/content/se201/dynamic-memory/`. They
cover both week-1 curriculum rows (Introduction to Memory Allocation; malloc/free Commands), exercise
all four allocation states (`allocated`/`freed`/`dangling`/`leaked`), drive the console heap-watch,
cover the `NULL`-check, and show `sizeof` sizing and `realloc` copy-on-grow. The modules are
auto-discovered by the catalog with no shared-file edits. All four gates (typecheck, lint, test,
build) are green; `validateTrace` runs over the whole catalog (incl. these five) in the test suite
and passes.

## 2. What I built
Five new content modules (each `export default`s a `ContentModule`; auto-discovered by the catalog):
- `src/content/se201/dynamic-memory/allocateBlock.ts` — `malloc` returns a heap block; NULL-check;
  `strcpy` writes the bytes; `free`.
- `src/content/se201/dynamic-memory/freeAndDangling.ts` — `free` → dangling pointer; the `p = NULL`
  fix (dangling → freed).
- `src/content/se201/dynamic-memory/leak.ts` — a block outlives its only (local) pointer when a
  frame pops → leaked.
- `src/content/se201/dynamic-memory/sizeofMalloc.ts` — `malloc(n * sizeof(int))` sizing of one
  contiguous int array, loop-filled, freed whole.
- `src/content/se201/dynamic-memory/realloc.ts` — `realloc` copy-on-grow: new block, old freed,
  address change, pointers reassigned.

No shared files were edited (`catalog.ts`, `module.ts`, `types.ts`, renderer, tests, docs all
untouched). The `src/content/fixtures/mallocFree.ts` fixture was left in place (see §5).

## 3. Acceptance criteria — self-assessment
- [x] **Modules for both week-1 rows.** Row 1 *Introduction to Memory Allocation* (`malloc and free`):
  `allocateBlock.ts`, `freeAndDangling.ts`, `leak.ts` (topic string `"Introduction to Memory
  Allocation"`, `covers: ['SE201: malloc and free']`). Row 2 *malloc/free Commands* (`More on malloc
  and free`): `sizeofMalloc.ts`, `realloc.ts` (topic string `"malloc/free Commands"`, `covers:
  ['SE201: More on malloc and free']`). Topic strings verified against `docs/CURRICULUM.md` (SE 201,
  week 1, Block column).
- [x] **All four allocation states demonstrated.** `allocated` (every module); `dangling`
  (allocateBlock free step, freeAndDangling free step, sizeof/realloc free steps, realloc post-realloc
  old block); `freed` (freeAndDangling after `p = NULL`, realloc old block after `a = b`); `leaked`
  (leak.ts).
- [x] **Console heap-watch used.** `Step.watch` with `level: 'dangling'` in allocateBlock /
  freeAndDangling / sizeofMalloc / realloc, and `level: 'leak'` in leak.ts.
- [x] **`realloc` / `sizeof` shown.** `sizeofMalloc.ts` (`malloc(n * sizeof(int))`) and `realloc.ts`
  (copy-on-grow with address change and pointer reassignment).
- [x] **NULL-check covered.** `allocateBlock.ts` step `null-check` renders `if (buf == NULL)` with a
  condition chip (`buf == NULL → false`) and narrates the failure path.
- [~] **`mallocFree` fixture de-duplicated into content.** Intentionally NOT done — see §5. The
  canonical content was authored additively; de-dup is flagged as a solo follow-up.
- [x] **Every address, size, and state transition verified correct (see §4).**
- [x] **Auto-discovered + passes `validateTrace`; no shared-file edits; no format/renderer/design
  change.** `npm run test` (48 tests, incl. the catalog-wide validation) passes.

## 4. How to run & verify
Gates, all run in the worktree `/private/tmp/seviz-phase06`:
- `npm run typecheck` — pass (clean `tsc -b --noEmit`).
- `npm run lint` — pass (clean `eslint .`).
- `npm run test` — pass (Test Files 6 passed, Tests 48 passed; includes `validateTrace` over the full
  catalog, which now contains these five traces).
- `npm run build` — pass (`tsc -b && vite build`, built in ~140ms).

In the app (`npm run dev`), the sidebar shows a new **SE 201 · Data Structures and Algorithms I**
course with topics *Introduction to Memory Allocation* and *malloc/free Commands*, ordered before the
existing Engine-fixtures bucket.

Correctness checks (hand-traced; the determinate values are textbook-fixed). NOTE: the sandbox
blocked running a throwaway `cc`/`node` cross-check (Bash denied executing arbitrary binaries), so
these were hand-verified and additionally guarded by the catalog-wide `validateTrace` test:
- `sizeof(int) == 4` (target platform). `n * sizeof(int) = 4 * 4 = 16` bytes; `2 * sizeof(int) = 8`,
  `4 * sizeof(int) = 16`.
- Int array addresses ascend by 4: `0x8000, 0x8004, 0x8008, 0x800c` (sizeof) and `0x9400, 0x9404,
  0x9408, 0x940c` (realloc new block); old block `0x9000, 0x9004`.
- `a[i] = i * 10` → `{0, 10, 20, 30}` for `i = 0..3`; loop test `i < n` true for `i = 0..3`, false at
  `i = 4`.
- `"hello"` = 5 chars + NUL terminator = 6 bytes written into the 32-byte block; `printf` outputs
  `hello` and `42` respectively.
- State transitions: free with a live pointer aiming at the block ⇒ `dangling` (red danger arrow,
  driven by `resolvePointers`); clearing that pointer (`p = NULL`) ⇒ `freed` (no incoming arrow);
  dropping the only reference without freeing ⇒ `leaked`. realloc: old block `dangling` while stale
  `a` still points at it, then `freed` once `a = b` retargets, new block `allocated`.
- Structural: every `highlightedLines` entry is within its source; all `id`s unique per step; every
  `activeId`, pointer `target`, and watch entry resolves — confirmed by `validateTrace` (green).

## 5. Key decisions & deviations
- **De-dup deliberately NOT performed (per phase instructions / orchestrator override).** The phase
  spec's body says to "remove the `mallocFree` entry from the engine-fixtures group," but the
  orchestration note overrides this: `src/content/fixtures/mallocFree.ts` is imported by engine tests
  (`src/engine/trace/pulse.test.ts`, `src/engine/pointers.test.ts`) and the catalog glob requires its
  default export, so deleting/editing it in a content phase would break shared tests. I authored the
  canonical content additively instead. **Follow-up for the orchestrator (solo):** retire
  `fixtures/mallocFree.ts` and repoint any engine tests that consume it, once this content is merged.
  Temporary duplication is acceptable — the fixture lives in the separate "Engine fixtures" catalog
  bucket, while the new content lives under SE 201.
- **Five focused modules instead of one big trace.** The original fixture packed all four states into
  one trace; I split into single-concept modules (allocate, free/dangling, leak, sizeof, realloc) for
  teaching clarity, matching the quality-bar exemplars' granularity.
- **`leak.ts` teaches the leak via a popped frame** (heap outlives the call) rather than a reassigned
  pointer, because it makes the heap-vs-stack-lifetime lesson — the stated teaching focus —
  unmistakable and keeps the leak free of any dangling-pointer noise.
- **Honest dangling tails.** Where source frees a block while a pointer still holds its address
  (allocateBlock, sizeofMalloc, realloc), the final steps show the block as `dangling` with a watch
  line (real C behaviour: `free` does not null the pointer), rather than silently cleaning up.
- **Ordering.** `order` 10–14 (week 1) with unit digits to sequence within the week; topics sort by
  their minimum module order, so *Introduction to Memory Allocation* (10) precedes *malloc/free
  Commands* (13).
- No `any`; `state` helper params typed as `AllocationState` (not `HeapBlock['state']`) to satisfy
  `exactOptionalPropertyTypes`.

## 6. Trace format / API notes
No trace-format change. These modules use only the existing, already-additive fields (`heap`,
`HeapBlock.state`, `Step.watch`, `Step.condition`, `Step.activeId`, breadcrumb metadata,
`heapLayout`). No shared interface, renderer, design token, test, or doc was touched.

## 7. Known issues / follow-ups
- The `fixtures/mallocFree.ts` de-dup remains outstanding (see §5) — a solo orchestrator task after
  merge, since it requires touching shared engine tests.
- `realloc` is modeled in its block-moving case (the pedagogically interesting one); the in-place
  grow case is intentionally not shown to keep the address-change lesson sharp.

## 8. File map
Added (all new, under the assigned folder):
```
src/content/se201/dynamic-memory/allocateBlock.ts     malloc → block, NULL-check, strcpy, free
src/content/se201/dynamic-memory/freeAndDangling.ts   free → dangling, p = NULL fix → freed
src/content/se201/dynamic-memory/leak.ts              popped frame drops last reference → leaked
src/content/se201/dynamic-memory/sizeofMalloc.ts      malloc(n * sizeof(int)), loop-fill, free whole
src/content/se201/dynamic-memory/realloc.ts           realloc copy-on-grow, address change, reassign
reports/phase-06-malloc-free.md                       this report
```
Changed: none (no shared files).
```
