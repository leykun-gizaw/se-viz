# Phase 3 — Pointers, Arrays, Strings & Pointer Arithmetic (SE 200)

## Your role and context
You are Claude Code, implementing **SE-Viz**. Phases 0–2 are complete and committed: the trace
format, the full memory renderer (frames, scalars, **pointers + arrows**, **arrays with shared
borders + ascending addresses**, structs, heap), diff-driven animation (value pulse, arrow
retarget), full transport, the locked design system, the console panel, the content **catalog**,
and the **`validateTrace`** correctness check that runs over every catalog trace. Read before
starting:
- `README.md`, `docs/CURRICULUM.md` (authoritative concepts).
- `docs/TRACE_FORMAT.md`, `src/engine/trace/*` — the contract.
- `reports/phase-01-engine.md`, `reports/phase-02-c-fundamentals.md` — conventions + what exists.
- `src/content/fixtures/pointerArith.ts` and `src/content/fixtures/linkedList.ts` — the engine
  already renders **pointer arrows, arrays, and the pointer-arithmetic arc**; match this style.
- `src/content/se200/*` — Phase 2's authoring quality and the `catalog.ts` registration pattern.
- `docs/design/` — the locked design (implemented; do not restyle).

Phase 3 is **content, not engine.** You author the SE 200 pointer/array/string curriculum modules
as hand-authored, verifiably-correct traces. The engine already supports everything you need; it
should require **no change**, or at most a tiny **additive, documented** touch (see below).

## Hard constraints (unchanged)
- Frontend only. Traces-first (no interpreter). React + TS (strict) + Tailwind + Framer Motion.
- No `any` without justification. `typecheck`, `lint`, `test`, `build` must all pass.
- **Do not reshape the trace format or restyle the design system.** Reuse Phases 0–2.
- Register every module in `src/content/catalog.ts`; `validateTrace` must pass over all of them.
- Metadata (`course`/`topic`/`file`/`covers`) from `docs/CURRICULUM.md` — never fabricate codes.

## Concepts to cover (from `docs/CURRICULUM.md`, all SE 200)
Three curriculum rows. Author strong, representative modules for each (one clear correct trace per
idea beats many shallow ones; a row may hold a few short traces). **All targets are stack/static
memory — no `malloc`/heap content this phase** (heap is SE 201 / a later phase).

1. **Pointers, Arrays and Strings** (wk 3) — the foundations:
   - **Pointer basics:** `int x; int *p = &x;` then **dereference** (`*p`) and **write through the
     pointer** (`*p = 99`) — the write must **pulse the target `x`, not `p`** (the key insight).
     Draw the azure arrow `p → x`.
   - **Arrays & indexing:** a contiguous array; show `arr[i]` and **`*(arr + i)` landing on the
     same element/address** (reuse the pointer-arithmetic annotation arc).
   - **Strings:** a `char[]` with a **visible `\0` terminator**; traverse/print it.
2. **More Pointers, Arrays and Strings** (wk 4):
   - **Pass-by-pointer (`swap(int *a, int *b)`)** — the marquee "why pointers" example: the
     function's parameters are pointers **aimed across frames into `main`'s `x`/`y`**, and the
     swap **pulses `main`'s variables**, visibly proving the caller's values changed. Contrast in
     narration with pass-by-value.
   - **Walking a buffer with a pointer:** a pointer marching through an array/string in a loop
     (`p++` / `*(p+i)`), the **arrow gliding** to each element as it advances, a counter pulsing
     (e.g. a hand-written `strlen` counting to `\0`).
3. **Even More Pointers, Arrays and Strings** (wk 4):
   - **Pointer to pointer (`int **pp`)** — double indirection drawn as a **two-hop arrow chain**
     (`pp → p → x`); dereferencing once vs twice.
   - One richer composite (your choice, still small/legible): e.g. **`strcpy` with two advancing
     pointers** (src/dst march in lockstep, chars copied, `\0` copied last), **an array of strings**
     (`char *words[]` — pointers into separate char arrays), or **2D-array indexing**.

## The teaching focus of this phase: the pointer ⇄ array ⇄ address relationship
This is the hardest cluster in C, and the engine's arrows + addresses are exactly what make it
click. Make these ideas unmistakable:
- **Dereference resolves through the arrow.** `*p` reads the cell the arrow points to; narration
  ties the value back to the target's address.
- **Writing through a pointer changes the target.** `*p = v` pulses the **target**, and `p` is
  unchanged — call this out explicitly; it's the #1 confusion.
- **Array/pointer duality.** Show `arr[i] == *(arr + i)` by landing both on the same address; show
  the array name behaving like a pointer to the first element.
- **Pointers cross stack frames.** In `swap`, the params' arrows reach into `main`'s frame and the
  mutation is visible in `main` — this is why pass-by-pointer works and pass-by-value doesn't.
- **`p++` moves by `sizeof(*p)`.** When walking a buffer, the address advances by the element size
  (reuse the byte-offset annotation idea from `pointerArith`).
- **`\0` ends a string.** The null terminator is a real, visible element; traversal stops there.

Prefer existing mechanisms (arrows, the annotation arc, value pulses, `activeId`, `Step.condition`
from Phase 2 for the loop tests). If the **string `\0`** needs a small visual emphasis to read
clearly (this is the first phase to author strings), a **minimal additive rendering touch** is
acceptable — but no trace-format reshape and no restyle. Do not over-build.

## Content organization
- Add modules under `src/content/se200/<topic>/…` mirroring Phase 2's structure, registered in
  `catalog.ts` under the correct SE 200 topics.
- Keep each trace focused; use the `swap`/double-pointer cross-frame and two-hop arrows to show off
  what the Phase 1 overlay can already do.

## Non-goals for Phase 3 (do NOT build)
- No `malloc`/`free`/heap content (SE 201 / later). No linked lists, stacks/queues, hash tables.
- No concept-views (build pipeline, preprocessor, dual-trace). No navigation shell. No interpreter.
- No design restyle, no trace-format reshape, no new memory primitive (arrays/pointers/strings all
  already exist).

## Acceptance criteria (the reviewer will check these against the code)
1. `typecheck`, `lint`, `test`, `build` all pass; no `any` without justification.
2. Correct, well-narrated modules exist for all three curriculum rows, covering at minimum:
   address-of + dereference, **write-through-pointer pulsing the target**, **array indexing ⇄
   `*(arr+i)` on the same address**, a **string with a visible `\0`**, **pass-by-pointer (`swap`)
   with cross-frame arrows**, **a pointer walking a buffer in a loop**, and **a pointer-to-pointer
   two-hop chain**. Metadata curriculum-sourced (all SE 200).
3. Pointer arrows resolve correctly, including **across stack frames** (swap) and **pointer→pointer**
   (double indirection); arrows **glide** as a walking pointer advances; `NULL`/end handled.
4. Array/pointer duality is shown via the annotation arc landing `arr[i]` and `*(arr+i)` on the
   same address; `p++` advances by element size.
5. Strings render as `char` arrays with a clearly visible `\0`; traversal stops there.
6. All new traces are registered in the catalog and pass `validateTrace` (the catalog test covers
   them).
7. Any engine/trace-format change is additive, leaves Phases 0–2 traces valid, and is documented.
8. Every authored address, value, and computed result is **verifiably correct** — the report's §4
   must explain how you checked (hand-trace + throwaway calc; no shipped interpreter). Pay special
   attention to **address math** (element size, `&`, `*(p+i)`) and **string bytes incl. `\0`**.

## When done
Write your report to `reports/phase-03-pointers-arrays-strings.md` using `reports/TEMPLATE.md`.
In §3 list each module and the concept/row it covers; in §4 show how you verified addresses and
values; in §5 flag deviations; in §6 document any additive change. Do not start a later phase.
