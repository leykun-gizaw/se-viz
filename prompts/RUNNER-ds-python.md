# Runner: Python mode and DS phases, unattended, on the `ds-python` integration branch

You are running several SE-Viz phases back to back without a human watching. Leykun will review the
whole result once at the end. Your job is to finish as many phases as possible **correctly**, and to
stop cleanly when you can't.

## Scope and order
Run these phases in this order, one at a time:

1. `prompts/phase-28-studio-shell.md`
2. `prompts/phase-29-pyodide-tracer-spike.md`
3. `prompts/phase-30-python-renderer.md`
4. `prompts/phase-31-python-live-coding.md`
5. `prompts/phase-32-derived-explanations.md`
6. `prompts/phase-34-numpy-view.md`
7. `prompts/phase-35-pandas-view.md`
8. `prompts/phase-36-matplotlib-output.md`
9. `prompts/phase-37-concept-views.md`

**Out of scope:** Phases 33 and 38 (course content; they need material from Savanna that is not in
the repo yet), the `se-viz-tracer` repo, every Zenith item not listed above, and anything about
Vercel settings, accounts or deploy configuration.

Read `docs/PYTHON_DS_ROADMAP.md` once before starting. Each phase prompt is the spec for that phase.
Later prompts depend on earlier reports and on `docs/PYTHON_TRACE_FORMAT.md` (written in Phase 29);
read them when a prompt says to.

## Branch rules (non-negotiable)
- **Never** commit to, merge into, push to, or rebase `main`. Never force-push. Never rewrite
  published history. `main` deploys to production and is used in live classes.
- Setup, once:
  1. `git checkout main && git pull --ff-only`.
  2. `git checkout -b ds-python`.
  3. Commit the planning files (`docs/PYTHON_DS_ROADMAP.md`, `prompts/phase-28-*` to
     `prompts/phase-37-*`, this file) on `ds-python` as the first commit.
  4. `git push -u origin ds-python`.
- Per phase:
  1. `git checkout ds-python && git checkout -b <the branch named in the prompt>`.
  2. Implement the phase. Commit in small, meaningful commits.
  3. Run the **gates** (below). Fix failures. If a gate still fails after three honest fix
     attempts, go to "Stopping".
  4. Write the report the prompt asks for, from `reports/TEMPLATE.md`. Be specific and honest;
     the reviewer will verify claims against the code.
  5. `git checkout ds-python && git merge --no-ff <phase branch>` with a message naming the phase.
  6. Run the gates again on `ds-python`. If they fail, fix on the phase branch and merge again.
  7. `git push origin <phase branch> ds-python`.
  8. Append a row to `reports/ds-python-run-summary.md` (format below), commit it on `ds-python`,
     push.

## Gates (every phase, on the phase branch and again on `ds-python` after merging)
```
npm run typecheck
npm run lint
npm test
npm run build
node scripts/check-bundle.mjs --baseline <previous main-chunk bytes> --budget 25000
```
- Record the main `index-*.js` size after each phase in the summary. The first `--baseline` is
  the size measured on `ds-python` right after setup. A phase whose prompt sets a tighter rule
  follows the prompt.
- Do not weaken, skip or delete tests or checks to make a gate pass. If a test is wrong, say why
  in the report and fix it properly.
- Dependencies: only those a prompt names, each pinned to an exact version at least two weeks old.
  Never run `npm audit fix --force`. Use `npm install --save-exact <pkg>@<version>` so the lockfile
  stays consistent.

## Stopping
Stop the whole run (do not start the next phase) when any of these happens:
- a gate fails after three fix attempts;
- a hard constraint in a prompt can't be met;
- Phase 29's decision rule finds no mapping that passes all six criteria;
- a phase needs a dependency, service, credential or network access its prompt doesn't allow;
- you would have to touch `main`, Vercel, the tracer repo, or anything outside this repo.

When stopping: commit your work in progress on the phase branch (do **not** merge it), push the
branch, write the phase report with what is done and what blocked you, add a "STOPPED" row to the
summary, and end with a short message saying where you stopped and why.

## Deviation rule
If the code makes part of a prompt impossible or clearly wrong, take the smallest sensible
deviation, keep going, and call it out loudly in the phase report's "Key decisions & deviations"
section and in the summary row. Never invent scope.

## Summary file: `reports/ds-python-run-summary.md`
Start it during setup with a heading, the date, the starting `main` commit, and this table header:

| Phase | Branch | Result | Gates | Main chunk (bytes) | Deviations / notes |
|-------|--------|--------|-------|--------------------|--------------------|

`Result` is `MERGED to ds-python` or `STOPPED`. After the last phase (or when stopping), add a
"For the reviewer" section: what to look at first, known risks, and anything you are unsure of.

## Finally
Do not merge `ds-python` into `main`. Leykun reviews and merges it himself.
