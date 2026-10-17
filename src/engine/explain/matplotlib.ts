/**
 * Derived explanations for matplotlib (Phase 36): the chart a plotting call draws (`plot`,
 * `scatter`, `bar`, `barh`, `hist`, `pie`, `boxplot`), the labels set (`title`, `xlabel`, `ylabel`,
 * `suptitle`, `legend`), new figures (`plt.figure`, `plt.subplots`), and `plt.show()`; plus one
 * sentence per figure a step produced, from what the recorder captured.
 *
 * The Phase 32 rule holds: say only what the trace shows. A statement is read as a matplotlib call
 * only when its receiver is `pyplot` (the name an `import matplotlib.pyplot as …` line bound, which
 * frames never show, as they leave modules out) or a recorded `Axes` / `Figure` object. What a
 * figure shows — its chart types, titles, axis labels, legend — is read from the recorded figure
 * ({@link TraceFigure.axes}), which the recorder took from matplotlib itself.
 *
 * @packageDocumentation
 */
import type { ChartKind, PyExpr, PyStatement, Trace, TraceFigure } from '../trace/types.ts';
import type { ConceptKey } from './glossary.ts';
import type { NpCtx, NumpyDid } from './numpy.ts';
import { lookupName, readExpr, targetBlock } from './pyState.ts';
import { code, count } from './text.ts';

type Call = Extract<PyExpr, { type: 'call' }>;

/** What each chart call draws, in words. */
export const CHART_WORDS: Record<ChartKind, string> = {
  plot: 'line plot',
  scatter: 'scatter plot',
  bar: 'bar chart',
  barh: 'horizontal bar chart',
  hist: 'histogram',
  pie: 'pie chart',
  boxplot: 'box plot',
};

const CHART_CALLS = new Set<string>(Object.keys(CHART_WORDS));

/* ───────────────────────── pyplot, axes and figures ───────────────────────── */

const aliasCache = new WeakMap<Trace, Set<string>>();

/**
 * The names the program bound to `matplotlib.pyplot`, read from its import lines (modules never
 * appear in frames, so the source is the only place the binding shows).
 */
export function pyplotNames(trace: Trace): Set<string> {
  let names = aliasCache.get(trace);
  if (names) return names;
  names = new Set();
  const lines = trace.source.split('\n');
  for (const stmt of Object.values(trace.statements ?? {})) {
    if (stmt.kind !== 'Import') continue;
    for (const part of (lines[stmt.line - 1] ?? '').replace(/#.*$/, '').split(';')) {
      const s = part.trim();
      const plain = /^import\s+(.+)$/.exec(s);
      if (plain) {
        for (const item of plain[1].split(',')) {
          const m = /^\s*matplotlib\.pyplot(?:\s+as\s+([A-Za-z_]\w*))?\s*$/.exec(item);
          if (m) names.add(m[1] ?? 'matplotlib.pyplot');
        }
      }
      const from = /^from\s+matplotlib\s+import\s+(.+)$/.exec(s);
      if (from) {
        for (const item of from[1].replace(/[()]/g, '').split(',')) {
          const m = /^\s*pyplot(?:\s+as\s+([A-Za-z_]\w*))?\s*$/.exec(item);
          if (m) names.add(m[1] ?? 'pyplot');
        }
      }
    }
  }
  aliasCache.set(trace, names);
  return names;
}

type Receiver = { kind: 'pyplot' } | { kind: 'axes' | 'figure'; text: string };

/** Whether an expression is `pyplot` itself, as the program named it. */
function isPyplot(ctx: NpCtx, e: PyExpr): boolean {
  const names = pyplotNames(ctx.trace);
  if (e.type === 'name') {
    // A name the program rebound to something else is no longer the module.
    return names.has(e.id) && (!ctx.pre || lookupName(ctx.pre, ctx.frame, e.id) === null);
  }
  return (
    e.type === 'attribute' &&
    e.attr === 'pyplot' &&
    e.value.type === 'name' &&
    e.value.id === 'matplotlib' &&
    names.has('matplotlib.pyplot')
  );
}

function receiver(ctx: NpCtx, e: PyExpr): Receiver | null {
  if (isPyplot(ctx, e)) return { kind: 'pyplot' };
  const state = ctx.pre ?? ctx.step;
  const r = readExpr(state, ctx.frame, e);
  const b = r ? targetBlock(state, r.cell) : undefined;
  if (!r || !b || b.objectKind !== 'other') return null;
  if (/Axes$/.test(b.type ?? '')) return { kind: 'axes', text: r.path };
  if (/Figure$/.test(b.type ?? '')) return { kind: 'figure', text: r.path };
  return null;
}

/** The one call a statement is about: an expression statement or the value of an assignment. */
function callOf(stmt: PyStatement): Call | null {
  const v = stmt.kind === 'Expr' ? stmt.value : stmt.kind === 'Assign' ? stmt.value : undefined;
  return v?.type === 'call' && v.func.type === 'attribute' ? v : null;
}

const argText = (e: PyExpr | undefined): string | null => {
  if (!e) return null;
  if (e.type === 'name') return e.id;
  if (e.type === 'const') return e.src ?? e.repr;
  return e.src ?? null;
};
const kwarg = (call: Call, name: string) => call.kwargs?.find((k) => k.name === name)?.value;
const intConst = (e: PyExpr | undefined) =>
  e?.type === 'const' && /^\d+$/.test(e.repr) ? Number(e.repr) : null;
const numConst = (e: PyExpr | undefined) =>
  e?.type === 'const' && /^\d+(\.\d+)?$/.test(e.repr) ? e.repr : null;

/** `(6, 4)` as "6 × 4 inches", when the figure size is written as two numbers. */
function sizeWords(e: PyExpr | undefined): string | null {
  if (e?.type !== 'display' || e.of !== 'tuple' || e.items?.length !== 2) return null;
  const [w, h] = e.items.map(numConst);
  return w && h ? `${w} × ${h} inches` : null;
}

/* ───────────────────────── the statement ───────────────────────── */

function where(r: Receiver): string {
  return r.kind === 'pyplot' ? 'on the current axes' : `on ${code(r.text)}`;
}

function chartSentence(method: ChartKind, call: Call, r: Receiver): string {
  const [a0, a1] = [argText(call.args[0]), argText(call.args[1])];
  const word = CHART_WORDS[method];
  // "Drew a <chart>[ of …] <where>[: … / , …]."
  let of = '';
  let tail = '';
  switch (method) {
    case 'plot':
    case 'scatter':
      if (call.args.length >= 2 && a0 && a1) of = ` of ${code(a1)} against ${code(a0)}`;
      else if (call.args.length === 1 && a0) of = ` of ${code(a0)}`;
      break;
    case 'bar':
    case 'barh':
      if (call.args.length >= 2 && a0 && a1)
        tail = `: one bar for each item of ${code(a0)}, ${method === 'bar' ? 'its height' : 'its length'} from ${code(a1)}`;
      break;
    case 'hist': {
      if (a0) of = ` of the values in ${code(a0)}`;
      const bins = kwarg(call, 'bins') ?? call.args[1];
      const n = intConst(bins);
      if (n !== null) tail = `, sorted into ${count(n, 'bin')}`;
      else if (!bins) tail = ", sorted into 10 bins (matplotlib's default)";
      break;
    }
    case 'pie':
    case 'boxplot':
      if (a0) of = ` of ${code(a0)}`;
      break;
  }
  return `Drew a ${word}${of} ${where(r)}${tail}.`;
}

const LABELS: Record<string, string> = {
  title: 'title',
  set_title: 'title',
  xlabel: 'x-axis label',
  set_xlabel: 'x-axis label',
  ylabel: 'y-axis label',
  set_ylabel: 'y-axis label',
};

/** The matplotlib reading of a statement, or null when it isn't a call this file knows. */
export function matplotlibStatement(ctx: NpCtx, stmt: PyStatement): NumpyDid | null {
  const call = callOf(stmt);
  if (!call || call.func.type !== 'attribute') return null;
  const method = call.func.attr;
  const r = receiver(ctx, call.func.value);
  if (!r) return null;
  const did = (sentences: string[], concept: ConceptKey): NumpyDid => ({
    did: sentences,
    lead: sentences[0],
    concept,
  });

  if (CHART_CALLS.has(method) && r.kind !== 'figure') {
    return did([chartSentence(method as ChartKind, call, r)], 'mpl-chart');
  }
  if (method in LABELS && r.kind !== 'figure') {
    const v = argText(call.args[0]);
    if (!v) return null;
    const of = r.kind === 'pyplot' ? 'the current axes' : code(r.text);
    return did([`Set the ${LABELS[method]} of ${of} to ${code(v)}.`], 'mpl-labels');
  }
  if (method === 'suptitle' && r.kind !== 'axes') {
    const v = argText(call.args[0]);
    if (!v) return null;
    const of = r.kind === 'pyplot' ? 'the current figure' : code(r.text);
    return did([`Set the overall title of ${of} to ${code(v)}.`], 'mpl-labels');
  }
  if (method === 'legend' && r.kind !== 'figure') {
    return did(
      [`Added a legend to ${r.kind === 'pyplot' ? 'the current axes' : code(r.text)}.`],
      'mpl-labels',
    );
  }
  if ((method === 'figure' || method === 'subplots') && r.kind === 'pyplot') {
    const size = sizeWords(kwarg(call, 'figsize'));
    let what = 'Made a new figure';
    if (method === 'subplots') {
      const rows = intConst(call.args[0] ?? kwarg(call, 'nrows'));
      const cols = intConst(call.args[1] ?? kwarg(call, 'ncols'));
      const n = (rows ?? 1) * (cols ?? 1);
      const given = call.args.length > 0 || kwarg(call, 'nrows') || kwarg(call, 'ncols');
      if (!given) what += ' with one set of axes';
      else if (rows !== null && (cols !== null || call.args.length < 2))
        what +=
          n === 1
            ? ' with one set of axes'
            : ` with ${n} sets of axes (subplots) in ${count(rows, 'row')} of ${cols ?? 1}`;
      else what += ' with subplots';
    }
    const out = [`${what}${size ? `, ${size}` : ''}; it is now the current figure.`];
    out.push(...namesBound(ctx, stmt));
    return did(out, 'mpl-figure');
  }
  if (method === 'show' && r.kind !== 'axes') {
    const made = (ctx.trace.figures ?? []).filter(
      (f) => f.step === ctx.step.index && f.trigger === 'show',
    );
    const text =
      made.length > 0
        ? `${code(stmtText(call))} drew ${made.length === 1 ? 'the open figure' : `the ${made.length} open figures`} into the output, then closed ${made.length === 1 ? 'it' : 'them'}.`
        : `${code(stmtText(call))} found no open figure, so nothing new appears in the output.`;
    return { did: [text], lead: made[0] ? figureSentence(made[0]) : text, concept: 'mpl-show' };
  }
  if (method === 'savefig' && r.kind !== 'axes') {
    const v = argText(call.args[0]);
    return v ? did([`Saved the figure to the file ${code(v)}.`], 'mpl-figure') : null;
  }
  return null;
}

const stmtText = (call: Call) => call.src ?? `${argText(call.func) ?? 'show'}()`;

/** "`fig` refers to the new figure and `ax` to its axes", checked against the recorded objects. */
function namesBound(ctx: NpCtx, stmt: PyStatement): string[] {
  if (stmt.kind !== 'Assign' || stmt.targets.length !== 1) return [];
  const typeOf = (e: PyExpr): string | null => {
    if (e.type !== 'name') return null;
    const b = targetBlock(ctx.step, lookupName(ctx.step, ctx.frame, e.id));
    return b?.objectKind === 'other' ? (b.type ?? null) : null;
  };
  const t = stmt.targets[0];
  if (t.type === 'name') {
    const ty = typeOf(t);
    return ty === 'Figure' ? [`${code(t.id)} refers to the figure.`] : [];
  }
  if (t.type !== 'display' || t.items?.length !== 2) return [];
  const [fig, axes] = t.items;
  if (fig.type !== 'name' || typeOf(fig) !== 'Figure') return [];
  const axNames = axes.type === 'name' ? [axes] : axes.type === 'display' ? (axes.items ?? []) : [];
  if (
    axNames.length === 0 ||
    !axNames.every((a) => a.type === 'name' && /Axes$/.test(typeOf(a) ?? ''))
  )
    return [`${code(fig.id)} refers to the figure.`];
  const list = axNames.map((a) => code((a as { id: string }).id));
  const joined =
    list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
  return [
    `${code(fig.id)} refers to the figure and ${joined} to ${list.length === 1 ? 'its axes' : `its ${list.length} sets of axes`}.`,
  ];
}

/* ───────────────────────── the figures a step produced ───────────────────────── */

function joinWords(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "a line plot", "a chart with a line plot and a scatter plot", "a set of axes with no chart". */
function axesWords(kinds: readonly ChartKind[]): string {
  if (kinds.length === 0) return 'a set of axes with no plotting call this view names';
  if (kinds.length === 1) return `a ${CHART_WORDS[kinds[0]]}`;
  return `a chart with ${joinWords(kinds.map((k) => `a ${CHART_WORDS[k]}`))}`;
}

function labelWords(a: TraceFigure['axes'][number], withTitle: boolean): string {
  const parts: string[] = [];
  if (withTitle && a.title) parts.push(`titled ${code(a.title)}`);
  const axes: string[] = [];
  if (a.xlabel) axes.push(`the x axis labelled ${code(a.xlabel)}`);
  if (a.ylabel) axes.push(`${a.xlabel ? 'the y axis' : 'the y axis labelled'} ${code(a.ylabel)}`);
  if (axes.length > 0) parts.push(`with ${joinWords(axes)}`);
  if (a.legend && a.legend.length > 0)
    parts.push(`with a legend for ${joinWords(a.legend.map(code))}`);
  return parts.join(', ');
}

/** Words for what a figure shows: its chart types and labels, from the recorded axes. */
export function figureContent(f: TraceFigure): string {
  const charted = f.axes.filter((a) => a.kinds.length > 0 || a.title || a.xlabel || a.ylabel);
  const each = charted.map((a) => {
    const labels = labelWords(a, true);
    return `${axesWords(a.kinds)}${labels ? ` ${labels}` : ''}`;
  });
  if (each.length === 0) return 'a figure with nothing this view can name drawn on it';
  if (each.length === 1) return each[0];
  return `${count(each.length, 'subplot')}, (1) ${each.map((t, i) => (i === 0 ? t : `(${i + 1}) ${t}`)).join('; ')}`;
}

/** Why a figure has no image, in words. */
function missingWords(f: TraceFigure): string {
  switch (f.reason) {
    case 'cap':
      return 'at most 6 figures are kept per run, so it is listed without its image';
    case 'too-large':
      return 'it is too large to show (over 300 KB as an SVG, and as a PNG at 100 dpi), so it is listed without its image';
    default:
      return 'matplotlib could not draw it, so it is listed without its image';
  }
}

/** One sentence about a figure a step produced. */
export function figureSentence(f: TraceFigure): string {
  const name = `Figure ${f.id.replace(/^fig/, '')}`;
  const titled = f.title && (f.axes.length !== 1 || f.axes[0]?.title !== f.title);
  const lead =
    f.trigger === 'end'
      ? `${name} was still open when the program ended, so it is in the output too`
      : `${name} is in the output`;
  const content = figureContent(f);
  const body = /^\d+ subplots, /.test(content)
    ? `${lead}${titled ? `, titled ${code(f.title!)}` : ''}. It has ${content.replace(/, \(1\)/, ': (1)')}.`
    : `${lead}${titled ? `, titled ${code(f.title!)}` : ''}: ${content}.`;
  if (f.format === 'none') return `${body} ${capitalizeFirst(missingWords(f))}.`;
  if (f.format === 'png')
    return `${body} It is shown as a PNG image: its SVG would be over 300 KB.`;
  return body;
}

const capitalizeFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The "What changed" subject for a figure: `Figure 1 (line plot): Rainfall by month`. */
export function figureRow(f: TraceFigure): string {
  const kinds = [...new Set(f.axes.flatMap((a) => a.kinds))].map((k) => CHART_WORDS[k]);
  const what = kinds.length > 0 ? ` (${joinWords(kinds)})` : '';
  const title = f.title ? `: ${code(f.title)}` : '';
  const note = f.format === 'none' ? ' · no image' : f.format === 'png' ? ' · PNG' : '';
  return `Figure ${f.id.replace(/^fig/, '')}${what}${title}${note}`;
}
