/**
 * Big O concept view (Phase 37, `view: 'growth'`): the growth curves on shared axes, a marker on
 * each at the current n (a curve above the chart gets an arrow at the top edge with its count), a
 * table of the counts at n, and the caption comparing two curves. The part of each curve up to n is
 * drawn solid, the rest faint. Curves differ in lightness (an ordered ramp), dash pattern and a
 * direct label, so colour is never the only cue. Data-driven from {@link Step.growth}.
 */
import type { GrowthStep, Step } from '../../engine/trace/types.ts';

const W = 640;
const H = 340;
const M = { left: 52, right: 96, top: 16, bottom: 40 };
const DASH = ['2 5', '7 4', undefined, '12 4 3 4', undefined];

const color = (i: number) => `var(--se-cv-curve-${Math.min(i, 4)})`;
const fmt = (x: number) =>
  Number.isInteger(x)
    ? x.toLocaleString('en-US')
    : x.toLocaleString('en-US', { maximumFractionDigits: 2 });

function ticks(max: number, count: number): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max * i) / count);
}

export function GrowthView({ step }: { step: Step }) {
  const g: GrowthStep | undefined = step.growth;
  if (!g) return null;
  const xMax = g.ns[g.ns.length - 1];
  const k = g.ns.indexOf(g.n);
  const pw = W - M.left - M.right;
  const ph = H - M.top - M.bottom;
  const x = (n: number) => M.left + (n / xMax) * pw;
  const y = (c: number) => M.top + ph - (Math.min(c, g.yMax) / g.yMax) * ph;
  const compared = new Set(g.compare ?? []);

  const path = (counts: number[], from: number, to: number) =>
    counts
      .slice(from, to + 1)
      .map((c, j) => `${j === 0 ? 'M' : 'L'}${x(g.ns[from + j]).toFixed(1)} ${y(c).toFixed(1)}`)
      .join(' ');

  // Direct labels at the right edge, nudged apart so they never overlap.
  const labelYs = g.curves.map((c) => ({ id: c.id, y: y(c.counts[c.counts.length - 1]) }));
  const order = [...labelYs].sort((a, b) => b.y - a.y);
  for (let i = 1; i < order.length; i++) {
    if (order[i - 1].y - order[i].y < 14) order[i].y = order[i - 1].y - 14;
  }
  const labelY = new Map(order.map((l) => [l.id, l.y]));

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto rounded-lg border border-hairline bg-bg p-4 lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <svg
          role="img"
          aria-label={`Growth curves at n = ${g.n}: ${g.curves.map((c) => `${c.label} ${fmt(c.counts[k])}`).join(', ')}.`}
          viewBox={`0 0 ${W} ${H}`}
          className="min-h-0 w-full flex-1"
          data-concept="growth"
        >
          <defs>
            <clipPath id="se-growth-plot">
              <rect x={M.left} y={M.top - 1} width={pw + 1} height={ph + 2} />
            </clipPath>
          </defs>
          {ticks(g.yMax, 4).map((t) => (
            <g key={`y${t}`}>
              <line x1={M.left} x2={M.left + pw} y1={y(t)} y2={y(t)} stroke="var(--se-border)" />
              <text
                x={M.left - 8}
                y={y(t) + 4}
                textAnchor="end"
                className="fill-ink-faint font-mono"
                fontSize={11}
              >
                {fmt(t)}
              </text>
            </g>
          ))}
          {ticks(xMax, 4).map((t) => (
            <text
              key={`x${t}`}
              x={x(t)}
              y={M.top + ph + 18}
              textAnchor="middle"
              className="fill-ink-faint font-mono"
              fontSize={11}
            >
              {fmt(t)}
            </text>
          ))}
          <text
            x={M.left + pw / 2}
            y={H - 4}
            textAnchor="middle"
            className="fill-ink-muted font-sans"
            fontSize={12}
          >
            n (input size)
          </text>
          <text
            transform={`translate(12 ${M.top + ph / 2}) rotate(-90)`}
            textAnchor="middle"
            className="fill-ink-muted font-sans"
            fontSize={12}
          >
            operations
          </text>
          <line
            x1={x(g.n)}
            x2={x(g.n)}
            y1={M.top}
            y2={M.top + ph}
            stroke="var(--se-active)"
            strokeOpacity={0.6}
            strokeDasharray="4 4"
          />
          <g clipPath="url(#se-growth-plot)">
            {g.curves.map((c, i) => {
              const strong = compared.size === 0 || compared.has(c.id);
              return (
                <g key={c.id} data-curve={c.id}>
                  <path
                    d={path(c.counts, 0, g.ns.length - 1)}
                    fill="none"
                    stroke={color(i)}
                    strokeOpacity={0.3}
                    strokeWidth={1.5}
                    strokeDasharray={DASH[i]}
                  />
                  <path
                    d={path(c.counts, 0, k)}
                    fill="none"
                    stroke={color(i)}
                    strokeWidth={strong ? 3 : 1.75}
                    strokeDasharray={DASH[i]}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </g>
          {g.curves.map((c, i) => {
            const count = c.counts[k];
            const over = count > g.yMax;
            const cx = x(g.n);
            return over ? (
              <g key={c.id} data-marker={c.id}>
                <path
                  d={`M${cx - 6} ${M.top + 8} L${cx} ${M.top} L${cx + 6} ${M.top + 8} Z`}
                  fill={color(i)}
                />
                <text x={cx + 9} y={M.top + 9} className="fill-ink font-mono" fontSize={11}>
                  {`${c.label} = ${fmt(count)}`}
                </text>
              </g>
            ) : (
              <circle
                key={c.id}
                data-marker={c.id}
                cx={cx}
                cy={y(count)}
                r={compared.has(c.id) ? 6 : 4.5}
                fill={color(i)}
                stroke="var(--se-bg)"
                strokeWidth={1.5}
              />
            );
          })}
          {g.curves.map((c, i) => (
            <text
              key={c.id}
              x={M.left + pw + 8}
              y={(labelY.get(c.id) ?? 0) + 4}
              className="font-mono"
              fill={color(i)}
              fontSize={12}
              fontWeight={compared.has(c.id) ? 700 : 500}
            >
              {c.label}
            </text>
          ))}
        </svg>
        {g.caption ? (
          <p className="font-sans text-sm text-ink" data-caption>
            {g.caption}
          </p>
        ) : null}
      </div>
      <table className="h-fit shrink-0 self-start rounded-lg border border-hairline bg-surface font-mono text-sm">
        <caption className="px-3 pt-2 text-left font-sans text-[10px] uppercase tracking-wide text-ink-faint">
          Operations at n = {fmt(g.n)}
        </caption>
        <tbody>
          {g.curves.map((c, i) => (
            <tr key={c.id} className={compared.has(c.id) ? 'bg-active-soft' : ''} data-row={c.id}>
              <td className="py-1 pl-3 pr-2">
                <svg width="28" height="10" aria-hidden="true">
                  <line
                    x1="1"
                    x2="27"
                    y1="5"
                    y2="5"
                    stroke={color(i)}
                    strokeWidth="3"
                    strokeDasharray={DASH[i]}
                  />
                </svg>
              </td>
              <td className="py-1 pr-4 text-ink">{c.label}</td>
              <td className="py-1 pr-3 text-right font-semibold text-ink">{fmt(c.counts[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default GrowthView;
