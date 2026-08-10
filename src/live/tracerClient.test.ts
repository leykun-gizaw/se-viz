/**
 * Tracer client tests — every response shape from the API contract, against a **mocked fetch**
 * (no real backend; see the phase prompt: CI never runs the tracer).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Trace } from '../engine/trace/types.ts';
import { postTrace } from './tracerClient.ts';

const CONFIG = { url: 'http://localhost:8080' };

/** A tiny trace that passes validateTrace. */
function validTrace(): Trace {
  return {
    id: 'live',
    title: 'live',
    language: 'c',
    source: 'int main(void) { return 0; }\n',
    steps: [
      {
        id: 's0',
        index: 0,
        narration: 'start',
        highlightedLines: [1],
        stack: [{ id: 'main', name: 'main', callId: 0, variables: [] }],
        heap: [],
      },
    ],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('postTrace — request shape', () => {
  it('POSTs { source, stdin } to {url}/trace with JSON headers', async () => {
    const fetchMock = mockFetch(async () => jsonResponse({ trace: validTrace() }));
    await postTrace('int main(void){}', { stdin: 'abc', config: CONFIG });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8080/trace');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init?.body))).toEqual({ source: 'int main(void){}', stdin: 'abc' });
  });

  it('omits stdin from the body when not given, and sends no Authorization without a token', async () => {
    const fetchMock = mockFetch(async () => jsonResponse({ trace: validTrace() }));
    await postTrace('src', { config: CONFIG });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({ source: 'src' });
    expect(init?.headers).not.toHaveProperty('Authorization');
  });

  it('sends the bearer token when the config has one', async () => {
    const fetchMock = mockFetch(async () => jsonResponse({ trace: validTrace() }));
    await postTrace('src', { config: { url: 'http://t', token: 'sekret' } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer sekret' });
  });

  it('includes flags in the body when non-empty', async () => {
    const fetchMock = mockFetch(async () => jsonResponse({ trace: validTrace() }));
    await postTrace('src', { flags: ['-Wall', '-Wextra', '-std=c11'], config: CONFIG });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      source: 'src',
      flags: ['-Wall', '-Wextra', '-std=c11'],
    });
  });

  it('omits the flags KEY entirely when empty or absent (byte-for-byte the old request)', async () => {
    const fetchMock = mockFetch(async () => jsonResponse({ trace: validTrace() }));

    await postTrace('src', { flags: [], config: CONFIG });
    const empty = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as Record<string, unknown>;
    expect('flags' in empty).toBe(false);
    expect(empty).toEqual({ source: 'src' });

    await postTrace('src', { config: CONFIG });
    const absent = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as Record<string, unknown>;
    expect('flags' in absent).toBe(false);
  });

  it('fails as unavailable (without fetching) when no tracer is configured', async () => {
    const fetchMock = mockFetch(async () => jsonResponse({ trace: validTrace() }));
    const result = await postTrace('src', { config: null });
    expect(result).toMatchObject({ ok: false, error: { code: 'unavailable' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('postTrace — success shapes', () => {
  it('returns the trace on 200 { trace }', async () => {
    mockFetch(async () => jsonResponse({ trace: validTrace() }));
    const result = await postTrace('src', { config: CONFIG });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.trace.id).toBe('live');
      expect(result.truncated).toBeUndefined();
    }
  });

  it('surfaces the truncation marker on 200 { trace, truncated }', async () => {
    mockFetch(async () =>
      jsonResponse({
        trace: validTrace(),
        truncated: { reasons: ['step_limit', 'output_limit'], originalSteps: 5000 },
      }),
    );
    const result = await postTrace('src', { config: CONFIG });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.truncated).toEqual({
        reasons: ['step_limit', 'output_limit'],
        originalSteps: 5000,
      });
    }
  });

  it('threads the echoed flags and warnings through', async () => {
    const gcc = "u.c:4:9: warning: unused variable 'x' [-Wunused-variable]";
    mockFetch(async () =>
      jsonResponse({ trace: validTrace(), flags: ['-Wall', '-std=c11'], warnings: gcc }),
    );
    const result = await postTrace('src', { config: CONFIG });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.flags).toEqual(['-Wall', '-std=c11']);
      expect(result.warnings).toBe(gcc);
    }
  });

  it('tolerates a success WITHOUT the echoed flags or warnings (an older tracer)', async () => {
    mockFetch(async () => jsonResponse({ trace: validTrace() }));
    const result = await postTrace('src', { config: CONFIG });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.flags).toBeUndefined();
      expect(result.warnings).toBeUndefined();
    }
  });

  it('drops malformed flags/warnings rather than failing the run', async () => {
    mockFetch(async () =>
      jsonResponse({ trace: validTrace(), flags: 'not-an-array', warnings: 42 }),
    );
    const result = await postTrace('src', { config: CONFIG });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.flags).toBeUndefined();
      expect(result.warnings).toBeUndefined();
    }
  });

  it('treats a blank warnings string as absent (no empty panel)', async () => {
    mockFetch(async () => jsonResponse({ trace: validTrace(), warnings: '   \n ' }));
    const result = await postTrace('src', { config: CONFIG });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings).toBeUndefined();
  });

  it('rejects a 200 whose trace fails validateTrace (never feed the renderer bad data)', async () => {
    const broken = validTrace();
    broken.steps[0].highlightedLines = [99]; // outside the one-line source
    mockFetch(async () => jsonResponse({ trace: broken }));
    const result = await postTrace('src', { config: CONFIG });
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid_trace' } });
  });

  it('rejects a 200 whose payload is not even trace-shaped', async () => {
    mockFetch(async () => jsonResponse({ trace: { id: 42 } }));
    const result = await postTrace('src', { config: CONFIG });
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid_trace' } });
  });
});

describe('postTrace — error shapes', () => {
  it.each([
    ['compile_error', 400],
    ['invalid_request', 400],
    ['too_large', 413],
    ['timeout', 408],
    ['recorder_error', 502],
  ] as const)('types the %s error', async (code, status) => {
    mockFetch(async () => jsonResponse({ error: { code, message: 'm' } }, status));
    const result = await postTrace('src', { config: CONFIG });
    expect(result).toMatchObject({ ok: false, error: { code, message: 'm' } });
  });

  it('keeps the gcc details on compile_error', async () => {
    const gcc = "main.c:3:5: error: expected ';' before 'return'";
    mockFetch(async () =>
      jsonResponse({ error: { code: 'compile_error', message: 'compilation failed', details: gcc } }, 400),
    );
    const result = await postTrace('src', { config: CONFIG });
    expect(result).toMatchObject({ ok: false, error: { code: 'compile_error', details: gcc } });
  });

  it('maps an unknown error code to unavailable', async () => {
    mockFetch(async () => jsonResponse({ error: { code: 'gremlins', message: 'm' } }, 500));
    const result = await postTrace('src', { config: CONFIG });
    expect(result).toMatchObject({ ok: false, error: { code: 'unavailable' } });
  });

  it('maps a network failure to unavailable', async () => {
    mockFetch(async () => {
      throw new TypeError('fetch failed');
    });
    const result = await postTrace('src', { config: CONFIG });
    expect(result).toMatchObject({ ok: false, error: { code: 'unavailable' } });
  });

  it('maps a non-JSON response to unavailable', async () => {
    mockFetch(async () => new Response('<html>gateway error</html>', { status: 502 }));
    const result = await postTrace('src', { config: CONFIG });
    expect(result).toMatchObject({ ok: false, error: { code: 'unavailable' } });
  });

  it('maps an untyped non-2xx to unavailable', async () => {
    mockFetch(async () => jsonResponse({ nope: true }, 500));
    const result = await postTrace('src', { config: CONFIG });
    expect(result).toMatchObject({ ok: false, error: { code: 'unavailable' } });
  });

  it('aborts a hung request after the client-side timeout and reports unavailable', async () => {
    mockFetch(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const result = await postTrace('src', { config: CONFIG, timeoutMs: 10 });
    expect(result).toMatchObject({ ok: false, error: { code: 'unavailable' } });
  });
});
