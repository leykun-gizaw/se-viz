# Phase 22 Report — Recursion Deep-Dive: diagrams + expanded theory + more visualizations

## 1. Summary

Recursion now gets the deepest treatment. This phase (A) adds a **reusable, in-house SVG diagram
block** to the Markdown/slide engine — declarative fenced blocks parsed to a typed spec and rendered
to **SVG with the design tokens** (no Mermaid, no heavy rendering framework, no raw HTML); (B)
**expands the Recursion theory deck** to 21 slides with those diagrams and more concepts/examples; and
(C) adds **three new recursion visualization modules**. The only new dependency is **`d3-hierarchy`**,
a headless layout-only module used for `call-tree` node coordinates (it returns x/y; we draw the SVG).
`typecheck`/`lint`/`test` (167)/`build` all pass; no `any`; all existing content, `validateTrace`, and
`theory.test` are unaffected.

Branch: `phase-22-recursion-deep-dive`, cut from `main`.

## 2. What I built

### A — the diagram capability (reusable engine work)

- **Parser** (`src/engine/markdown.ts`): a fenced block whose info-string is in `DIAGRAM_LANGS`
  (`call-stack`, `call-tree`) is parsed by `parseDiagram(lang, body)` into a typed `Diagram` (a new
  `Block` variant `{ type: 'diagram'; diagram }`) instead of a code block. Extensible: add a `kind`,
  a `parseDiagram` case, and a renderer case. (The `FENCE` regex now allows hyphens in info-strings.)
- **Renderer** (`src/components/Diagram.tsx`): `DiagramView` dispatches on `diagram.kind` and renders
  **`<svg>` with `var(--se-*)` tokens** — never raw HTML. `call-stack` is hand-laid stacked rounded
  rects (no library); `call-tree` positions nodes with **`d3-hierarchy`** (`hierarchy()` + `tree()`,
  headless) and draws nodes/edges itself. Wired into `Markdown.tsx`'s `BlockView` (`case 'diagram'`).
- **Tests** (`markdown.test.ts`): parser unit tests for `call-stack` (caption, fields, `active`) and
  `call-tree` (indentation nesting + `*` repeat marking).
- **Docs**: a "Diagrams (Phase 22)" section in `docs/THEORY_AUTHORING.md` (syntax + both types).

**The diagram block syntax (the reusable contract):**

- **`call-stack`** — one frame per line, top→bottom (outermost first, deepest last). Pipe-separated:
  `LABEL | field | field | active`. `active` (any position) → amber "current frame" highlight; other
  parts are field lines. An optional `caption:` line adds a caption.
- **`call-tree`** — **indentation = parent→child** (2 spaces/level; first line is the root). A trailing
  ` *` marks a **repeated subproblem** (amber). Optional `caption:` line. Laid out by `d3-hierarchy`.

### B — expanded Recursion deck (`se200/recursion/theory.md`, now 21 slides)

Kept the existing good slides; added: **Thinking recursively** (the 3-question method + leap of faith);
**The call stack, drawn** (`call-stack` of `factorial(4)` at its deepest, `factorial(1)` active);
**Unwinding, drawn** (`call-stack` of the mid-unwind); **Tree recursion** (fib code) and **Tree
recursion, drawn** (`call-tree` of `fib(4)` with both `fib(2)` highlighted → why naïve fib is
exponential); **More examples**: `power(b,e)`, `gcd(a,b)` (Euclid), `sum_digits(n)` — each with C + the
recurrence; **Tail recursion** and **Mutual recursion** (brief callouts); and an expanded **See it run**
naming the new modules.

### C — new recursion viz modules (existing trace format, auto-discovered, SE 200 · Recursion)

- `power.ts` — `power(b, e)` linear recursion, multiply on unwind (`order: 84`).
- `gcd.ts` — `gcd(a, b)` Euclid, a tail call (answer rides up unchanged) (`order: 85`).
- `sumDigits.ts` — `sum_digits(n)`, peel a digit per call, add on unwind (`order: 86`).

Each uses distinct frame ids per activation, the base-case `condition` chip, pending-return
expressions that resolve on unwind, an `idea` coach note, and `stdout` — matching `factorial` quality.

## 3. Acceptance criteria — self-assessment

- [x] **1. gates pass; no `any` w/o justification; no Mermaid/heavy dep, no raw HTML; existing
  content/tests/`validateTrace`/`theory.test` unaffected.** typecheck/lint/test (167)/build green. Only
  new dep is headless `d3-hierarchy` (+ types). No `dangerouslySetInnerHTML`. No `any`. Catalog
  `validateTrace` and `theory.test` pass over everything (167 = prior 152 + 3 new traces×~2 +
  diagram-parser tests + module deck).
- [x] **2. Markdown engine renders a declarative diagram block to SVG with tokens (native, scales),
  ≥ `call-stack` + `call-tree`; parser unit-tested; syntax documented.** Verified in-browser: both
  render as crisp SVG that scales on the 16:9 slide; parser tests added; documented in
  `docs/THEORY_AUTHORING.md`.
- [x] **3. Deck expanded with more concepts/examples and uses the diagrams — incl. a `call-stack` of
  `factorial(4)` and a `call-tree` of `fib(4)` with repeated subproblems highlighted; slides within
  budget.** 21 slides; verified the factorial call-stack (amber active base frame) and the fib(4)
  call-tree (both `fib(2)` amber) render at large slide type.
- [x] **4. 2–4 new viz modules, correct, auto-discovered, pin under SE 200 · Recursion, named in the
  closing slide.** Three modules (power/gcd/sum_digits); verified the topic shows 7 modules and the
  power deck steps correctly; named in "See it run". Values checked in §4.
- [x] **5. Diagrams and worked examples accurate; deck and `theory.test`/`validateTrace` pass.** §4.

## 4. How I verified the C / values / diagrams

Hand-traced every value and cross-checked the arithmetic:

- **power(2, 3) = 8** — 2·2·2·1. Frames `power(2,3→0)`; pending `2 * power(2, e-1)`; unwind
  1→2→4→8. (`2^3 = 8`.) ✓ Verified in-browser at the base case.
- **gcd(48, 36) = 12** — `48 % 36 = 12` → `gcd(36, 12)`; `36 % 12 = 0` → `gcd(12, 0)` → base returns
  `a = 12`; 12 propagates up unchanged (tail position). `gcd(48,36) = 12` ✓ (48 = 4·12, 36 = 3·12).
- **sum_digits(135) = 9** — `135%10=5, 135/10=13`; `13%10=3, 13/10=1`; `1%10=1, 1/10=0`; base 0;
  unwind `1+0=1`, `3+1=4`, `5+4=9`. `1+3+5 = 9` ✓.
- **`call-stack` factorial(4)** — frames main / factorial(4..1) with pending `4*factorial(3)`,
  `3*factorial(2)`, `2*factorial(1)`, and `factorial(1)` = base (active). Matches the `factorial`
  module exactly.
- **`call-tree` fib(4)** — `fib(4)=fib(3)+fib(2)`; `fib(3)=fib(2)+fib(1)`; each `fib(2)=fib(1)+fib(0)`.
  Both `fib(2)` activations marked repeat (amber) — the duplicated subproblem. (`fib(4) = 3`.) Matches
  the existing `fibonacci` module's DFS activation order.

All three new traces pass `validateTrace` (catalog test). The two diagrams were verified visually in
both diagram slides (screenshots taken during the run).

## 5. Key decisions & deviations

- **Module choice: power, gcd, sum_digits (not Tower of Hanoi).** The prompt's "strong choices" listed
  Hanoi; I chose three linear/tail recursions I could make **verifiably correct** at factorial quality
  within the existing trace format. Hanoi's full n=3 call tree (15 activations + 7 moves, with peg
  state) is long and error-prone to model faithfully as stack frames; tree recursion is already
  covered visually by the **fib `call-tree` diagram** and the existing `fibonacci` module. This stays
  within "2–4 new modules" and prioritizes correctness. (Hanoi remains a good future addition.)
- **`d3-hierarchy` added** — explicitly allowed by the prompt as a headless, layout-only helper for
  `call-tree`. `call-stack` uses **no** library. No rendering framework was added.
- **Caption width** — the SVG viewBox is widened to fit a long caption (and the frames/tree are
  centred within it) so captions never clip; found and fixed during in-browser verification.
- **Diagram lives in the markdown/theory layer only** — viz modules use the unchanged trace format; no
  trace-format reshape.

## 6. Trace format / API notes

**No trace-format change.** New, additive engine surface:

- `markdown.ts`: `Diagram` (`{ kind: 'call-stack' | 'call-tree'; … }`), `CallStackFrame`,
  `CallTreeNode`, a `Block` variant `{ type: 'diagram'; diagram: Diagram }`, `DIAGRAM_LANGS`, and
  `parseDiagram(lang, body)`. The `FENCE` info-string regex now allows `-`.
- `Diagram.tsx`: `DiagramView` (SVG renderer). Extend a diagram type by adding a `kind` +
  `parseDiagram` case + `DiagramView` case.
- New dependency: `d3-hierarchy` (+ `@types/d3-hierarchy`), headless layout only.
- Theory docs, `theory.ts`, the trace format, and `validateTrace` are unchanged.

## 7. Known issues / follow-ups

- **Tower of Hanoi** is a natural next viz module (call tree + peg moves) — deferred (see §5).
- The diagram engine supports `call-stack` and `call-tree`; the registry is ready for future types
  (e.g. a linked-list or pointer diagram for other topics).
- `call-stack` frame width is estimated from the longest line (monospace) — fine for short authored
  fields (slide budget); very long field strings should be kept short by authors.

## 8. File map

```
src/engine/
  markdown.ts            # + Diagram types, parseDiagram (call-stack/call-tree), DIAGRAM_LANGS; FENCE allows '-'
  markdown.test.ts       # + diagram parser tests
src/components/
  Diagram.tsx            # NEW — SVG renderer (call-stack hand-laid; call-tree via d3-hierarchy)
  Markdown.tsx           # + case 'diagram' → <DiagramView>
src/content/se200/recursion/
  theory.md              # expanded to 21 slides (diagrams + more concepts/examples)
  power.ts               # NEW — power(2,3)=8
  gcd.ts                 # NEW — gcd(48,36)=12 (tail recursion)
  sumDigits.ts           # NEW — sum_digits(135)=9
docs/THEORY_AUTHORING.md # + "Diagrams (Phase 22)" section
package.json             # + d3-hierarchy, @types/d3-hierarchy
reports/phase-22-recursion-deep-dive.md   # this file
```
