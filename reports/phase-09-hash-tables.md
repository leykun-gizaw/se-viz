# Phase 09 Report — Hash Tables

## 1. Summary
This phase adds the SE 201 · Hash Tables (week 7) content: two hand-authored, verifiably-correct
execution traces that teach hashing, separate chaining, and chain-walking lookup. Both modules are
auto-discovered by the catalog (no shared-file edits) and play on the existing engine unchanged. The
hash function is explicit — `hash(key) = (sum of the key's char codes) % 8` — and every key→index is
shown with its full arithmetic. A real collision ("dog" and "owl" both land in bucket 2) forms a
chain, and lookup walks that chain comparing keys. All four gates (typecheck, lint, test, build) are
green.

## 2. What I built
- `src/content/se201/hash-tables/insert.ts` — `put(key, value)`: build the `table[8]` bucket array,
  hash three keys, and insert with prepend-on-collision chaining. 15 steps.
- `src/content/se201/hash-tables/lookup.ts` — `get("dog")`: hash to the bucket, then walk the
  collision chain comparing keys with `strcmp` until a match. 10 steps.

Both export their `Trace` and `export default` a `ContentModule` (`summary`, `label`, `order`).

## 3. Acceptance criteria — self-assessment
Curriculum row covered (both modules): **SE 201 · "Hash Tables"** (week 7), the only Hash Tables row
in `docs/CURRICULUM.md`. `course: 'SE 201'`, `topic: 'Hash Tables'`, `covers: ['SE201: Hash Tables']`,
`order: 70`/`71` (≈ 10 × week 7).

- [x] **Bucket array `table[N]` — fixed-size array of head pointers (mostly NULL)** — `table` is an 8-
  element `ArrayCell` of `entry_t *` pointer cells; at init all 8 are NULL (insert.ts step `init`).
- [x] **Hashing — process box showing `hash(key) % N → index`; chosen bucket pulses** — drawn as an
  azure `Annotation` arc from the key cell to the chosen bucket carrying the arithmetic, with the
  bucket given the amber active ring (`hash-cat`/`hash-dog`/`hash-owl`, and lookup `hash`). See §5 re:
  the process-box token.
- [x] **Insert with chaining on collision — `malloc`, prepend (`e->next = table[i]; table[i] = e;`),
  two pointer rewires** — `put("owl")` collides in bucket 2 and is shown as two distinct steps:
  `rewire-owl-next` (e->next → dog) then `rewire-owl-head` (table[2] → owl). The existing "dog" entry
  is never overwritten.
- [x] **Lookup walks the chain with `Step.condition` for key comparison** — lookup.ts walks
  owl → dog; `e != NULL` and `strcmp(e->key, key) == 0` are both rendered as condition chips
  (`compare-owl` → false, `compare-dog` → true).
- [x] **At least one real collision forming a chain** — "dog" and "owl" both hash to bucket 2.
- [x] **Hash function explicit and computed indices correct** — stated in §4; verified by hand.
- [x] **Auto-discovered + passes `validateTrace`; no shared-file edits; no format/renderer change** —
  files live only under `src/content/se201/hash-tables/`; the catalog validation test passes.

## 4. How to run & verify
Gates (run in the worktree), all green:
```
npm run typecheck   # tsc -b --noEmit — pass
npm run lint        # eslint . — pass
npm run test        # vitest run — 6 files, 45 tests pass (incl. validateTrace over the catalog)
npm run build       # tsc -b && vite build — pass
```
In `npm run dev`, open SE 201 → Hash Tables → "Insert with chaining" / "Lookup walks the chain".

### Correctness checks (hash function + arithmetic)
Hash function: `hash(key) = (sum of the ASCII code of each character of key) % 8`, N = 8.

Char codes: c=99 a=97 t=116 · d=100 o=111 g=103 · o=111 w=119 l=108.

| key   | sum of char codes        | sum | sum % 8 | bucket |
|-------|--------------------------|-----|---------|--------|
| "cat" | 99 + 97 + 116            | 312 | 0       | 0      |
| "dog" | 100 + 111 + 103          | 314 | 2       | 2      |
| "owl" | 111 + 119 + 108          | 338 | 2       | 2 (collision with "dog") |

Verification: 312 = 39·8 + 0; 314 = 39·8 + 2; 338 = 42·8 + 2. So "dog" and "owl" collide in bucket 2.
After insert, prepend order makes bucket 2's chain **owl → dog** (owl inserted last is the new head).

Lookup `get("dog")`: hash("dog") = 2 → start at head "owl". `strcmp("owl","dog") != 0` (no match,
walk), advance to "dog", `strcmp("dog","dog") == 0` (match), return `e->value` = 9. Result 9 is the
value inserted for "dog" — correct. Final table: bucket 0 = [cat=4], bucket 2 = [owl=2 → dog=9], all
other buckets NULL. Each step's bucket contents, pointer targets, and the lookup result were
hand-traced against these tables.

## 5. Key decisions & deviations
- **No process-box primitive (within-format substitute).** The prompt asks for a "process box" /
  `process` token for the `hash(key) % N → index` mapping. The trace format has **no** process/concept
  view — `docs/TRACE_FORMAT.md` explicitly defers concept views (static-library pipelines,
  preprocessor, dual-trace) to a future additive `view` discriminator, and instructs content phases
  to stay within existing mechanisms. Per the prompt's "STOP and write it in report §5" rule, I did
  not add a new primitive. Instead I conveyed the mapping with an `Annotation` arc (the existing azure
  labeled connector) from the key to the chosen bucket, carrying the exact arithmetic, plus the amber
  active ring on that bucket. This is faithful pedagogically and needs no format/renderer change. A
  future engine phase could introduce a real process-box `view` if desired.
- **File-scope `table` modeled as a base `globals` frame.** The engine models stack frames + heap,
  with no file-scope region. The global `table[N]` is shown in a persistent bottom frame named
  `globals` so it stays visible across the `put`/`get` activations pushed on top of it. This is a
  visualization choice, not a format change.
- **`key` modeled as a `char *` scalar showing the string literal** (e.g. `"owl"`) rather than a
  separate heap string block, to keep focus on hashing and chaining. Same simplification style as the
  `mallocFree` fixture's string content.
- **Two modules** (insert, lookup) rather than one, matching the exemplars' granularity; both cover
  the same single curriculum row. Helpers are duplicated per file because the auto-discovery contract
  requires every `*.ts` in a topic folder to default-export a `ContentModule` (no shared helper file
  in the folder).

## 6. Trace format / API notes
**No trace-format change.** Both modules use only existing fields (`ArrayCell`, `PointerCell`,
`StructCell`/heap `entry_t` blocks, `Annotation`, `Step.condition`, `activeId`, `heapLayout: 'row'`).

## 7. Known issues / follow-ups
- The hash mapping uses an `Annotation` arc rather than a dedicated process-box view (see §5). If a
  future phase adds a concept-view discriminator, these two traces could be upgraded to render a true
  process box.
- More buckets/keys or a "not found" (return -1) lookup could be added later for breadth; the current
  two modules already cover the required bucket array, hash mapping, collision chain, and chain walk.

## 8. File map
```
src/content/se201/hash-tables/insert.ts   (new) — put() with prepend-on-collision chaining
src/content/se201/hash-tables/lookup.ts   (new) — get() walking the collision chain
reports/phase-09-hash-tables.md           (new) — this report
```
```
