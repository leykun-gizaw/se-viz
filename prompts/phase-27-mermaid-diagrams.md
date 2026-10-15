# Phase 27 — Mermaid as a general-purpose diagram block (lazy, strict, token-themed) — SOLO

## Why this phase exists
The in-house diagram kinds (`call-stack`, `call-tree` from Phase 22; `pipeline`, `symbol-table` from
Phase 26) are purpose-built: each draws one teaching story precisely, in the memory view's visual
language. They are the wrong tool for the long tail — a quick flowchart of a decision, a state machine
for a queue, a sequence diagram of `fork`/`wait`, an ER sketch. Authors should be able to drop a
` ```mermaid ` fence into a theory deck and get a native-looking diagram, without an engine phase per
picture.

## This reverses part of the Phase 22 decision — on purpose, and narrowly
Phase 22 rejected Mermaid as the diagram engine because it is large (~2.8 MB unpacked, the largest
dependency the app would carry), returns an **SVG string** that has to be injected into the DOM
(at odds with the "never raw HTML" Markdown engine), and cannot use the design tokens directly. Those
reasons still hold for the **teaching diagrams**, which stay in-house. This phase adds Mermaid as an
**additional, opt-in block** and contains each cost:

| Phase 22 objection | How this phase contains it |
| --- | --- |
| Bundle weight | `import('mermaid')` **only** inside the renderer → its own chunk, fetched the first time a slide with a ` ```mermaid ` block mounts. The main `index-*.js` chunk must not grow by more than ~3 kB. |
| SVG-string injection / XSS | `securityLevel: 'strict'` (Mermaid sanitizes labels with DOMPurify, no click handlers, no HTML labels). Insert via `DOMParser` → `replaceChildren` on a ref'd container — **no `dangerouslySetInnerHTML`**. Input is repo-authored Markdown only; no user-supplied Mermaid anywhere (Live Coding never renders it). |
| Can't use the tokens | `theme: 'base'` with `themeVariables` **read from the computed `--se-*` tokens at render time**, and a re-render when `data-theme` on `<html>` changes (see `src/hooks/useTheme.ts`). |

## Context to read
- `src/engine/markdown.ts` (+ test) — `Diagram`, `parseDiagram`, `DIAGRAM_LANGS`, the strict
  fallback added in Phase 26 (`parseDiagram` returns `null` → plain code block).
- `src/components/Diagram.tsx` (+ `Diagram.test.tsx` and its snapshots) — the existing renderers.
- `src/components/TheoryDeck.tsx` — the 1280×720 slide canvas, presentation mode, scaling.
- `src/hooks/useTheme.ts`, `src/index.css` — theme switching and tokens.
- `docs/THEORY_AUTHORING.md` — where the authoring guidance goes.
- `reports/phase-22-recursion-deep-dive.md`, `reports/phase-26-static-libraries-theory.md`.

## Hard constraints
- Frontend only, TS strict, no `any` without justification. `typecheck`/`lint`/`test`/`build` pass.
- **Exactly one new dependency: `mermaid`, pinned to an exact version at least two weeks old** (check
  `npm view mermaid time`). No React wrapper packages.
- No `dangerouslySetInnerHTML`. No `securityLevel` other than `'strict'`. No `htmlLabels`.
- The four in-house kinds render **byte-identically** (the Phase 26 snapshots must pass untouched).
- No trace-format change. Mermaid lives in the theory/markdown layer only.
- No existing deck is rewritten to use Mermaid. Do **not** replace any in-house diagram.

## What to build
1. **Parser:** ` ```mermaid ` → `{ kind: 'mermaid'; source: string; caption: string | null }` (an
   optional first-line `%% caption: …` comment becomes the caption). Parsing does no Mermaid work —
   the engine stays dependency-free and synchronous.
2. **Renderer (`MermaidDiagram`):** lazily imports Mermaid, initializes once
   (`startOnLoad: false`, `securityLevel: 'strict'`, `theme: 'base'`, token-derived `themeVariables`,
   the app's fonts), calls `mermaid.render(uniqueId, source)`, and mounts the SVG via `DOMParser`.
   - Reserve space while loading (no layout jump on the slide); show the source as a code block if the
     import fails or `mermaid.parse` rejects the source, plus a `console.warn` naming the slide.
   - Re-render on theme change. Unique IDs per instance (two diagrams on one slide must not collide).
   - Scale like the other diagrams: `w-full`, height auto, centred, legible on the 16:9 slide and in
     presentation mode.
3. **Exemplars:** add **one or two** Mermaid diagrams where an in-house kind doesn't fit — e.g. a
   `stateDiagram-v2` for a queue's empty/non-empty/full states in an SE 201 deck, or a `flowchart`
   for the debugging triage in SE 200. One idea per slide, within the slide budget.
4. **Docs:** a "When to use which diagram" section in `docs/THEORY_AUTHORING.md` — in-house kinds for
   the core teaching pictures (memory, calls, builds, symbols), Mermaid for everything else — plus the
   supported subset (flowchart, sequence, state, class, ER) and the strict-mode limits (no HTML labels,
   no click callbacks).

## Tests
- Parser: a ` ```mermaid ` fence becomes a `mermaid` diagram with its source and caption; it never
  falls back at parse time.
- Renderer (node env, Mermaid mocked): the lazy import happens only when a Mermaid block renders;
  `mermaid.parse` rejection → code-block fallback; theme change triggers a re-render; IDs are unique.
- A build check (script or test) that Mermaid lands in its own chunk and the main chunk grows ≤ ~3 kB.
- Existing snapshots and all prior tests pass unchanged.

## Acceptance criteria
1. Gates pass; `mermaid` is the only new dependency, exactly pinned; no `dangerouslySetInnerHTML`;
   `securityLevel: 'strict'`.
2. Mermaid is code-split: decks without a Mermaid block never download it (verify in the browser's
   network panel); main-chunk growth ≤ ~3 kB, reported with before/after numbers.
3. A ` ```mermaid ` block renders token-themed in **both themes** and switches live with the theme;
   invalid Mermaid falls back to a visible code block.
4. In-house diagram kinds are byte-identical; no in-house diagram was replaced.
5. 1–2 exemplar Mermaid slides exist, fit the 16:9 budget, and are legible in presentation mode.
6. `docs/THEORY_AUTHORING.md` explains when to use Mermaid vs the in-house kinds.

## When done
Write `reports/phase-27-mermaid-diagrams.md` from the template — include the bundle before/after,
the exact Mermaid version and why, and screenshots in both themes. Work on branch
`phase-27-mermaid-diagrams`. **Stop without merging.**
