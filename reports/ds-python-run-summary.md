# ds-python unattended run — summary

- Date: 2026-10-17
- Starting `main` commit: `688555a` (Merge static-libraries-code-examples …)
- Integration branch: `ds-python` (first commit `aa8aa37`: roadmap, phase 28–37 prompts, runner)
- Baseline main chunk on `ds-python` after setup: `index-*.js` = **717739 B** (`npm run build`)

| Phase | Branch | Result | Gates | Main chunk (bytes) | Deviations / notes |
|-------|--------|--------|-------|--------------------|--------------------|
| 28 Studio shell | `phase-28-studio-shell` | MERGED to ds-python | typecheck/lint/test (435)/build/bundle ✓ on branch and ds-python | 742443 (+24704 vs 717739; ~300 B under budget) | No design canvas available, layout follows the prompt text. Worked around a react-resizable-panels 4.11.2 crash when panels unmount (group remounts between player and non-player views). Top-bar scrub replaced by the timeline. No "authored beats" markers (no such field). Memory canvas narrower at default widths. See report §5. |
| 29 Pyodide tracer spike | `phase-29-pyodide-tracer-spike` | MERGED to ds-python | typecheck/lint/test (510)/build/bundle ✓ on branch and ds-python | 742443 (+0; Python code is dev-only) | Candidate **A (reuse the C model)** chosen: passes all 6 criteria (B fails #4, C loses tie-break). `pyodide@314.0.7` (published 2026-09-14) is the only new dep. check-bundle gained an additive "no Pyodide in main chunk" check. Added caps the prompt does not name (maxContainerItems 100, maxObjects 300, user-frame depth 200). Deep recursion makes ~4.3 MB of JSON; a bare `except:` can swallow the recorder stop (only the wall-clock kill ends it). See report §5/§7. |
