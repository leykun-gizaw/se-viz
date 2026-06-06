# Phase 11 Report — Concept-View Model + View Renderers

## 1. Summary

Phase 11 adds the **capability** for the three non-memory screens (static-library build pipeline,
preprocessor before→after, dual-trace debugging) so Wave 2 (Phases 12–14) can author **data only**
with zero engine edits. It introduces an **additive `view` discriminator** on `Trace` plus three
optional per-step payloads, three data-driven renderers, a `Stage` switch, `validateTrace`
extensions, one validation fixture per view kind, and the authoring docs. The change is strictly
additive: a trace with no `view` (or `view: 'memory'`) renders and steps exactly as before — all
Phases 0–10 traces are untouched. All gates pass (typecheck, lint, test 68/6, build), no `any`, and
the three views were **browser-verified** to render with the shared chrome (breadcrumb, transport,
step counter, keyboard, presentation) working and no runtime console errors.

## 2. What I built

- **Trace format** (`src/engine/trace/types.ts`, additive): `Trace.view?: TraceView`
  (`'memory' | 'pipeline' | 'before-after' | 'dual-trace'`), `Trace.leftSource?`/`rightSource?` (for
  dual-trace), and `Step.pipeline?` / `Step.beforeAfter?` / `Step.dualTrace?` payloads, with the
  supporting interfaces (`PipelineNode`/`PipelineEdge`/`PipelineStep`, `BeforeAfterStep`,
  `DualColumn`/`DualColumnRow`/`DualTraceStep`).
- **Renderers** (`src/components/concept/`): `PipelineView.tsx` (artifact cards + dashed process
  boxes + azure edges, per-step idle/active/done state, accent on the final artifact),
  `BeforeAfterView.tsx` (two code panes bridged by a `cpp` process box, substituted lines in the
  value-changed green), `DualTraceView.tsx` (two columns with source + compact state table + output,
  a danger "diverges here" marker from the divergence step).
- **Stage switch** (`src/components/Stage.tsx`): renders the matching concept view for non-memory
  traces and the unchanged three-panel memory layout otherwise; the narration bar and all chrome
  (which live outside `Stage`) work for every view kind.
- **Validation** (`src/engine/trace/validate.ts` + 5 new tests in `validate.test.ts`): pipeline edges
  resolve to nodes; before/after highlight lines in range; dual-trace requires both sources and
  in-range column lines; every concept step carries its matching payload; `activeId` may resolve to a
  pipeline node.
- **Fixtures** (`src/content/fixtures/{buildPipeline,preprocessor,dualTrace}.ts`): one minimal,
  correct trace per view kind, auto-discovered into the "Engine fixtures → Concept views" group.
- **Docs**: `docs/TRACE_FORMAT.md` (new "Phase 11 additions — concept views" section with exact
  payload shapes + per-kind authoring convention) and `docs/CONTENT_AUTHORING.md` (concept-view note).

## 3. Acceptance criteria — self-assessment

- [x] **typecheck/lint/test/build pass; no `any`.** Green (typecheck, lint, test 68/6, build). No `any`.
- [x] **`view` is additive; omitting it = memory; Phases 0–10 render/step exactly as before.** `Stage`
  defaults `view` to `'memory'` and renders the original layout unchanged; all payload fields are
  optional; the full memory catalog still validates and renders (browser-checked the default memory
  trace loads as before).
- [x] **The three view kinds render data-driven and match screens 07/08/09; shared chrome works for
  all.** Browser-verified (§4): pipeline shows `.c → cc → .o → ar → .a → ld → ./app`; before-after
  shows the `#define` source, `cpp` box, and substituted translation unit; dual-trace shows buggy vs
  fixed columns with the divergence flagged. Breadcrumb, transport, step counter, scrubber all work.
- [x] **One correct fixture per view kind, auto-discovered.** `buildPipeline`/`preprocessor`/`dualTrace`
  appear in the sidebar under Engine fixtures → Concept views and validate.
- [x] **`validateTrace` covers the new payloads; catalog test passes over everything.** 5 targeted
  negative/positive tests + the catalog-wide run; 68 tests pass.
- [x] **Docs document each view kind precisely enough for Phases 12–14 to need zero engine edits.**
  `TRACE_FORMAT.md § Phase 11` gives the exact shapes + the "author data only" convention; the
  fixtures are the copy-from exemplars; `CONTENT_AUTHORING.md` points authors there.

## 4. How to run & verify

```
npm run typecheck && npm run lint && npm run test && npm run build   # all green (68 tests)
npm run dev    # workbench; sidebar → "Engine fixtures → Concept views"
```

**Browser verification performed** (Playwright against the dev server):
- Default memory trace still renders (baseline) — only console message is a benign `favicon.ico` 404.
- **Build pipeline**: node cards `util.c (source) → cc -c (compile) → util.o → ar → libutil.a → ld →
  ./app` with azure connectors; breadcrumb "SE 200 › Static Libraries › Makefile"; transport "Step 1/7".
- **Preprocessor**: left pane `#define MAX 100` / `#define SQ(x) ((x) * (x))` / `int cap = MAX;` /
  `int a = SQ(3 + 1);`, a dashed `cpp` box, right pane `int cap = 100;` — operators render literally
  (ligatures off).
- **Dual-trace**: columns "buggy (i <= 3)" and "fixed (i < 3)" each with source + `sum` row; stepping
  to step 5/7 shows **"diverges here"** on both columns and the divergence narration. Stepping
  advances the concept payload; no new console errors at any step.

## 5. Key decisions & deviations

- **`Stage` is the switch point (no separate `ConceptStage`).** `TopBar`/`Transport`/keyboard already
  live in `Workbench`/`PresentationMode` outside `Stage`, so they were view-agnostic already; making
  `Stage` switch its main area (keeping `NarrationBar`) was the minimal, lowest-risk change and meant
  **no edit to `App.tsx`/`PresentationMode.tsx`**. The prompt's "ConceptStage" is satisfied by this
  switch.
- **Pipeline edges drawn between adjacent declared nodes** (linear left→right) rather than a general
  SVG graph — the build pipeline is linear, so this keeps the renderer simple and the design clean.
  Documented: declare nodes in pipeline order. A branching pipeline would need an SVG-edge upgrade
  (flagged as a follow-up, not needed for screen 07).
- **Concept fixtures carry a curriculum breadcrumb on the trace** (`SE 200 · Static Libraries` /
  `Preprocessor` / `Debugging`, all real per CURRICULUM.md) but are **grouped under "Engine fixtures →
  Concept views"** via the `ContentModule` course/topic override — exactly the existing `pointerArith`
  fixture pattern. This satisfies the catalog test's "every module has a breadcrumb" check while
  keeping fixtures out of the curriculum buckets that Phases 12–14 will populate.
- **Highlights are line-based** (`beforeHighlights`/`afterHighlights`, `DualColumn.line`) rather than
  sub-line character spans — simpler to author and validate, and enough for the teaching signal.
  Authors can split a line if they need finer granularity.
- **Dual-trace divergence**: `diverged` is a per-step boolean true from the first divergent step
  onward; the marker therefore appears at and after the divergence point. The fixture's out-of-bounds
  read is modeled with an illustrative garbage value (99) and narrated as undefined behaviour.
- No restyle: every color is an existing token (`pointer`/azure edges, `heap`/teal accent,
  `active`/amber ring, `changed`/green substitution, `danger` divergence). Process boxes reuse the
  design's "dashed neutral" treatment.

## 6. Trace format / API notes — the contract Wave 2 depends on

`Trace.view?: 'memory' | 'pipeline' | 'before-after' | 'dual-trace'` (absent ⇒ `memory`). Per step,
the **one** payload matching the view:

```ts
// view: 'pipeline'
Step.pipeline = {
  nodes: { id; kind: 'artifact' | 'process'; label; sublabel?;
           state?: 'idle'|'active'|'done'; accent? }[];   // declare left→right; accent the final artifact
  edges: { from; to }[];                                   // node ids; connectors between adjacent joined nodes
};                                                         // Step.activeId may name the active node

// view: 'before-after'                                    // restate before/after every step
Step.beforeAfter = { before; after; beforeHighlights?: number[]; afterHighlights?: number[]; processLabel? };

// view: 'dual-trace'                                       // Trace.leftSource / Trace.rightSource hold the two programs
Step.dualTrace = {
  left:  { label; line?; rows: { name; value; changed? }[]; stdout? };
  right: { label; line?; rows: { name; value; changed? }[]; stdout? };
  diverged?: boolean;                                       // true from the first divergent step onward
};
```

For concept views set `source: ''`, `highlightedLines: []`, and leave `stack`/`heap` empty. Memory
traces are completely unaffected: omit `view` and all payloads. Full prose + exemplars in
`docs/TRACE_FORMAT.md § Phase 11 additions`.

## 7. Known issues / follow-ups

- **Pipeline renderer is linear** (adjacency connectors). A branching build graph (e.g. two sources
  feeding one linker) would need SVG edges; not required for screen 07 and deferred.
- **Before-after highlights are line-level**, not character spans — fine for the curriculum, but a
  future enhancement could highlight the exact substituted substring.
- The memory-only **Legend** toggle still shows in the workbench chrome for concept views (harmless;
  it just describes memory tokens). Phase 15 (polish) could make the legend view-aware.

## 8. File map

```
src/engine/trace/
  types.ts                      # + TraceView, Trace.view/leftSource/rightSource, Step payloads + interfaces
  validate.ts                   # + concept-view checks (edges, highlight ranges, payload presence)
  validate.test.ts              # + 5 concept-view validation tests
src/components/
  Stage.tsx                     # switch on trace.view (memory unchanged) + keep NarrationBar
  concept/
    PipelineView.tsx            # NEW — build-pipeline renderer
    BeforeAfterView.tsx         # NEW — preprocessor before→after renderer
    DualTraceView.tsx           # NEW — dual-trace debugging renderer
src/content/fixtures/
  buildPipeline.ts              # NEW — pipeline validation fixture (screen 07)
  preprocessor.ts               # NEW — before-after validation fixture (screen 08)
  dualTrace.ts                  # NEW — dual-trace validation fixture (screen 09)
docs/
  TRACE_FORMAT.md               # + "Phase 11 additions — concept views" (payload shapes + convention)
  CONTENT_AUTHORING.md          # + concept-view authoring note
reports/
  phase-11-concept-view-model.md  # this file
```
