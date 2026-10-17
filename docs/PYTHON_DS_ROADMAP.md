# Python mode and DS 200 / DS 210 roadmap

Status: planned 2026-10-17. Source of decisions: the "SE-Viz Python / DS 200-210 mode: decisions"
doc in the Frontier-work project, and the "SE-Viz Redesign Directions" design canvas (Direction A,
"Studio", dark and light).

## Goals
- Teach DS 200 (Intro to Programming and Python) and DS 210 (Applied Python for Data Scientists) with
  the same step-through, debugger-style player SE-Viz uses for SE 200 / SE 201.
- Presenter first (live sessions), learner self-serve second.
- One app: Python is a new mode inside SE-Viz, not a separate product.

## Fixed decisions
- **Execution:** Python runs in the browser through Pyodide (`sys.settrace` recorder in a Web Worker).
  No backend, no Docker, nothing new on the VPS. Hosting stays on Vercel.
- **No AI anywhere** in the app. No quiz or predict panel. Explanations are authored or derived from
  the trace.
- **No LMS.** No accounts, no progress tracking. The course map is navigation only.
- **Animation:** keep the snapshot trace engine (random access, step back, scrub). Motion comes from
  animating the diff between adjacent steps (Framer Motion), reversed on step back. Manim and Motion
  Canvas are out of scope for the player; they may be used later only to export clips.
- **Library scope for v1:** pure Python, NumPy, pandas, matplotlib, scipy. Each library view is its
  own phase so DS 200 content is not blocked.
- **Content source:** targeted Savanna click-through (Examples, Exercise, Assignment pages). Click
  through the UI only; never type or construct Savanna URLs. Downloads need Leykun's OK first.
- **Process:** the usual phase loop (prompt, branch, report, stop without merging), mirrored in the
  Zenith SE-Viz project.

## Phases (frontend repo)

| Phase | Name | Depends on | Summary |
|-------|------|-----------|---------|
| 28 | Studio shell | none | Direction A layout for the existing C modules: resizable and collapsible course map, step explanation panel, timeline with labeled events, both themes. |
| 29 | Pyodide tracer spike | none | Prove `sys.settrace` in Pyodide inside a worker: limits, stdout capture, object identity across steps, cost of loading NumPy and pandas. Decide the Python trace shape. No UI beyond a debug page. |
| 30 | Python trace contract and renderer | 29 | Additive trace types for Python (frames of names, an objects area for list, tuple, dict, set, instances, functions, reference arrows). Renderer in the Studio shell with diff motion. |
| 31 | Python live coding | 30 | Python editor (CodeMirror Python), Run, console for `print` and `input`, step and time limits, all in the browser. |
| 32 | Derived step explanations | 30 | Generate "what changed", "branch taken", "loop iteration", "previous" and "next" text from the trace so live code gets a useful explanation panel. Authored text always wins. |
| 33 | DS 200 content | 30, 32 | Curated modules for DS 200 Weeks 4 to 8 (variables, strings, lists, tuples, sets, dicts, conditionals, loops, functions, scope) using the course's digital farm storyline. Weeks 1 to 3 (flowcharts, pseudocode, Scratch) as concept views or theory decks. |
| 34 | NumPy view | 30 | ndarray view: shape, dtype, cells, views vs copies, broadcasting steps. |
| 35 | pandas view | 30, 34 | DataFrame and Series view: index, columns, filtered rows, groupby steps, changed cells. |
| 36 | matplotlib output | 31 | Capture figures from Pyodide and show them as step output. |
| 37 | Statistics concept views | 34 | Big O growth, search and sort, sampling distributions, hypothesis testing as concept views. |
| 38 | DS 210 content | 34 to 37 | Curated modules for DS 210 Weeks 1 to 6. |

Phases 28 and 29 do not touch each other and can run in parallel.

## Unattended run
`prompts/RUNNER-ds-python.md` runs Phases 28 to 32 and 34 to 37 in order on the `ds-python`
integration branch, with gates after every phase, and stops on the first unrecoverable failure. It
never touches `main`; Leykun reviews and merges `ds-python` once. Phases 33 and 38 are excluded until
the Savanna examples are extracted into the repo.
