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
for (const name of [coreName, runtimeName]) {
  if (name) console.log(`lazy chunk ${name}: ${readFileSync(join(assets, name)).length} B`);
}

if (failures.length > 0) {
  for (const f of failures) console.error(`✗ ${f}`);
  process.exit(1);
}
console.log('✓ Mermaid is code-split and the main chunk is within budget');
