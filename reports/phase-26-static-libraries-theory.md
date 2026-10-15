# Phase 26 Report — Static Libraries theory deep-dive: build diagrams + expanded deck

## 1. Summary

The Markdown/slide engine now has two more in-house diagram kinds, **`pipeline`** and
**`symbol-table`**. Both are parsed strictly into typed specs and rendered as token-styled SVG, with no
new dependency and no raw HTML. The Static Libraries deck grew from 10 slides to **20** (including the
auto title slide). Every ASCII diagram is gone, and the deck now has **10 diagrams in the new kinds**.
It covers each NEW item in Part B: the symbol table inside a `.o`; unresolved symbols as normal; the
archive index; linking drawn need-to-definition; the "undefined reference" error and its picture; link
order with both orders, one failing; header vs library; incremental rebuild with a highlighted path;
and a commands recap. `typecheck`, `lint`, `test` (**290/290**, 18 files) and `build` pass. The two
Phase 22 kinds render **byte-identically**, which a snapshot recorded *before* any engine edit now
enforces.

Branch: `phase-26-static-libraries-theory`, cut from `main` at `6cd2cb7`. **Not merged.**

## 2. What I built

**Engine (reusable):**

- `src/engine/markdown.ts`
  - New types `PipelineDiagramNode`, `PipelineDiagramEdge`, `SymbolEntry`, `SymbolFile`, `SymbolRef`
    and `SymbolEdge`, plus two new members of the `Diagram` union.
  - `parsePipeline` and `parseSymbolTable`, with both kinds added to `DIAGRAM_LANGS`.
  - `parseDiagram` now returns `Diagram | null`. `null` means a strict kind was malformed, and
    `parseMarkdown` then keeps the fence as a plain code block.
- `src/components/Diagram.tsx`
  - `PipelineDiagram`: columnar layout by stage. Artifacts are file cards with a folded corner;
    processes are dashed pills; edges are S-curves with arrowheads. A `highlight` path is amber and dims
    everything else; `accent` gives the teal final-product look. An edge that skips columns runs level
    and bends only before its target.
  - `SymbolTableDiagram`: box columns, with stacked boxes inside a column; DEFINES / NEEDS sections;
    resolve arrows that run entry-to-entry. Unresolved needs get a danger-soft row and an `UNRESOLVED`
    tag. Failed edges are dashed danger, crossed out, with no arrowhead.
  - `CallStackDiagram` and `CallTreeDiagram` are **untouched**.

**The two DSLs (the reusable contract), as documented in `docs/THEORY_AUTHORING.md`:**

`pipeline`:

```
NODE   ID[: LABEL] | part | part …        (any line with "|")
         part = @N (stage/column, required) | artifact (default) | process
              | highlight | accent | <one free-text sublabel>
EDGE   a -> b [-> c …]                    (between declared IDs)
       caption: …
```

`symbol-table`:

```
file NAME [@N]                 a box; @N = column (default: declaration index)
defines: a, b                  symbols the box defines
needs: c, d!                   symbols it needs; trailing ! = unresolved (needs only)
FILE:SYM -> FILE:SYM           resolve edge, needs → another box's defines (split at last ':')
FILE:SYM -x FILE:SYM           failed edge
caption: …
```

**Content:** `src/content/se200/static-libraries/theory.md`. The slide list, in order (★ = NEW,
◆ = uses a new diagram kind):

1. *(auto title)*
2. Why this matters
3. Separate compilation ◆ `pipeline`: three `.c` → three `cc -c` runs → three `.o`
4. ★ What is inside a `.o` ◆ `symbol-table`: `main.o` defines `main`, needs `area_circle`,
   `area_square`, `printf`
5. ★ Unresolved symbols are normal: `nm main.o` output (`U` / `T`), plus an idea callout
6. The full build pipeline ◆ `pipeline` `.c → .o → .a → app`, mirroring the Phase 12 viz node for node
7. Archiving with `ar` ◆ `pipeline`: `circle.o` + `square.o` → `ar rcs` → `libshapes.a`
   (2 members + index), with the `r`/`c`/`s` flags explained
8. ★ The archive index: `nm -s libshapes.a` output, and `ranlib`
9. Linking, drawn ◆ `symbol-table`: three needs resolved into two archive members and `libc.so.6`;
   the archive members are copied into `app`, `printf` is not
10. ★ A link error you will see: the `area_triangle` setup and the full GNU ld error
11. ★ "undefined reference", drawn ◆ `symbol-table` with `area_triangle!` unresolved
12. ★ Link order ◆◆ two `symbol-table`s: `cc main.o -L. -lshapes` resolves;
    `cc -L. -lshapes main.o` fails with `-x` edges
13. Header vs library ◆ `pipeline`: `shapes.h` "declares · compile time" into `cc -c`,
    `libshapes.a` "defines · link time" into `ld`
14. Why "static"
15. Static vs dynamic: a 4-row comparison table
16. ★ Incremental rebuild ◆ `pipeline`: the `circle.c` path highlighted, the rest dimmed, plus the
    three re-run commands
17. Common pitfalls: each trap points at the slide that drew it
18. ★ Commands recap: a table mapping `cc -c` / `ar rcs` / `ar t` / `cc … -L. -lshapes` to its stage
19. Recap
20. See it run

**Tests:**

- `src/engine/markdown.test.ts`: 2 valid-parse tests and 16 malformed cases. Every malformed case must
  fall back to `{type:'code'}` with the original text.
- `src/components/Diagram.test.tsx` (new):
  - Phase 22 baseline snapshots, recorded before any edit.
  - Pipeline and symbol-table render tests: dashed process pill, amber highlight, dimming count, teal
    accent, danger unresolved row, dashed failed edge with no arrowhead, azure resolved arrow, and
    **no hard-coded hex colors**.
- `src/content/se200/static-libraries/theory.test.ts` (new) pins this phase's acceptance:
  - slide count between 18 and 22
  - no box-drawing characters or `->`/`→` arrows in any code block
  - at least 6 diagrams in the new kinds, including both kinds
  - an unresolved symbol, a failed edge, and a multi-node highlight path
  - example names and commands consistent with the Phase 12 viz

**Docs:** `docs/THEORY_AUTHORING.md` documents both DSLs, with examples and the strictness rule.

## 3. Acceptance criteria — self-assessment

- [x] **1. `typecheck`/`lint`/`test`/`build` pass; no new deps; no raw HTML; existing diagram kinds,
  decks, traces, `validateTrace`, `theory.test` unaffected.**
  - All four pass, and `test` is 290/290.
  - `package.json` is unchanged.
  - No `dangerouslySetInnerHTML`; the new renderers emit only React SVG elements.
  - Existing kinds are byte-identical. `Diagram.test.tsx.snap` was written against `main`'s
    `Diagram.tsx`, before any engine edit, and still passes. I also kept a copy of the baseline
    snapshot and diffed it after the change: no difference.
  - `theory.test` and catalog `validateTrace` pass over every doc and trace.
- [x] **2. The engine parses and renders `pipeline` and `symbol-table` fenced diagram blocks to
  token-styled SVG; parsers unit-tested (valid + malformed); syntax documented in
  `docs/THEORY_AUTHORING.md`.**
  - Parsers and renderers as listed in §2.
  - 18 parser tests (2 valid + 16 malformed) and 5 renderer tests.
  - The renderer tests assert there are no hex colors, so styling comes from tokens only.
- [x] **3. The deck has ~18–22 slides, zero ASCII-art diagrams, uses the new kinds ≥ 6 times, and
  covers every NEW item — including the undefined-reference slide (an `unresolved` symbol in the
  warn/danger style) and the link-order slide (both orders shown, one failing).**
  - 20 slides, 10 new-kind diagrams, 0 ASCII art. The deck test enforces all three.
  - Undefined reference: slides 10–11. Link order: slide 12, screenshot below.
- [x] **4. Every command, symbol name, and error message is real and internally consistent with the
  `main.c`/`circle.c`/`square.c` → `libshapes.a` → `app` example.**
  - **Executed** in Ubuntu 22.04 with gcc 11.4.0 and GNU ld 2.38. Every command, symbol and error
    line in the deck matches the real output. Transcript in §4.2.
- [x] **5. Diagrams legible at slide scale in both themes (dark primary) and in presentation mode.**
  - Every slide was checked in the browser, programmatically. All 20 have `scrollHeight ==
    clientHeight` on the 1280×720 canvas (no overflow), and every diagram fence rendered as an SVG
    (no fallbacks).
  - Visually checked in dark, light and presentation mode. Screenshots are in `reports/assets/`:
    `phase26-s06-light.png` (full pipeline), `phase26-s09-light.png` (linking),
    `phase26-s11-dark.png` (undefined reference), `phase26-s12-dark.png` (link order),
    `phase26-s13-light.png` (header vs library), `phase26-s16-dark.png` (incremental rebuild) and
    `phase26-present-dark.png` (presentation mode).

## 4. How to run & verify

```sh
npm run typecheck && npm run lint && npm test && npm run build
npm run dev   # → sidebar: SE 200 › Static Libraries › Theory  (f = presentation mode)
```

### 4.1 Rendering

1. Walk all 20 slides in dark and light, and press `f` on slide 16.
2. Slide 12 is the one to look at hardest. The failing order should read as broken (dashed red, ✕,
   UNRESOLVED) without the caption.
3. Slide 6 should match the Build pipeline visualization one-for-one: press **Continue to the
   visualization →** and compare.

### 4.2 How the commands and symbol stories were verified

**Executed, not desk-checked.** I ran the deck's exact program through every command it shows in a
throwaway **Ubuntu 22.04** container, using the Ubuntu toolchain students use: **gcc 11.4.0** and
**GNU ld (Binutils) 2.38**. There were 5 files: `shapes.h`, `main.c` (calls `area_circle(1.0)` and
`area_square(2.0)` with `printf`), `circle.c`, `square.c`, and an `area_triangle` variant of `main.c`
plus `shapes.h`. Verbatim results:

```console
$ nm main.o                                  # slides 4–5
                 U area_circle
                 U area_square
0000000000000000 T main
                 U printf
$ ar rcs libshapes.a circle.o square.o && ar t libshapes.a      # slides 7, 18
circle.o
square.o
$ nm -s libshapes.a                          # slide 8 (the deck shows the index part)
Archive index:
area_circle in circle.o
area_square in square.o
…
$ cc main.o -L. -lshapes -o app && ./app     # slide 9
3.14
4.00
$ nm app | grep area                         # copied in
0000000000000790 T area_circle
00000000000007b8 T area_square
$ ldd app | grep libc; nm app | grep printf  # printf is NOT copied in — slides 9, 15
	libc.so.6 => /lib/aarch64-linux-gnu/libc.so.6 (0x0000ffffbc7d0000)
                 U printf@GLIBC_2.17
$ cc -L. -lshapes main.o -o app2             # slide 12, wrong order
/usr/bin/ld: main.o: in function `main':
main.c:(.text+0xc): undefined reference to `area_circle'
/usr/bin/ld: main.c:(.text+0x20): undefined reference to `area_square'
collect2: error: ld returned 1 exit status
$ cc -c main.c && cc main.o -L. -lshapes -o app   # slide 10, area_triangle variant — compile OK
/usr/bin/ld: main.o: in function `main':
main.c:(.text+0x38): undefined reference to `area_triangle'
collect2: error: ld returned 1 exit status
$ cc -c circle.c && ar rcs libshapes.a circle.o && ar t libshapes.a   # slide 16: r replaces
circle.o
square.o
```

Every line the deck shows matches, character for character. The one exception is deliberate: the
`.text` offset, which the deck shows as `0x…` because the real number depends on the code and the
architecture. The container ran on **arm64** (Apple Silicon host). The message format and symbol
tables are architecture-independent, but on a typical x86-64 laptop the offsets will differ.

Earlier in the phase, the same program also ran through macOS (Apple clang 21) and showed the same
structure. Mach-O prefixes `_` to each symbol, and Apple's ld64 **ignores link order**, which is why
the Linux run was needed to confirm slide 12.

## 5. Key decisions & deviations

- **`parseDiagram` now returns `Diagram | null`.** The prompt asks for malformed input to "fall back
  to a plain code block, matching Phase 22 behavior". Phase 22's parsers never actually fail: a broken
  `call-stack` just parses into odd frames, and an empty `call-tree` renders nothing. So the new kinds
  are **strict**, and `null` → code block. The Phase 22 kinds stay lenient and unchanged.
  `parseDiagram` has no callers outside `markdown.ts`.
- **Two small additions to the `pipeline` DSL beyond the prompt's list**, both to make the deck and
  the visualization read as one system:
  - `accent`: the teal "final product" treatment Phase 12 gives `app`.
  - **Dimming of everything off a highlighted path.** It echoes the viz's idle opacity, and it's what
    makes "the rest is reused" visible on slide 16.
- **`highlight` may be set on several nodes**, which is how the incremental-rebuild *path* is drawn.
  The prompt describes one node plus its outgoing edges, and that's still the single-node case.
- **The `symbol-table` failed-edge syntax `-x` and the unresolved marker `!`** are my design. The
  prompt left the DSL open, and these are documented.
- **The link-order failing command is `cc -L. -lshapes main.o -o app`, not `cc -lshapes main.o`.**
  Without `-L.` the real error would be `cannot find -lshapes`, a different failure. The `-L.` keeps
  the slide about order.
- **Slide 9 draws `printf` resolving to `libc.so.6`, and says it isn't copied in.** The prompt says
  "printf resolving to libc, with the copy-into-executable point made explicitly". Saying `printf` is
  copied too would be false on a default system. Slide 15 ties this back to shared libraries.
- **No `pipeline`/`symbol-table` diagram for the archive index.** Slide 7 already draws the archive as
  a container (the prompt's "pipeline *or* symbol-table" diagram for item 6). Slide 8 shows the index
  as real `nm -s` output. That's more honest than inventing a "defines" section for an index, which
  doesn't define anything.
- **The link-order diagrams are simplified on purpose.** They show only the two `libshapes` symbols
  and treat `libshapes.a` as one box. Slides 9 and 11 show the full need list.
- **Not a deviation, but the decision log:** partway through, the operator asked about adding
  Mermaid, and chose to keep this phase as specced and do Mermaid as its own phase. A Phase 27 prompt
  has been drafted separately; it isn't part of this branch.

## 6. Trace format / API notes

**No trace-format change.** The only shared-interface change is in the Markdown layer:

- `Diagram` gained two members (§2).
- `parseDiagram(lang, body): Diagram | null`, where `null` = malformed strict kind → code block.
- Diagram blocks still exist only in the theory/markdown layer; the trace engine never sees them.

## 7. Known issues / follow-ups

- ~~GNU text and link order desk-checked only~~: **closed**. Executed in Ubuntu 22.04 (§4.2).
- Text widths are *estimated* from character counts, the same approach Phase 22 used. That's fine for
  JetBrains Mono, but a very long sans caption could get clipped. None in the deck are.
- `pipeline` layout is columns only. Edges that go backwards (target stage ≤ source stage) render, but
  not well, and no deck needs them. `symbol-table` edges between non-adjacent columns would cross the
  boxes in between, so keep needs and defines in adjacent columns (the docs say so).
- The build's "chunks > 500 kB" warning is **pre-existing**: `main` builds a 696.67 kB index chunk.
  This branch is 712.41 kB (+15.7 kB min / +4.4 kB gzip, mostly the longer deck).

## 8. File map

```
docs/THEORY_AUTHORING.md                              (changed — pipeline + symbol-table DSLs)
src/engine/markdown.ts                                (changed — types, two strict parsers, null fallback)
src/engine/markdown.test.ts                           (changed — 18 new parser tests)
src/components/Diagram.tsx                            (changed — two new renderers; Phase 22 ones untouched)
src/components/Diagram.test.tsx                       (new — baseline snapshots + 5 renderer tests)
src/components/__snapshots__/Diagram.test.tsx.snap    (new — Phase 22 kinds, recorded pre-change)
src/content/se200/static-libraries/theory.md          (changed — 10 → 20 slides)
src/content/se200/static-libraries/theory.test.ts     (new — this phase's acceptance, pinned)
prompts/phase-26-static-libraries-theory.md           (added — the phase prompt)
reports/phase-26-static-libraries-theory.md           (added — this file)
reports/assets/phase26-*.png                          (added — 7 verification screenshots)
```
