/**
 * Live Coding configuration — reads the tracer backend location from Vite env vars.
 *
 * The whole feature is **gated on `VITE_TRACER_URL`**: when it is unset (e.g. the production
 * deploy, which has no tracer yet) {@link tracerConfig} returns `null` and the Live Coding entry
 * never renders, so we don't ship a dead button. `VITE_TRACER_TOKEN` is forward-compat for the
 * backend's future auth phase — sent as a bearer header only when set.
 *
 * @packageDocumentation
 */

/** The synthetic selection id the workbench uses for the Live Coding entry (not a trace id). */
export const LIVE_CODING_ID = 'live-coding';

/** Where (and how) to reach the tracer. */
export interface TracerConfig {
  /** Base URL, no trailing slash, e.g. `"http://localhost:8080"`. */
  url: string;
  /** Optional bearer token, sent as `Authorization: Bearer <token>` when present. */
  token?: string;
}

/**
 * The tracer config from the environment, or `null` when `VITE_TRACER_URL` is unset/blank —
 * which means Live Coding mode is unavailable and must not be shown.
 */
export function tracerConfig(): TracerConfig | null {
  const url = import.meta.env.VITE_TRACER_URL?.trim();
  if (!url) return null;
  const token = import.meta.env.VITE_TRACER_TOKEN?.trim();
  return { url: url.replace(/\/+$/, ''), ...(token ? { token } : {}) };
}
