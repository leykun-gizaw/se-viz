# Phase 3 Report — Pointers, Arrays, Strings & Pointer Arithmetic (SE 200)

## 1. Summary

Phase 3 authors the SE 200 pointer/array/string curriculum as seven hand-authored, verifiably-correct
traces that play on the existing engine — content, not engine. The three curriculum rows
("Pointers, Arrays and Strings", "More…", "Even More…") are each covered with focused modules:
address-of + dereference + **write-through that pulses the target (not the pointer)**, **array/pointer
duality** (`arr[i]` and `*(arr+i)` landing on the same address via the annotation arc), a **string
with a visible `\0`**, **pass-by-pointer `swap` with cross-frame arrows**, a **pointer walking a buffer**
(`my_strlen`) with the arrow gliding and the counter pulsing, a **pointer-to-pointer two-hop chain**
(`pp → p → x`), and a **`strcpy`** composite where two pointers march in lockstep and the `\0` is copied
last. The engine needed **no trace-format change**; the only code touch is a tiny additive rendering
treatment so NUL terminators read clearly. Every module is registered in `catalog.ts` and passes
`validateTrace` (the catalog test now covers all of them). All gates pass — `typecheck`, `lint`,
`test` (40 across 6 files), `build` — with no `any`; Phases 0–2 traces remain valid.

## 2. What I built

- **Modules** (`src/content/se200/`):
  - `pointers-arrays-strings/pointerBasics.ts`, `arrayIndexing.ts`, `strings.ts`
  - `more-pointers-arrays-strings/swap.ts`, `strlen.ts`
  - `even-more-pointers-arrays-strings/pointerToPointer.ts`, `strcpy.ts`
- **Catalog**: registered all seven under three new SE 200 topics in `src/content/catalog.ts`.
- **Rendering touch** (additive, no format/restyle): `isNulTerminator` in
  `src/components/memory/CellView.tsx` — a char array element holding `'\0'` renders dashed + muted.
- **Docs**: a "Phase 3 notes" section in `docs/TRACE_FORMAT.md` (string authoring convention, the
  `\0` touch, and a note that cross-frame / pointer→pointer arrows need no new mechanism).

## 3. Modules and the row/concept each covers

| Module (file) | Row (CURRICULUM) | Course · topic · file | Teaches |
| --- | --- | --- | --- |
| `pointerBasics.ts` | Pointers, Arrays and Strings (wk 3) | SE 200 · Pointers, Arrays and Strings · pointers.c | `&x`; `*p` read into `y`; **`*p = 99` pulses the target `x`, not `p`**; azure arrow `p → x`. |
| `arrayIndexing.ts` | Pointers, Arrays and Strings (wk 3) | SE 200 · Pointers, Arrays and Strings · arrays.c | `arr[2]` and `*(arr + 2)` land on the **same element & address** (0x6008) via the annotation arc; array name as pointer-to-first. |
| `strings.ts` | Pointers, Arrays and Strings (wk 3) | SE 200 · Pointers, Arrays and Strings · strings.c | `char[3] = "hi"` with a **visible `\0`**; `printf("%s")` stops at the terminator. |
| `swap.ts` | More Pointers, Arrays and Strings (wk 4) | SE 200 · More Pointers, Arrays and Strings · swap.c | **Pass-by-pointer**: `a`/`b` aim **across frames** into `main`'s `x`/`y`; the swap **pulses main's variables**. |
| `strlen.ts` | More Pointers, Arrays and Strings (wk 4) | SE 200 · More Pointers, Arrays and Strings · strlen.c | A pointer **walks the buffer** (`p = p + 1` by 1 byte), arrow **glides** element→element, `len` pulses, loop **stops at `\0`** (`Step.condition` chip). |
| `pointerToPointer.ts` | Even More Pointers, Arrays and Strings (wk 4) | SE 200 · Even More Pointers, Arrays and Strings · ptrptr.c | `int **pp` drawn as a **two-hop chain `pp → p → x`**; `*pp` vs `**pp`. |
| `strcpy.ts` | Even More Pointers, Arrays and Strings (wk 4) | SE 200 · Even More Pointers, Arrays and Strings · strcpy.c | The richer composite: **two pointers in lockstep**, chars copied, **`\0` copied last**. |

All metadata is curriculum-sourced; all are SE 200 (weeks 3–4). No course code was invented.

## 4. How I verified correctness (addresses, values, string bytes)

Each trace was hand-traced and the determinate facts cross-checked with a throwaway Node calc (not
shipped). Highlights:

- **Address math.** `arrayIndexing`: `arr` base `0x6000`, `sizeof(int)=4`, so `arr + 2 = 0x6000 +
  2×4 = 0x6008 = &arr[2]` (value 30) — the arc label and the element address agree. `pointerBasics`:
  `p` holds `&x = 0x7ffd0010`. `pointerToPointer`: `x@0x9010`, `p=&x` holds `0x9010` `@0x9018`,
  `pp=&p` holds `0x9018` `@0x9020`; `**pp = *p = x = 42`.
- **`p++` by element size.** `strlen`/`strcpy`: chars are 1 byte, so `p = p + 1` steps `0x8000 →
  0x8001 → 0x8002 → 0x8003` (and `0xa000…`, `0xb000…`) — addresses advance by exactly 1 and the
  arrow target id advances one element.
- **String bytes incl. `\0`.** `strings`: `"hi"` ⇒ `'h'@0x7000, 'i'@0x7001, '\0'@0x7002`. `strlen`:
  `"cat"` ⇒ `'c','a','t','\0'`, counted length **3** (terminator not counted). `strcpy`: copies
  `'h'→dst[0]`, `'i'→dst[1]`, then `'\0'→dst[2]`; result `dst = "hi"`.
- **Write-through & swap.** `pointerBasics`: after `*p=99`, `x=99` while `y` stayed `5` (the read was
  a copy). `swap`: `x=3,y=7 → tmp=3; *a=*b ⇒ x=7; *b=tmp ⇒ y=3` ⇒ `7 3`.

Throwaway-calc output confirmed: `arr+2 = 0x6008`, value 30; string addrs `0x7000,0x7001,0x7002`;
`swap → 7 3`; `strlen("cat") = 3`; `**pp = 42`; `strcpy dst @0xb000..0xb002 → h,i,\0`.

**Structural correctness** is enforced automatically: `validateTrace` runs over all catalog traces
(now including the seven new ones) and passes — every `highlightedLines` entry is within its source,
ids are unique per step, and every `activeId` / pointer `target` / annotation endpoint resolves
(this also confirms the **cross-frame** `swap` targets and the **pointer→pointer** target resolve
correctly). I also stepped through in the browser and confirmed: the write-through pulses `x` (not
`p`); `swap`'s `a`/`b` draw two arrows reaching up into `main`; `pp → p → x` draws a two-hop chain;
`strlen`'s arrow glides into the char array and the `\0` cell shows its dashed/muted treatment.

## 5. Key decisions & deviations

- **No deviations from constraints or non-goals.** No heap/`malloc`, no linked lists/ADTs, no
  concept-views, no navigation shell, no restyle, **no trace-format reshape**. All targets are
  stack/static memory.
- **Char literals as display values.** String/char cells store quoted literals (`"'h'"`, `"'\\0'"`)
  so operators and the terminator read literally (ligatures are already off). Chars advance addresses
  by 1.
- **The `\0` rendering touch** (the prompt's anticipated "minimal additive rendering touch") is a
  CellView-only change using existing tokens (dashed border + muted text). It is **not** a
  trace-format field and changes only how a terminator looks; see §6.
- **`strcpy` chosen** for the row-3 composite (over array-of-strings / 2D indexing) because it best
  reuses and showcases the walking-pointer mechanic and shows the `\0` copied last.
- **For-loop/while counters and walking pointers** are shown one statement per step (condition check,
  body, advance) so each `p++` and each pulse is visible; this keeps step counts honest (e.g.
  `strlen` 18 steps, `strcpy` 17) but every iteration is legible via the transport.

## 6. Additive change (rendering only — no trace-format change)

`isNulTerminator(cell)` in [`CellView.tsx`](../src/components/memory/CellView.tsx): an `array`
element that is a `scalar` whose displayed value contains `\0` renders with `border-dashed
border-hairline-strong` and `text-ink-muted` (existing tokens only). Rationale: strings are new this
phase and the terminator is the one element learners must *see* as "the end." It is purely visual —
the cell is an ordinary scalar in the data model, so Phases 0–2 traces are unaffected and
`validateTrace` is unchanged. Documented in `docs/TRACE_FORMAT.md` → "Phase 3 notes".

No trace-format fields were added or changed. Cross-frame arrows and the pointer→pointer two-hop
chain required **no** new mechanism — a pointer `target` is a stable id, so it can resolve to a cell
in another frame or to another pointer cell; the Phase 1 overlay already draws these.

## 7. Known issues / follow-ups

- **`my_strlen`/`my_strcpy`** are named with a `my_` prefix to avoid implying the real libc
  functions; the traces model the textbook hand-written versions.
- **Walking traces are step-dense** by design (one statement per step). A future "skip to next
  iteration" affordance would help longer walks; not built (out of scope).
- **Addresses mix scales** for legibility (e.g. an array at `0x6000` while scalars sit at `0x7ffd…`),
  following the Phase 1 `pointerArith` precedent — a deliberate teaching simplification, not a real
  layout.
- The `\0` treatment keys off the displayed value containing `\0`; authors should write the
  terminator as a char literal (`"'\\0'"`) for it to render distinctly (documented).

## 8. File map

```
src/
  components/memory/CellView.tsx        # + isNulTerminator (\0 dashed/muted rendering touch)
  content/
    catalog.ts                          # + 3 SE 200 topics, 7 modules registered
    se200/
      pointers-arrays-strings/
        pointerBasics.ts  arrayIndexing.ts  strings.ts
      more-pointers-arrays-strings/
        swap.ts  strlen.ts
      even-more-pointers-arrays-strings/
        pointerToPointer.ts  strcpy.ts
docs/
  TRACE_FORMAT.md                       # + "Phase 3 notes" (string convention, \0 touch, arrows)
reports/
  phase-03-pointers-arrays-strings.md   # this file
```
