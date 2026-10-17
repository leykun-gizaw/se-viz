/**
 * Short labels for figure output (Phase 36): names, chart words, format and size notes.
 *
 * @packageDocumentation
 */
import type { ChartKind, TraceFigure } from '../../../engine/trace/types.ts';

const CHART_LABELS: Record<ChartKind, string> = {
  plot: 'line plot',
  scatter: 'scatter plot',
  bar: 'bar chart',
  barh: 'horizontal bar chart',
  hist: 'histogram',
  pie: 'pie chart',
  boxplot: 'box plot',
};

/** "Figure 1". */
export const figureName = (f: TraceFigure) => `Figure ${f.id.replace(/^fig/, '')}`;

/** "line plot and bar chart", or null when no chart call was recorded. */
export function chartWords(f: TraceFigure): string | null {
  const kinds = [...new Set(f.axes.flatMap((a) => a.kinds))].map((k) => CHART_LABELS[k]);
  if (kinds.length === 0) return null;
  return kinds.length === 1 ? kinds[0] : `${kinds.slice(0, -1).join(', ')} and ${kinds.at(-1)}`;
}

/** Why a figure has no image, in a few words. */
export function missingText(f: TraceFigure): string {
  switch (f.reason) {
    case 'cap':
      return 'Not kept: at most 6 figures per run';
    case 'too-large':
      return 'Figure too large to show';
    default:
      return 'matplotlib could not draw this figure';
  }
}

/** "SVG · 12 KB", "PNG · 210 KB", "too large · 1.4 MB". */
export function formatText(f: TraceFigure): string {
  const size =
    f.bytes === null
      ? ''
      : f.bytes >= 1024 * 1024
        ? ` · ${(f.bytes / (1024 * 1024)).toFixed(1)} MB`
        : ` · ${Math.max(1, Math.round(f.bytes / 1024))} KB`;
  if (f.format === 'none') return `${f.reason === 'cap' ? 'not kept' : 'no image'}${size}`;
  return `${f.format.toUpperCase()}${size}`;
}
