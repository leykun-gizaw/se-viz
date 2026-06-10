/// <reference types="vite/client" />

/** Vite env vars this app reads (documented in `.env.example`). All optional. */
interface ImportMetaEnv {
  /** Base URL of the SE-Viz Tracer backend. Unset ⇒ Live Coding mode is hidden. */
  readonly VITE_TRACER_URL?: string;
  /** Optional bearer token for the tracer (forward-compat; the backend has no auth yet). */
  readonly VITE_TRACER_TOKEN?: string;
}
