/**
 * The tracer API client. `POST {VITE_TRACER_URL}/trace` with `{ source, stdin? }` returns either
 * `{ trace }` (possibly with a `truncated` marker) or `{ error: { code, message, details? } }`
 * — see the tracer repo's `docs/API.md` for the canonical contract.
 *
 * {@link postTrace} types **every** response shape into one discriminated union so the UI can map
 * each outcome deliberately: compile errors carry the gcc `details` (the teaching value), timeouts
 * read as "ran too long", and anything unexpected — network failure, non-2xx without a typed error,
 * malformed JSON, or a returned trace that fails {@link validateTrace} — degrades to the single
 * generic "service unavailable" state instead of crashing the renderer.
 *
 * @packageDocumentation
 */

import type { Trace } from '../engine/trace/types.ts';
import { validateTrace } from '../engine/trace/validate.ts';
import { tracerConfig, type TracerConfig } from './config.ts';

/** Why a successful run came back shorter than the real execution. */
export type TruncationReason = 'step_limit' | 'output_limit';

/** The tracer's truncation marker on a `200 { trace, truncated }` response. */
export interface Truncation {
  reasons: TruncationReason[];
  /** How many steps the full run actually had. */
  originalSteps: number;
}

/**
 * Everything that can go wrong, as the UI distinguishes it. The first five come straight from the
 * API contract; the last two are client-side classifications that the UI presents as the generic
 * "service unavailable" state:
 * - `unavailable` — network failure, client-side timeout, malformed body, or an untyped non-2xx.
 * - `invalid_trace` — a 200 whose trace fails `validateTrace` (never feed the renderer bad data).
 */
export type LiveErrorCode =
  | 'invalid_request'
  | 'too_large'
  | 'compile_error'
  | 'timeout'
  | 'recorder_error'
  | 'unavailable'
  | 'invalid_trace';

/** A failed run, typed for the UI. `details` is the gcc output for `compile_error`. */
export interface LiveError {
  code: LiveErrorCode;
  /** The backend's message (or a client-side description). Not necessarily learner-facing. */
  message: string;
  details?: string;
}

/**
 * The outcome of {@link postTrace}: a validated trace (maybe truncated) or a typed error.
 *
 * `flags` and `warnings` are both **optional on purpose** — a tracer older than its Phase 08 sends
 * neither, and the deployed backend may lag this frontend.
 */
export type PostTraceResult =
  | {
      ok: true;
      trace: Trace;
      truncated?: Truncation;
      /** The flags the backend says it actually compiled with (de-duplicated, canonical order). */
      flags?: string[];
      /** gcc's warnings from a build that compiled anyway — what makes `-Wall`/`-Wextra` visible. */
      warnings?: string;
    }
  | { ok: false; error: LiveError };

export interface PostTraceOptions {
  /** Text piped to the program's stdin. Omitted from the request body when undefined. */
  stdin?: string;
  /**
   * Allowlisted compile flags (see `src/live/compileOptions.ts`). Omitted from the request body
   * when empty, so a caller that never sets them sends byte-for-byte the pre-Phase-25 request.
   */
  flags?: readonly string[];
  /** Override the env-derived config (tests). `postTrace` fails as `unavailable` when both are null. */
  config?: TracerConfig | null;
  /** Client-side abort timeout. Generous: the backend kills runaway programs itself (408). */
  timeoutMs?: number;
}

/** Default client-side timeout — well past the backend's own run timeout. */
export const DEFAULT_TIMEOUT_MS = 30_000;

const API_ERROR_CODES: readonly string[] = [
  'invalid_request',
  'too_large',
  'compile_error',
  'timeout',
  'recorder_error',
];

const fail = (code: LiveErrorCode, message: string, details?: string): PostTraceResult => ({
  ok: false,
  error: { code, message, ...(details !== undefined ? { details } : {}) },
});

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Narrow the API's `{ error: { code, message, details? } }` shape, if present. */
function extractApiError(body: unknown): LiveError | null {
  if (!isRecord(body) || !isRecord(body.error)) return null;
  const { code, message, details } = body.error;
  const knownCode =
    typeof code === 'string' && API_ERROR_CODES.includes(code)
      ? (code as LiveErrorCode)
      : 'unavailable';
  return {
    code: knownCode,
    message: typeof message === 'string' ? message : 'The tracer reported an error.',
    ...(typeof details === 'string' ? { details } : {}),
  };
}

/** Narrow the `truncated` marker; a malformed one is dropped rather than failing the run. */
function extractTruncation(v: unknown): Truncation | null {
  if (!isRecord(v) || !Array.isArray(v.reasons) || typeof v.originalSteps !== 'number') return null;
  const reasons = v.reasons.filter(
    (r): r is TruncationReason => r === 'step_limit' || r === 'output_limit',
  );
  return { reasons, originalSteps: v.originalSteps };
}

/** Narrow the echoed `flags`; anything malformed is dropped rather than failing the run. */
function extractFlags(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const entries: unknown[] = v;
  return entries.every((f) => typeof f === 'string') ? (entries as string[]) : null;
}

/**
 * Minimal structural gate before handing the payload to {@link validateTrace} (which assumes a
 * well-formed `Trace` and would throw on junk). Field-level invariants are then validateTrace's job.
 */
function looksLikeTrace(v: unknown): v is Trace {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.source === 'string' &&
    Array.isArray(v.steps) &&
    v.steps.every((s: unknown) => isRecord(s) && Array.isArray(s.stack) && Array.isArray(s.heap))
  );
}

/**
 * POST the program to the tracer and type the outcome. Never throws; never returns an unvalidated
 * trace.
 */
export async function postTrace(
  source: string,
  options: PostTraceOptions = {},
): Promise<PostTraceResult> {
  const config = options.config !== undefined ? options.config : tracerConfig();
  if (!config) {
    return fail('unavailable', 'No tracer is configured (VITE_TRACER_URL is unset).');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${config.url}/trace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
      },
      body: JSON.stringify({
        source,
        ...(options.stdin !== undefined ? { stdin: options.stdin } : {}),
        ...(options.flags && options.flags.length > 0 ? { flags: [...options.flags] } : {}),
      }),
      signal: controller.signal,
    });
  } catch {
    // Network failure or the client-side timeout fired — the service didn't answer.
    clearTimeout(timer);
    return fail('unavailable', 'Could not reach the tracer.');
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return fail('unavailable', `The tracer returned a malformed response (HTTP ${response.status}).`);
  } finally {
    clearTimeout(timer);
  }

  const apiError = extractApiError(body);
  if (apiError) return { ok: false, error: apiError };
  if (!response.ok || !isRecord(body)) {
    return fail('unavailable', `Unexpected tracer response (HTTP ${response.status}).`);
  }

  const trace = body.trace;
  if (!looksLikeTrace(trace)) {
    return fail('invalid_trace', 'The tracer returned something that is not a trace.');
  }
  try {
    const issues = validateTrace(trace);
    if (issues.length > 0) {
      return fail(
        'invalid_trace',
        `The returned trace failed validation (${issues.length} issue(s)): ${issues[0].message}`,
      );
    }
  } catch {
    return fail('invalid_trace', 'The returned trace could not be validated.');
  }

  const truncated = extractTruncation(body.truncated);
  const flags = extractFlags(body.flags);
  // A blank/whitespace-only warnings string is treated as absent, so the UI never renders an
  // empty "Compiled with warnings" panel.
  const warnings = typeof body.warnings === 'string' && body.warnings.trim() ? body.warnings : null;
  return {
    ok: true,
    trace,
    ...(truncated ? { truncated } : {}),
    ...(flags ? { flags } : {}),
    ...(warnings !== null ? { warnings } : {}),
  };
}
