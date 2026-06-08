# Phase 21b Report — Theory Content Pass: remaining SE 200 topics

> Shard of the Phase 21 theory content pass. Assigned folders only:
> `se200/{more-pointers-arrays-strings, even-more-pointers-arrays-strings, static-libraries,
> argc-argv, preprocessor}`.

## 1. Summary

Authored **five slide-deck `theory.md` files**, one per assigned SE 200 topic folder, following the
Phase 20 slide contract (`docs/THEORY_AUTHORING.md`) and matching the Phase 21a / exemplar quality.
Each is a complete, presentable mini-lecture: an auto-generated title slide, then `---`-separated
concept slides following the deck arc (why → mental model → syntax/rules → patterns → pitfalls →
worked example → recap → "see it run"), with `idea`/`watch-out`/`recap` callouts, highlighted C code
blocks (ligatures off), and tables/diagrams where they help. Every deck's frontmatter `course`/`topic`
was copied verbatim from a sibling module so it pins as that topic's Theory entry. **Content only** —
no engine/renderer/shared-file edits. `typecheck`/`lint`/`test` (144)/`build` all pass.

With Phase 21a (merged) + this shard, **all ten SE 200 topics now have a Theory deck.** Branch:
`phase-21b-theory-se200-rest`, cut from `main` (Phase 21a merged).

## 2. What I built

Five new files (each a ~10-slide deck):

- `src/content/se200/more-pointers-arrays-strings/theory.md`
- `src/content/se200/even-more-pointers-arrays-strings/theory.md`
- `src/content/se200/static-libraries/theory.md`
- `src/content/se200/argc-argv/theory.md`
- `src/content/se200/preprocessor/theory.md`

No other files changed.

## 3. Acceptance criteria — self-assessment

- [x] **1. gates pass; no shared-file edits; no trace-format/renderer/design change.** typecheck /
  lint / test (144) / build green. `git status` shows only the five new `theory.md` files.
- [x] **2. A slide-deck `theory.md` exists for every assigned folder; existing decks untouched.** All
  five written; the Phase 19/21a decks are not modified.
- [x] **3. Frontmatter `course`/`topic` copied exactly from a sibling module so it pins;
  `theory.test.ts` passes.** Each `topic` matches its modules verbatim (see table); test count rose
  134 → 144 (+2 per new deck).
- [x] **4. Each deck follows the slide convention and matches exemplar quality/depth.** Top-level
  `---` separators, one idea per slide, the full deck arc, callouts, C code blocks, a table
  (argc/argv, ptr-to-ptr) and an ASCII pipeline (static libs). Spot-verified the static-libraries deck
  in-browser (the widest slide — the pipeline diagram fits the 16:9 frame).
- [x] **5. All C / worked-example values verified; each deck names its topic's modules.** See §4.

### Each topic → the deck I wrote (and the modules it pins above)

| Folder | `topic` (verbatim) | order | Deck title | "See it run" names |
| --- | --- | --- | --- | --- |
| `more-pointers-arrays-strings` | `More Pointers, Arrays and Strings` | 60 | More Pointers — Strings & Pass-by-Pointer | *Walking a string (strlen)*, *Pass-by-pointer (swap)* |
| `even-more-pointers-arrays-strings` | `Even More Pointers, Arrays and Strings` | 70 | Double Indirection & Copying Strings | *Pointer to pointer*, *strcpy (two pointers)* |
| `static-libraries` | `Static Libraries` | 90 | Static Libraries | *Build pipeline* |
| `argc-argv` | `argc, argv` | 100 | Command-Line Arguments | *argc / argv structure*, *argv iteration* |
| `preprocessor` | `Preprocessor` | 105 | The C Preprocessor | *Macro expansion* |

## 4. How I verified the C and the values

I read each topic's module source(s) and hand-checked every code block and computed value:

- **more-pointers** — `my_strlen("hi")` walks `'h','i'` and stops at `\0` → returns **2** (terminator
  not counted). `swap(&x, &y)` reaches across frames via the addresses; passing `x, y` (no `&`) would
  do nothing — stated as a pitfall.
- **even-more-pointers** — `int x=5; int *p=&x; int **pp=&p;` → `*pp` is `p`, `**pp` is `x`; `**pp = 9`
  sets `x = 9`. The type table (`int` / `int *` / `int **`, `*pp`, `**pp`) is correct. `strcpy` copies
  each char then the `\0` last (matches the module's "the `\0` is copied last").
- **static-libraries** — read `buildPipeline.ts`: sources `main.c`, `circle.c`, `square.c` → `cc -c` →
  `main.o`, `circle.o`, `square.o`; `ar rcs libshapes.a circle.o square.o`; `ld` links `main.o` against
  the archive → `app`. The deck's ASCII pipeline and commands reproduce the module's stages exactly.
- **argc-argv** — read `structure.ts`: for `./prog hello 42`, `argc = 3`; `argv[0]="./prog"`,
  `argv[1]="hello"`, `argv[2]="42"` (the **string**, not the int 42), `argv[3] == argv[argc] == NULL`.
  The iteration loop walks `0 .. argc-1`. All match the module.
- **preprocessor** — read `macros.ts`: `#define MAX 100` → `cap = 100`; `#define SQ(x) ((x)*(x))` →
  `SQ(3 + 1)` expands to `((3 + 1) * (3 + 1)) = 16`. The "why parentheses" pitfall is exact: the unsafe
  `#define SQ(x) x*x` makes `SQ(3 + 1)` → `3 + 1*3 + 1 = 7`. The before/after matches the module's
  translation unit (`#include` pasted, `#define`s gone).

Each deck ties back to what its visualization shows (pointer-walk + arrow glide, two-hop chain,
pipeline stages, the argv array + NULL terminator, before/after macro expansion).

## 5. Key decisions & deviations

- **No deviations from the contract.** Strictly within the five assigned folders; content-only.
- **Titles** are clean concept names (e.g. "Double Indirection & Copying Strings", "Command-Line
  Arguments") driving the auto title slide.
- **`order`** set to each folder's module order (60/70/90/100/105) so topics keep their place.
- **Two-module folders** (more-pointers, even-more-pointers, argc-argv) have one deck whose closing
  slide names **both** modules.
- **Static-libraries uses a `text` (un-highlighted) ASCII pipeline diagram and shell commands** rather
  than C — appropriate since the topic is the *build*, and its visualization is a pipeline concept view
  (no C trace). Verified the diagram fits the slide.

## 6. Trace format / API notes

**No trace-format change, and no shared-file edits.** Theory docs are an additive, auto-discovered
content type (one `theory.md` per topic folder, picked up by the existing `?raw` glob); adding them
required no change to `catalog.ts`, `theory.ts`, the renderer, the trace format, or `validateTrace`.
All existing modules/traces and `validateTrace` are unaffected.

## 7. Known issues / follow-ups

- **SE 201 decks remain** — `se201/{dynamic-memory, linked-lists, linear-adts, hash-tables}` still need
  decks (other shard / not in my assignment). After those, every topic in both curriculums has Theory.
- Decks are authored to the per-slide budget; the static-libraries ASCII diagram is the densest slide
  and was checked to fit — re-verify if slide sizing ever changes.

## 8. File map

```
src/content/se200/
  more-pointers-arrays-strings/theory.md         # NEW — deck
  even-more-pointers-arrays-strings/theory.md     # NEW — deck
  static-libraries/theory.md                      # NEW — deck
  argc-argv/theory.md                             # NEW — deck
  preprocessor/theory.md                          # NEW — deck
reports/phase-21b-theory-se200-rest.md            # this file
```
