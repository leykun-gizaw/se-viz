/**
 * Which allow-listed packages a program imports (Phase 31), so the live editor can say "Loading
 * pandas…" and ask the worker for them before the program runs.
 *
 * A light line scanner, not a parser: `import a, b as c`, `import a.b`, `from a.b import c`, and
 * several statements on one line (`;`) all count, wherever they sit (inside a function or an `if`
 * too — Python would import them when that code runs). Comments are ignored. The worker double-checks
 * with Pyodide's own `find_imports`, so a miss here only costs the early status message.
 *
 * @packageDocumentation
 */
import { ALLOWED_PACKAGES, type AllowedPackage } from '../protocol.ts';

const allowed = new Set<string>(ALLOWED_PACKAGES);

/** The root module of a dotted name: `matplotlib.pyplot` → `matplotlib`. */
function root(name: string): string {
  return name.trim().split('.')[0];
}

/** Allow-listed packages imported anywhere in `source`, in {@link ALLOWED_PACKAGES} order. */
export function detectPackages(source: string): AllowedPackage[] {
  const found = new Set<string>();
  for (const rawLine of source.split('\n')) {
    const line = rawLine.replace(/#.*$/, '');
    for (const statement of line.split(';')) {
      const s = statement.trim();
      const from = /^from\s+([A-Za-z_][\w.]*)\s+import\b/.exec(s);
      if (from) {
        found.add(root(from[1]));
        continue;
      }
      const imp = /^import\s+(.+)$/.exec(s);
      if (!imp) continue;
      for (const part of imp[1].split(',')) {
        const name = /^\s*([A-Za-z_][\w.]*)/.exec(part);
        if (name) found.add(root(name[1]));
      }
    }
  }
  return ALLOWED_PACKAGES.filter((p) => found.has(p) && allowed.has(p));
}

/** "pandas", "numpy and pandas", "numpy, pandas and scipy". */
export function packageList(packages: readonly string[]): string {
  if (packages.length <= 1) return packages.join('');
  return `${packages.slice(0, -1).join(', ')} and ${packages[packages.length - 1]}`;
}
