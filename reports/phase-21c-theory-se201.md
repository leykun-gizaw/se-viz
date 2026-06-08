# Phase 21c Report — Theory Content Pass: SE 201

> Shard of the Phase 21 theory content pass. Assigned folders only:
> `se201/{dynamic-memory, linked-lists, linear-adts, hash-tables}`.

## 1. Summary

Authored **nine slide-deck `theory.md` files** — one per **SE 201 topic** — covering every topic in
the four assigned folders, following the Phase 20 slide contract (`docs/THEORY_AUTHORING.md`) and the
exemplar/21a/21b quality bar. Each deck is a complete mini-lecture: an auto-title slide, then
`---`-separated concept slides (why → mental model → syntax/rules → patterns → pitfalls → worked
example → recap → "see it run"), with `idea`/`watch-out`/`recap` callouts, highlighted C blocks
(ligatures off), and tables where they help. **Content only** — no engine/renderer/shared-file edits.
`typecheck`/`lint`/`test` (152)/`build` all pass. With 21a + 21b + this shard, **every topic in both
SE 200 and SE 201 now has a Theory deck.**

Branch: `phase-21c-theory-se201`, cut from `main` (Phase 21a merged).

## 2. What I built — and the key structural decision

The four assigned folders are **not** one-topic-per-folder (unlike SE 200): they bundle **9 distinct
sidebar topics**. Theory pins to a sidebar collapsible by its frontmatter `topic`, and discovery
allows only **one `theory.md` per directory**. To give **every** topic a Theory entry (the prompt's
stated goal + SE 200 parity), I confirmed with the user and authored **one deck per topic**, placing
multi-topic folders' decks in **per-topic subfolders** (the `./**/theory.md` glob discovers them; each
pins by frontmatter `topic`). Nine new files:

- `se201/dynamic-memory/intro-allocation/theory.md` — *Introduction to Memory Allocation*
- `se201/dynamic-memory/malloc-free-commands/theory.md` — *malloc/free Commands*
- `se201/linked-lists/intro-singly/theory.md` — *Introduction to Singly Linked Lists*
- `se201/linked-lists/singly-part-1/theory.md` — *Singly Linked Lists Part 1*
- `se201/linked-lists/singly-part-2/theory.md` — *Singly Linked Lists Part 2*
- `se201/linked-lists/doubly/theory.md` — *Doubly Linked Lists*
- `se201/linear-adts/stacks-queues-part-1/theory.md` — *Stacks, Queues, LIFO, FIFO Part 1*
- `se201/linear-adts/stacks-queues-part-2/theory.md` — *Stacks, Queues, LIFO, FIFO Part 2*
- `se201/hash-tables/theory.md` — *Hash Tables*

## 3. Acceptance criteria — self-assessment

- [x] **1. gates pass; no shared-file edits; no trace-format/renderer/design change.** typecheck /
  lint / test (152) / build green. Only new `theory.md` files added (see §7 re: a stray `.gitignore`).
- [x] **2. A slide-deck `theory.md` exists for every assigned topic; existing decks untouched.** All 9
  SE 201 topics covered; SE 200 / pre-existing decks not modified.
- [x] **3. Frontmatter `course`/`topic` copied exactly from a sibling module so it pins;
  `theory.test.ts` passes.** Each deck's `topic` matches its modules verbatim; test count rose 134 →
  152 (+2 per new deck). Verified in-browser that each SE 201 collapsible (incl. the multi-topic
  folders) shows its pinned Theory entry.
- [x] **4. Each deck follows the slide convention + matches exemplar quality.** `---` separators, one
  idea per slide, full deck arc, callouts, C blocks, tables (stack/heap, array-vs-linked, key→bucket).
  Spot-verified the Hash Tables deck rendering.
- [x] **5. All C / worked-example values verified; each deck names its topic's modules.** See §4.

### Each topic → the deck (and modules it pins above)

| Topic (verbatim) | order | Deck title | "See it run" names |
| --- | --- | --- | --- |
| Introduction to Memory Allocation | 10 | Introduction to Memory Allocation | *malloc(32)*, *free & dangling*, *Memory leak* |
| malloc/free Commands | 13 | Sizing Allocations & realloc | *malloc(16)*, *realloc* |
| Introduction to Singly Linked Lists | 15 | Introduction to Singly Linked Lists | *Traverse* |
| Singly Linked Lists Part 1 | 20 | Inserting into a Singly Linked List | *Insert at head*, *Insert at tail* |
| Singly Linked Lists Part 2 | 30 | Deleting from a Singly Linked List | *Delete a node* |
| Doubly Linked Lists | 40 | Doubly Linked Lists | *Doubly: traverse both ways*, *Doubly: insert at head* |
| Stacks, Queues, LIFO, FIFO Part 1 | 50 | Stacks & Queues (Array-Backed) | *Array stack (LIFO)*, *Circular queue (FIFO)* |
| Stacks, Queues, LIFO, FIFO Part 2 | 60 | Linked Stacks & Queues | *Linked stack (LIFO)*, *Linked queue (FIFO)* |
| Hash Tables | 70 | Hash Tables | *Insert with chaining*, *Lookup walks the chain* |

## 4. How I verified the C and the values

I read each topic's module source(s) and hand-checked code + values against them:

- **Memory allocation** — `malloc(n)` → pointer or `NULL` (check it); pair with one `free`; dangling
  (use-after-free) vs leak (lost last pointer) stated as the two failure modes the modules show.
- **malloc/free Commands** — size as `n * sizeof(int)` (not hard-coded); heap array `a[i] == *(a+i)`;
  `realloc` may move (copying data) and must be assigned through a temp to avoid leaking on `NULL`.
- **Intro singly** — `struct node { int value; struct node *next; }`; traverse `p = head; while (p) {
  ...; p = p->next; }` stopping at `NULL`.
- **Singly Part 1** — insert-head `new->next = head; head = new;` (O(1), link before moving head);
  insert-tail walks `while (last->next)` then links (O(n)); empty-list guard.
- **Singly Part 2** — matches `deleteNode.ts`: search with `prev`+`current`, bridge `prev->next =
  current->next`, **then** `free` (reading `current->next` after `free` = use-after-free, the module's
  whole lesson); head/`not-found` edge cases.
- **Doubly** — matches `doublyInsert.ts`: `new->next = head` **and** `head->prev = new` (the easy-to-
  miss backward link), endpoints `NULL`; both-link consistency.
- **Stacks/Queues Part 1** — matches `arrayQueue.ts`: ring buffer with `front`/`rear`/`count`, advance
  `(i + 1) % CAP`, guard `count == CAP`/`count == 0`; stack `top` push/pop LIFO.
- **Stacks/Queues Part 2** — linked stack push/pop at head (O(1), `node_t **` to change caller's
  `top`); linked queue with head+tail (enqueue tail, dequeue head); empty-transition guards.
- **Hash Tables** — matches `insert.ts`: `hash(key) = (sum of char codes) % 8`; **re-derived**
  `"cat"` = 99+97+116 = 312, `312 % 8 = 0`; `"dog"` = 314 → 2; `"owl"` = 338 → 2 (collision); separate
  chaining prepends `e->next = table[i]; table[i] = e;`; use `strcmp` (not `==`) for keys.

## 5. Key decisions & deviations

- **One deck per topic via subfolders (DEVIATION from "one theory.md per folder").** The assigned
  folders bundle multiple topics; the literal "one per folder" would leave 5 of 9 SE 201 collapsibles
  without Theory, contradicting the prompt's goal. **Confirmed with the user**, who chose per-topic
  coverage. Multi-topic folders therefore contain per-topic subfolders each holding a `theory.md`
  (discovered by the `./**/theory.md` glob; pinned by frontmatter `topic`). The single-topic
  `hash-tables` deck sits directly in the folder. This stays within the assigned folders and needs no
  shared-file edit.
- **Titles** are clean concept names; **`order`** = each topic's min module order, so topics keep place.

## 6. Trace format / API notes

**No trace-format change, and no shared-file edits.** Theory docs are additive and auto-discovered;
the per-topic subfolders are found by the existing `./**/theory.md` glob (the module glob
`./*/*/*.ts` is unaffected — no `.ts` added). `catalog.ts`, `theory.ts`, the renderer, the trace
format, and `validateTrace` are untouched.

## 7. Known issues / follow-ups

- **Stray `.gitignore` modification** present in the working tree (adds `.vercel`/`.claude`/
  `.playwright-mcp`) — it predates and is unrelated to this content work; I left it **out** of the
  intended 21c change set (content-only). Flagging so it isn't committed as part of this shard.
- **Subfolders-for-theory** is a structural pattern worth noting for future content/tooling: a topic's
  theory may live in `…/<topic-slug>/theory.md` rather than the module folder root.
- With this shard, all SE 200 + SE 201 topics have Theory; the content pass for both curriculums is
  complete (pending merge of the 21a/21b/21c branches).

## 8. File map

```
src/content/se201/
  dynamic-memory/intro-allocation/theory.md          # NEW
  dynamic-memory/malloc-free-commands/theory.md       # NEW
  linked-lists/intro-singly/theory.md                 # NEW
  linked-lists/singly-part-1/theory.md                # NEW
  linked-lists/singly-part-2/theory.md                # NEW
  linked-lists/doubly/theory.md                       # NEW
  linear-adts/stacks-queues-part-1/theory.md          # NEW
  linear-adts/stacks-queues-part-2/theory.md          # NEW
  hash-tables/theory.md                               # NEW
reports/phase-21c-theory-se201.md                     # this file
```
