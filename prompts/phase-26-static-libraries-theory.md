# Phase 26 — Static Libraries theory deep-dive: build diagrams + expanded deck — SOLO

## Why this phase exists
The Static Libraries theory deck (`src/content/se200/static-libraries/theory.md`) is 10 slides and
its only visuals are ASCII art inside code fences. The topic is inherently visual — files flowing
through tools, symbols resolving across files — and we already proved the pattern in Phase 22:
extend the in-house diagram engine, then expand the deck with real SVG diagrams. This phase does the
same for the build pipeline: (1) add **two new diagram kinds** to the Phase 22 diagram block, then
(2) **expand the Static Libraries deck** with more steps, each one visual.

This is a **solo** phase: it touches the Markdown/slide engine (new diagram kinds) and the static
libraries content. Depends on Phases 20/21/22 being on `main` (they are).

## The diagram decision (already made in Phase 22 — do NOT revisit)
No Mermaid, no rendering frameworks, no raw HTML / `dangerouslySetInnerHTML`. Extend the existing
declarative fenced-block system: add a `kind` to `Diagram` in `src/engine/markdown.ts`, a parser
case in `parseDiagram` + `DIAGRAM_LANGS`, and a renderer case in `src/components/Diagram.tsx`,
rendered as **React/SVG with the design tokens**. Both new kinds are staged/columnar layouts —
**no layout library is needed** (d3-hierarchy stays tree-only).

## Context to read
- `src/engine/markdown.ts` (+ test) — the `Diagram` union, `parseDiagram`, `DIAGRAM_LANGS`.
- `src/components/Diagram.tsx` — the two existing renderers; match their token usage and scaling.
- `src/content/se200/static-libraries/theory.md` — the deck to expand (10 slides today).
- `src/content/se200/static-libraries/buildPipeline.ts` — the Phase 12 pipeline viz; the new
  `pipeline` diagram should echo its visual language (artifact vs process nodes, stages) so the
  deck and the visualization read as one system.
- `docs/THEORY_AUTHORING.md` (document the new syntax here), `docs/CURRICULUM.md` (SE 200 week 6).

## Hard constraints
- Frontend only, TS strict, no `any` without justification. `typecheck`/`lint`/`test`/`build` pass.
- No new dependencies. No raw HTML. No restyle of the design system. No trace-format changes.
- All existing modules/traces, theory decks, `validateTrace`, `theory.test`, and the Phase 22
  diagram tests still pass. The two existing diagram kinds render byte-identically.

## Part A — two new diagram kinds (reusable engine work)

**`pipeline`** — a left-to-right staged flow for build stories:
- Nodes declared one per line with a tiny DSL (your design, consistent with `call-stack`'s):
  an id, a kind (`artifact` | `process`), a label (`main.c`, `cc -c`), an optional sublabel
  (`source`, `compile`), and a stage number controlling the column.
- Edges as `a -> b` lines. Optional `caption:` line like the existing kinds.
- Optional per-node `highlight` marker (one accent-colored node + its outgoing edges) so a slide
  can say "only THIS file recompiles".
- Rendered: artifacts as rounded file-boxes, processes as distinct (e.g. pill/hexagon) shapes,
  columns evenly staged, orthogonal or gently curved edges with arrowheads, all from design tokens.

**`symbol-table`** — files as boxes with their symbol tables, for the linking story:
- Each box: a file name (`main.o`, `libshapes.a(circle.o)`) with two labeled sections —
  **defines** (list of symbols) and **needs** (list of symbols).
- Resolve edges from a `needs` entry in one box to a `defines` entry in another (`main.o:area_circle -> circle.o:area_circle` or similar — your DSL, kept minimal and documented).
- An optional `unresolved` marker on a `needs` entry (rendered in the danger/warn token) so the
  "undefined reference" slide shows exactly which symbol never found a home.
- Rendered as side-by-side boxes with the mono font for symbols, arrows between entries.

Both: parsed safely to typed structures, parser unit tests (including malformed input falling back
to a plain code block, matching Phase 22 behavior), syntax documented in `docs/THEORY_AUTHORING.md`.

## Part B — expand the Static Libraries deck
Grow `se200/static-libraries/theory.md` from 10 to **~18–22 slides**, replacing every ASCII diagram
with a real diagram and adding the missing middle of the story. One idea per slide, large type,
fits the 16:9 budget. The deck should now cover, in order:
1. Why this matters (keep, tighten).
2. Separate compilation — **`pipeline` diagram** of three `.c` files compiling to three `.o`.
3. **What is inside a `.o`** — NEW: machine code + a symbol table; **`symbol-table` diagram** of
   `main.o` (defines `main`, needs `area_circle`, `area_square`, `printf`).
4. Unresolved symbols are normal — NEW: a `.o` is allowed to have holes; that is the linker's job.
5. The full build pipeline — **`pipeline` diagram** `.c → .o → .a → app` (replaces the ASCII art).
6. Archiving with `ar` — keep the command; add a **`pipeline` or `symbol-table` diagram** of the
   archive as a container of members with an index.
7. The archive index — NEW (brief): how `ar s`/`ranlib` lets the linker find members by symbol.
8. Linking, drawn — **`symbol-table` diagram**: `main.o` needs resolving into the archive members'
   defines, `printf` resolving to libc, with the copy-into-executable point made explicitly.
9. "undefined reference", drawn — NEW: same diagram with one `needs` entry marked `unresolved`
   (e.g. `area_triangle` — nobody defines it); connect the error message students actually see to
   the picture.
10. Link order — NEW, drawn: the linker scans left to right; `cc main.o -lshapes` works,
    `cc -lshapes main.o` does not; show both orders with the second's resolve edge failing.
11. Header vs library — keep, but drawn: `.h` declares (compile-time), `.a` defines (link-time).
12. Why "static" + static vs dynamic — keep the trade-offs; a small two-column comparison.
13. Incremental rebuild — NEW, drawn: change `circle.c`, **highlighted** path recompiles, the rest
    of the pipeline reuses existing artifacts.
14. Common pitfalls (keep the callout; it can now reference the slides that drew each trap).
15. Commands recap — NEW: the four commands (`cc -c`, `ar rcs`, `ar t`, `cc … -L. -lshapes`) on one
    slide, each mapped to its pipeline stage.
16. Recap + See it run (keep; still points at the Build pipeline visualization).
The list is the required coverage, not a rigid slide count — split or merge where the 16:9 budget
demands, but every NEW item above must exist and every ASCII diagram must be gone.
All commands and symbol names must be real and consistent: this deck's example program is
`main.c` + `circle.c` + `square.c` → `libshapes.a` → `app`, same as the Phase 12 visualization.

## Acceptance criteria
1. `typecheck`/`lint`/`test`/`build` pass; no new deps; no raw HTML; existing diagram kinds,
   decks, traces, `validateTrace`, `theory.test` unaffected.
2. The engine parses and renders **`pipeline`** and **`symbol-table`** fenced diagram blocks to
   token-styled SVG; parsers unit-tested (valid + malformed); syntax documented in
   `docs/THEORY_AUTHORING.md`.
3. The Static Libraries deck has **~18–22 slides**, contains **zero ASCII-art diagrams**, uses the
   new diagram kinds at least **6 times** total, and covers every NEW item in Part B — including
   the undefined-reference slide (an `unresolved` symbol rendered in the warn/danger style) and the
   link-order slide (both orders shown, one failing).
4. Every command, symbol name, and error message in the deck is real and internally consistent
   with the `main.c`/`circle.c`/`square.c` → `libshapes.a` → `app` example.
5. Diagrams are legible at slide scale in both themes (dark primary) and in presentation mode.

## When done
Write `reports/phase-26-static-libraries-theory.md` from the template. In §2/§3 document the two
new diagram DSLs (the reusable contract) and list the new slides; in §4 say how you verified the
commands and symbol stories (a real `cc`/`ar`/`nm` session is ideal, a careful desk-check is
acceptable — say which); in §5 flag deviations. Work on branch `phase-26-static-libraries-theory`.
**Stop without merging.**
