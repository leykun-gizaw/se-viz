/**
 * Python live coding (Phase 31) — the bits the main chunk needs: the course-map selection id. The
 * rest of the mode (editor, runner, Pyodide) is lazy and lives behind `PythonLiveView`.
 *
 * Unlike C live coding (gated on `VITE_TRACER_URL`), Python runs in the browser, so the entry is
 * always present.
 *
 * @packageDocumentation
 */

/** The synthetic selection id of the "Live coding · Python" entry (not a trace id). */
export const LIVE_PYTHON_ID = 'live-python';
