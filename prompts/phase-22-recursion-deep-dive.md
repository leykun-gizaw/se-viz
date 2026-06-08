# Phase 22 — Recursion Deep-Dive: diagrams + expanded theory + more visualizations — SOLO

## Why this phase exists
Recursion is the marquee concept and deserves the deepest treatment. This phase (1) adds a **reusable,
in-house diagram capability** to the theory slide deck — specifically diagrams that show **how the
call stack looks during recursion** — then (2) **expands the Recursion theory deck** with more
concepts, more examples, and those diagrams, and (3) **adds more recursion visualization modules**.

This is a **solo** phase: it touches the Markdown/slide engine (the diagram capability) and the
recursion content. Depends on Phase 20 (slide decks) and the Phase 21 recursion theory being on
`main`.

## The diagram decision (already made — do NOT use Mermaid)
Do **not** add Mermaid or any heavy diagram library (React Flow, JointJS, etc.). Reasons: Mermaid is
~2.8 MB, renders via `dangerouslySetInnerHTML` (SVG injection, sanitization/XSS caveats), and would
break this app's deliberate **dependency-free, no-raw-HTML, safe-by-construction** Markdown engine —
and it can't match the design tokens or draw a "stack of frames" cleanly.

Instead, build a **small, purpose-built declarative SVG diagram block** inside the existing Markdown/
slide renderer, styled with the existing design tokens, consistent with the memory renderer's visual
language (frame boxes, arrows, the anchor system). Authored as a fenced block in the theory markdown
(e.g. a tiny typed DSL ```` ```call-stack ```` / ```` ```call-tree ````), parsed by the Markdown
engine and rendered to **React/SVG** (never an HTML string). Keep it typed, safe (no raw HTML), and
reusable for other topics (linked lists, trees) later.

**Layout helper is allowed (rendering framework is not).** For the **`call-tree`** node positioning,
use **`d3-hierarchy`** (`hierarchy()` + `tree()`) — a small, **headless, layout-only** module: it
returns x/y coordinates and never touches the DOM, so you still render the SVG yourself with the
design tokens. (If node widths vary, `d3-flextree` is the variable-size variant.) The **`call-stack`**
diagram needs **no** library — it's just stacked rectangles. Do not pull in a rendering framework
(Mermaid/React Flow/JointJS) — only the headless layout math.

## Context to read
- `src/engine/markdown.ts` (+ test), `src/components/{Markdown,TheoryDeck}.tsx`,
  `src/components/memory/{ArrowOverlay,StackFrame,MemoryCanvas}.tsx` (the existing SVG/box/arrow
  visual language + tokens to match), `src/engine/anchors*.ts`, `src/index.css` (tokens).
- `docs/THEORY_AUTHORING.md`, `docs/CONTENT_AUTHORING.md`, `docs/CURRICULUM.md`.
- `src/content/se200/recursion/{factorial,sumTo,reverseString,fibonacci}.ts` (existing viz modules)
  and `src/content/se200/recursion/theory.md` (the deck to expand).

## Hard constraints
- Frontend only, TS strict, no `any` without justification. `typecheck`/`lint`/`test`/`build` pass.
- **No Mermaid / no heavy diagram *rendering* framework** (React Flow, JointJS, etc.). A small
  **headless layout** helper (`d3-hierarchy`, optionally `d3-flextree`) is acceptable for tree
  positioning only — it returns coordinates; you render the SVG yourself from the design tokens. No
  raw HTML / `dangerouslySetInnerHTML`. No restyle of the design system. No trace-format reshape — viz
  modules use the existing trace format; the diagram block lives in the theory/markdown layer only.
- All existing modules/traces, theory docs, `validateTrace`, and `theory.test` still pass.

## Part A — the diagram capability (reusable engine work)
- Add a **fenced diagram block** to the Markdown engine + renderer. At minimum two diagram types for
  recursion:
  - **`call-stack`** — a vertical stack of frame boxes (newest at the bottom, matching the memory
    view), each with a label (`factorial(3)`) and optional fields (`n = 3`, `return = 3 * …`),
    an optional **active** frame highlight, and an optional caption (e.g. "deepest point" / "unwinding").
  - **`call-tree`** — a node/edge tree of calls (for `fib`), able to **mark repeated subproblems**
    (e.g. `fib(2)` appearing twice) so the "why naïve fib is slow" point is visual.
- Author them as a small **typed DSL** (text in the fenced block) — your design, but keep it minimal,
  documented, and parsed safely to a typed structure, then rendered with **SVG + design tokens** so it
  looks native and scales on the 16:9 slide.
- Make it **extensible** (a registry/switch on diagram type) so future topics can add types without
  reworking the engine. Add unit tests for the parser.
- Document the diagram block (syntax + the available types) in `docs/THEORY_AUTHORING.md`.

## Part B — expand the Recursion theory deck
Grow `se200/recursion/theory.md` with more concepts, examples, and the new diagrams, keeping the slide
budget (one idea per slide, large type, fits 16:9). Add/expand slides such as:
- **The call stack, drawn** — a `call-stack` diagram of `factorial(4)` at its deepest point.
- **Unwinding, drawn** — a `call-stack` (or sequence) diagram of the returns combining back up.
- **Tree recursion** — a `call-tree` diagram of `fib(4)` with the **repeated `fib(2)`** highlighted;
  motivate why naïve fib is exponential.
- **More worked examples** — e.g. `power(b, e)`, `gcd(a, b)` (Euclid), sum of digits — each a tight
  slide with correct C and the recurrence.
- **Thinking recursively** — the "leap of faith" (trust the smaller call), choosing the base case.
- **Tail recursion** (brief) and **mutual recursion** (brief, optional).
- Keep the existing good slides; this is additive depth, not a rewrite. End with the expanded
  "see it run" naming the new viz modules.

## Part C — more recursion visualizations
Add **2–4 new recursion trace modules** under `src/content/se200/recursion/` (existing trace format,
auto-discovered, `course: 'SE 200'`, `topic: 'Recursion'`), each verifiably correct. Strong choices:
- **`power(b, e)`** — linear recursion, multiply on unwind.
- **`gcd(a, b)`** (Euclid) — `gcd(a,b) = gcd(b, a % b)`, base `b == 0`.
- **Tower of Hanoi (n = 3)** — an excellent recursion visualization (the call tree + the moves); model
  the frames and the printed moves.
- **`sumDigits(n)`** or a recursive **binary search** — optional.
Use distinct frame ids per activation, the base-case `condition` chip, pending-return expressions that
resolve and pulse on unwind (match the existing `factorial` quality). Verify every value by hand +
throwaway calc.

## Acceptance criteria
1. `typecheck`/`lint`/`test`/`build` pass; no `any` w/o justification; **no Mermaid/heavy dep, no raw
   HTML**; all existing content/tests/`validateTrace`/`theory.test` unaffected.
2. The Markdown engine renders a **declarative diagram block** to SVG with design tokens (native look,
   scales on the slide), with at least **`call-stack`** and **`call-tree`** types; parser unit-tested;
   syntax documented in `docs/THEORY_AUTHORING.md`.
3. The Recursion deck is **expanded** with more concepts/examples and uses the diagrams — including a
   `call-stack` of `factorial(4)` and a `call-tree` of `fib(4)` with repeated subproblems highlighted;
   slides stay within the per-slide budget at large type.
4. **2–4 new recursion viz modules** exist, are correct (report §4 shows the checks), auto-discovered,
   pin under SE 200 · Recursion, and are named in the deck's closing slide.
5. Diagrams and all worked examples are accurate; the deck and `theory.test`/`validateTrace` pass.

## When done
Write `reports/phase-22-recursion-deep-dive.md` from the template. In §2/§3 document the diagram block
syntax + types (the reusable contract) and list the new slides + viz modules; in §4 show how you
verified the C/values and the diagrams; in §5 flag deviations. Do not start another phase.
