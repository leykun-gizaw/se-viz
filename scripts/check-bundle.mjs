#!/usr/bin/env node
/**
 * Phase 27 build check — Mermaid is code-split, and the main chunk stays within budget.
 *
 *   npm run build && node scripts/check-bundle.mjs [--baseline BYTES] [--budget BYTES]
 *
 * Checks the built `dist/`:
 *  1. Mermaid (`mermaid.core-*.js`) and our runtime (`mermaidRuntime-*.js`) are their own chunks.
 *  2. The main `index-*.js` chunk reaches them only through a dynamic `import()` — no static
 *     import, no Mermaid code inlined, and `index.html` doesn't preload them.
 *  3. The main chunk's **code** growth is at most `budget` bytes (minified). Theory decks are
 *     bundled into the main chunk as raw Markdown, so deck text is not Mermaid weight: the default
 *     baseline is the Phase 26 tip (55168b1) main chunk **plus** the measured size of the two
 *     Phase 27 exemplar slides. Later phases that grow the app for other reasons pass their own
 *     `--baseline` (or `BUNDLE_BASELINE`).
 *  4. (Phase 29) Pyodide is never in the main chunk: no Pyodide loader, runtime or CDN URL, and no
 *     Python recorder code in `index-*.js`, and `index.html` doesn't reference Pyodide. Pyodide may
 *     only live in a worker chunk that the main chunk doesn't import statically.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const PHASE_26_MAIN_BYTES = 712384; // `npx vite build` at 55168b1: dist/assets/index-DXE8Xas9.js
// The two exemplar Mermaid slides' Markdown, measured as (build with them) − (build without them).
const PHASE_27_DECK_TEXT_BYTES = 918;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? Number(process.argv[i + 1]) : fallback;
}
const baseline = arg(
  'baseline',
  Number(process.env.BUNDLE_BASELINE ?? PHASE_26_MAIN_BYTES + PHASE_27_DECK_TEXT_BYTES),
);
const budget = arg('budget', 3072);

const dist = join(process.cwd(), 'dist');
const assets = join(dist, 'assets');
const files = readdirSync(assets);
const one = (re, what) => {
  const hits = files.filter((f) => re.test(f));
  if (hits.length !== 1) fail(`expected exactly one ${what}, found ${hits.length}: ${hits}`);
  return hits[0];
};
const failures = [];
// Identifiers only Pyodide's loader/runtime, its CDN URL, or our recorder would put in a chunk.
const PYODIDE_MARKERS = [
  'loadPyodide',
  'pyodide.asm',
  'cdn.jsdelivr.net/pyodide',
  'python_stdlib.zip',
  'pyodide-lock.json',
  'sys.settrace',
];
const pyodideChunks = [];
function fail(msg) {
  failures.push(msg);
}

const mainName = one(/^index-[\w-]+\.js$/, 'main chunk (index-*.js)');
const coreName = one(/^mermaid\.core-[\w-]+\.js$/, 'Mermaid chunk (mermaid.core-*.js)');
const runtimeName = one(/^mermaidRuntime-[\w-]+\.js$/, 'runtime chunk (mermaidRuntime-*.js)');

if (mainName) {
  const main = readFileSync(join(assets, mainName), 'utf8');
  const html = readFileSync(join(dist, 'index.html'), 'utf8');

  // 2. Only dynamic references to the Mermaid side; no Mermaid internals in the main chunk.
  if (/(?:from\s*|import\s*)["'][^"']*mermaid/i.test(main)) {
    fail('main chunk statically imports a Mermaid chunk');
  }
  if (runtimeName && !main.includes(runtimeName)) {
    fail(`main chunk does not dynamically import ${runtimeName}`);
  }
  // Library/config identifiers only — deck text legitimately contains Mermaid *source* keywords
  // like `stateDiagram-v2` (the decks are bundled into the main chunk as raw Markdown).
  for (const marker of ['securityLevel', 'suppressErrorRendering', 'DOMPurify', coreName]) {
    if (marker && main.includes(marker)) fail(`main chunk contains Mermaid code ("${marker}")`);
  }
  if (/mermaid/i.test(html)) fail('index.html references (preloads) a Mermaid chunk');

  // 4. Pyodide stays out of the main chunk (Phase 29): it loads only inside the Python worker.
  for (const marker of PYODIDE_MARKERS) {
    if (main.includes(marker)) fail(`main chunk contains Pyodide code ("${marker}")`);
  }
  if (/pyodide/i.test(html)) fail('index.html references (preloads) Pyodide');
  for (const name of files.filter((f) => f.endsWith('.js') && f !== mainName)) {
    const text = readFileSync(join(assets, name), 'utf8');
    if (!text.includes('loadPyodide')) continue;
    pyodideChunks.push(name);
    if (
      new RegExp(`(?:from\\s*|import\\s*)["'][^"']*${name.replace(/[.-]/g, '\\$&')}`).test(main)
    ) {
      fail(`main chunk statically imports the Pyodide chunk ${name}`);
    }
  }

  // 3. Size budget.
  const bytes = Buffer.byteLength(main);
  const delta = bytes - baseline;
  const gz = gzipSync(main).length;
  console.log(
    `main chunk ${mainName}: ${bytes} B (gzip ${gz} B); baseline ${baseline} B; ` +
      `delta ${delta >= 0 ? '+' : ''}${delta} B (budget ${budget} B)`,
  );
  if (delta > budget) fail(`main chunk grew by ${delta} B (> ${budget} B budget)`);
}
for (const name of [coreName, runtimeName, ...pyodideChunks]) {
  if (name) console.log(`lazy chunk ${name}: ${readFileSync(join(assets, name)).length} B`);
}

if (failures.length > 0) {
  for (const f of failures) console.error(`✗ ${f}`);
  process.exit(1);
}
console.log(
  '✓ Mermaid is code-split, Pyodide is not in the main chunk, and the main chunk is within budget',
);
