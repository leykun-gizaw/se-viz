/**
 * Env gating tests — Live Coding is available exactly when `VITE_TRACER_URL` is set, so the
 * production deploy (no var) never shows a dead feature.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tracerConfig } from './config.ts';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('tracerConfig', () => {
  it('is null (feature hidden) when VITE_TRACER_URL is unset — the production default', () => {
    // Stub to undefined explicitly: the dev machine may have a .env.local (vitest runs through
    // Vite and loads it), and this test must describe the no-var production build regardless.
    vi.stubEnv('VITE_TRACER_URL', undefined);
    expect(tracerConfig()).toBeNull();
  });

  it('is null when VITE_TRACER_URL is blank', () => {
    vi.stubEnv('VITE_TRACER_URL', '   ');
    expect(tracerConfig()).toBeNull();
  });

  it('returns the URL (trailing slash trimmed) when set, with no token by default', () => {
    vi.stubEnv('VITE_TRACER_URL', 'http://localhost:8080/');
    expect(tracerConfig()).toEqual({ url: 'http://localhost:8080' });
  });

  it('includes the token only when VITE_TRACER_TOKEN is set', () => {
    vi.stubEnv('VITE_TRACER_URL', 'http://localhost:8080');
    vi.stubEnv('VITE_TRACER_TOKEN', 'sekret');
    expect(tracerConfig()).toEqual({ url: 'http://localhost:8080', token: 'sekret' });
  });
});
