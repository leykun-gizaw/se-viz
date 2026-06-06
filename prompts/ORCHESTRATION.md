# SE-Viz — Orchestration Prompt (run the remaining phases)

You are the **orchestrator** for the rest of the SE-Viz build. Your job is to execute the already-
written phase prompts in the correct order, parallelizing what is safe to parallelize, keeping the
shared contract stable, and pausing for review at the right moments. You do **not** invent new
scope — each phase's spec already exists in `prompts/phase-NN-*.md`.

## First, read these (do not skip)
- `docs/PARALLELIZATION.md` — the wave plan and dependency graph (authoritative).
- `docs/CONTENT_AUTHORING.md` — the rules every content phase must follow.
- `prompts/phase-05-…` through `prompts/phase-15-…` — the individual specs you will execute.
- `README.md`, `docs/CURRICULUM.md`, `docs/TRACE_FORMAT.md` — product + contract.

## Operating rules (apply to every phase)
1. **One branch per phase.** For each phase create a branch `phase-NN-<name>` off the current
   `main`. For phases that run in parallel, give each its **own git worktree** so the agents never
   share a working tree:
   `git worktree add ../seviz-phaseNN phase-NN-<name>`. Run each parallel agent in its worktree.
2. **Gates must pass before a phase is "done":** `npm run typecheck && npm run lint && npm run test
   && npm run build` all green, and the phase's `validateTrace`/catalog test passes. If a gate
   fails, fix it within that phase; do not proceed.
3. **Every phase writes its report** to `reports/phase-NN-*.md` from `reports/TEMPLATE.md`, and
   commits its work on its branch.
4. **Do NOT merge to `main` yourself.** Implement, gate, report, commit on the branch — then **stop
   at the checkpoints below** and present what's ready so the human + reviewer can check and merge.
   (If the human explicitly tells you to also merge, you may fast-forward/merge green branches and
   re-run the gates on `main` after each merge.)
5. **Content phases are additive only.** They create files under `src/content/<course>/<topic>/` and
   must NOT edit shared files (`catalog.ts`, `types.ts`, renderer, shared docs). If a content phase
   seems to need a shared-file edit, stop and report it — do not hand-edit.
6. **Foundation phases (05, 11) and polish (15) run SOLO** — no other agent running at the same time,
   because they touch the shared contract.

## Prerequisite check (do this before anything else)
- Confirm **Phase 04 (recursion) is merged into `main`** and the gates are green on `main`. If Phase
  04 isn't merged yet, stop and say so — everything here builds on it.

## Execution sequence

### Step 1 — Phase 05 (catalog refactor) — SOLO
Execute `prompts/phase-05-catalog-refactor.md` on branch `phase-05-catalog-refactor`. This makes the
catalog auto-discover content (so the parallel waves don't collide). Run gates, write the report,
commit. **CHECKPOINT A: stop and present** the branch + report + gate results for review/merge. Do
not start Wave 1 until Phase 05 is merged into `main`.

### Step 2 — WAVE 1 (content) — PARALLEL
After Phase 05 is on `main`, run these **five in parallel**, each on its own branch + worktree, each
via a subagent told to "read `prompts/phase-NN-…` and `docs/CONTENT_AUTHORING.md`, implement it,
run the gates, write the report, commit on your branch, do not merge":
- `phase-06-malloc-free`, `phase-07-linked-lists`, `phase-08-stacks-queues`,
  `phase-09-hash-tables`, `phase-10-argc-argv`.
When all five are green with reports, **CHECKPOINT B: stop and present** all five branches + reports
for review/merge.

### Step 3 — Phase 11 (concept-view model) — SOLO
After Wave 1 is merged, execute `prompts/phase-11-concept-view-model.md` on `phase-11-concept-view-
model`. Gates, report, commit. **CHECKPOINT C: stop and present** for review/merge. Do not start
Wave 2 until Phase 11 is merged.

### Step 4 — WAVE 2 (concept-view content) — PARALLEL
After Phase 11 is on `main`, run these **three in parallel** (own branch + worktree each), same
subagent instruction as Wave 1:
- `phase-12-static-libraries`, `phase-13-preprocessor`, `phase-14-debugging-dual-trace`.
When all three are green with reports, **CHECKPOINT D: stop and present** for review/merge.

### Step 5 — Phase 15 (polish) — SOLO, last
After Wave 2 is merged, execute `prompts/phase-15-presentation-polish.md` on `phase-15-presentation-
polish`. Gates, report, commit. **CHECKPOINT E: stop and present** for final review/merge.

## At every checkpoint, present
- Which branches are ready, the gate results for each, and a one-line summary per phase report.
- Any deviations the phase reports flagged.
- Then **wait** for the human to review/merge before starting the next step. Do not run ahead.

## Reminders
- Keep each agent in its lane (its phase folder/branch). Never point two agents at the same working
  tree. Re-run gates on `main` after each merge. If anything is ambiguous, prefer stopping and asking
  over guessing — the specs in `prompts/` are the source of truth.
