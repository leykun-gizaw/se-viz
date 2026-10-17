/**
 * Statistics concept view (Phase 37, `view: 'distribution'`): a histogram that builds as values are
 * drawn. Data-driven from {@link Step.distribution}.
 *
 * - **Sampling mode:** the skewed population above (the latest sample marked on it), the histogram
 *   of sample means below, with the normal curve the central limit theorem predicts (dashed).
 * - **Hypothesis mode:** the observed data as dot strips, the null distribution with the observed
 *   statistic marked (and its mirror image for a two-tailed test), the tail bins shaded, and the
 *   p-value as the count it is.
 *
 * The y axis fits the tallest bar of the step, so the shape reads at every stage of the build.
 */
import type { ReactNode } from 'react';
import type { DistributionBin, DistributionStep, Step } from '../../engine/trace/types.ts';

const W = 640;
const fixed = (x: number, d: number) => {
  const s = x.toFixed(d);
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s.replace(/^-/, '−');
};

function Chip({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-baseline gap-1.5 rounded-md border px-2.5 py-1 ${
        strong ? 'border-active bg-active-soft' : 'border-hairline bg-surface'
      }`}
    >
      <span className="font-sans text-[10px] uppercase tracking-wide text-ink-faint">{label}</span>
      <span className="font-mono text-sm font-semibold text-ink">{value}</span>
    </span>
  );
}

interface Scale {
  x: (v: number) => number;
  lo: number;
  hi: number;
}

function xScale(bins: DistributionBin[], left: number, width: number): Scale {
  const lo = bins[0].from;
  const hi = bins[bins.length - 1].to;
  return { x: (v) => left + ((v - lo) / (hi - lo)) * width, lo, hi };
}

/** Round-number ticks inside `[lo, hi]`. */
function niceTicks(lo: number, hi: number, target = 6): number[] {
  const raw = (hi - lo) / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step)
    out.push(Math.round(t / step) * step);
  return out;
}

const decimalsFor = (ticks: number[]) =>
  Math.max(
    0,
    ...ticks.map((t) => (Number.isInteger(t) ? 0 : (String(t).split('.')[1] ?? '').length)),
  );

/** The bin a value falls in (by position, for a marker). */
function binOf(bins: DistributionBin[], v: number): number {
  const i = bins.findIndex((b) => v >= b.from && v < b.to);
  return i >= 0 ? i : v < bins[0].from ? 0 : bins.length - 1;
}

/** The histogram bars, an x axis with ticks and a label. Returns its own height. */
function Histogram({
  bins,
  top,
  height,
  fill,
  label,
  shade,
  marks = [],
  children,
}: {
  bins: DistributionBin[];
  top: number;
  height: number;
  fill: string;
  label: string;
  shade?: ((b: DistributionBin) => boolean) | undefined;
  /** Values drawn this step: each gets a marker above its bar. */
  marks?: readonly number[];
  children?: (s: Scale, y: (count: number) => number) => ReactNode;
}) {
  const left = 40;
  const width = W - left - 16;
  const s = xScale(bins, left, width);
  const max = Math.max(1, ...bins.map((b) => b.count));
  const base = top + height;
  const y = (c: number) => base - (c / max) * (height - 8);
  const ticks = niceTicks(s.lo, s.hi);
  const d = decimalsFor(ticks);
  return (
    <g>
      {[0, max].map((c) => (
        <text
          key={c}
          x={left - 6}
          y={y(c) + 4}
          textAnchor="end"
          className="fill-ink-faint font-mono"
          fontSize={10}
        >
          {c}
        </text>
      ))}
      {bins.map((b, i) => {
        const x0 = s.x(b.from);
        const x1 = s.x(b.to);
        const tail = shade?.(b) ?? false;
        return b.count > 0 ? (
          <rect
            key={i}
            data-bin={i}
            data-tail={tail || undefined}
            x={x0 + 0.5}
            y={y(b.count)}
            width={Math.max(1, x1 - x0 - 1)}
            height={base - y(b.count)}
            fill={tail ? 'var(--se-cv-tail)' : fill}
          />
        ) : null;
      })}
      <line x1={left} x2={left + width} y1={base} y2={base} stroke="var(--se-border-strong)" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={s.x(t)} x2={s.x(t)} y1={base} y2={base + 4} stroke="var(--se-border-strong)" />
          <text
            x={s.x(t)}
            y={base + 16}
            textAnchor="middle"
            className="fill-ink-faint font-mono"
            fontSize={10}
          >
            {fixed(t, d)}
          </text>
        </g>
      ))}
      <text
        x={left + width / 2}
        y={base + 32}
        textAnchor="middle"
        className="fill-ink-muted font-sans"
        fontSize={11}
      >
        {label}
      </text>
      {children?.(s, y)}
      {marks.map((v, i) => {
        const bin = bins[binOf(bins, v)];
        const my = y(bin.count) - 3 - (i % 3) * 9;
        return (
          <path
            key={i}
            data-mark={i}
            d={`M${s.x(v) - 5} ${my - 8} L${s.x(v) + 5} ${my - 8} L${s.x(v)} ${my} Z`}
            fill="var(--se-cv-compared)"
            stroke="var(--se-bg)"
            strokeWidth={1}
          />
        );
      })}
    </g>
  );
}

function Sampling({ d }: { d: DistributionStep }) {
  const pop = d.population;
  const popH = 110;
  const mainTop = pop ? popH + 58 : 8;
  const mainH = 200;
  const height = mainTop + mainH + 40;
  const binW = d.bins[0].to - d.bins[0].from;
  return (
    <svg
      role="img"
      aria-label={`Histogram of ${d.draws} sample means${d.stats ? `: mean ${fixed(d.stats.mean, 2)}, standard deviation ${fixed(d.stats.sd, 2)}` : ''}.`}
      viewBox={`0 0 ${W} ${height}`}
      className="min-h-0 w-full flex-1"
      data-concept="distribution"
      data-mode="sampling"
    >
      {pop ? (
        <>
          <text x={40} y={12} className="fill-ink-muted font-sans" fontSize={11} fontWeight={600}>
            {`Population (${pop.size.toLocaleString('en-US')} values) · mean ${fixed(pop.mean, 2)} · skewness ${fixed(pop.skewness, 2)}`}
          </text>
          <Histogram
            bins={pop.bins}
            top={18}
            height={popH - 18}
            fill="var(--se-cv-population)"
            label={pop.xLabel}
          >
            {(s, y) => (
              <>
                <line
                  x1={s.x(pop.mean)}
                  x2={s.x(pop.mean)}
                  y1={18}
                  y2={y(0)}
                  stroke="var(--se-text)"
                  strokeDasharray="3 3"
                />
                {(pop.sample ?? []).map((v, i) => (
                  <circle
                    key={i}
                    cx={s.x(v)}
                    cy={y(0) - 4}
                    r={3}
                    fill="var(--se-cv-compared)"
                    stroke="var(--se-bg)"
                    strokeWidth={1}
                    data-sample
                  />
                ))}
              </>
            )}
          </Histogram>
        </>
      ) : null}
      <text
        x={40}
        y={mainTop - 6}
        className="fill-ink-muted font-sans"
        fontSize={11}
        fontWeight={600}
      >
        {`Sample means (samples of ${d.sampleSize ?? '?'})`}
      </text>
      <Histogram
        bins={d.bins}
        top={mainTop}
        height={mainH}
        fill="var(--se-cv-hist)"
        label={d.xLabel}
        marks={d.latest ?? []}
      >
        {(s, y) => {
          const nrm = d.normal;
          if (!nrm || d.draws === 0) return null;
          const pts: string[] = [];
          const steps = 120;
          for (let i = 0; i <= steps; i++) {
            const v = s.lo + ((s.hi - s.lo) * i) / steps;
            const z = (v - nrm.mean) / nrm.sd;
            const c = (d.draws * binW * Math.exp(-0.5 * z * z)) / (nrm.sd * Math.sqrt(2 * Math.PI));
            pts.push(
              `${i === 0 ? 'M' : 'L'}${s.x(v).toFixed(1)} ${Math.max(mainTop - 4, y(c)).toFixed(1)}`,
            );
          }
          return (
            <path
              d={pts.join(' ')}
              fill="none"
              stroke="var(--se-text)"
              strokeWidth={2}
              strokeDasharray="6 4"
              data-normal
            />
          );
        }}
      </Histogram>
    </svg>
  );
}

function Hypothesis({ d }: { d: DistributionStep }) {
  const t = d.test;
  const groups = d.groups ?? [];
  const stripH = 26;
  const groupsH = groups.length > 0 ? groups.length * stripH + 30 : 0;
  const mainTop = groupsH + 30;
  const mainH = 210;
  const height = mainTop + mainH + 40;
  const reach = t ? Math.abs(t.observed - t.center) : 0;
  const shade = t
    ? (b: DistributionBin) =>
        t.tail === 'right'
          ? b.from >= t.observed - 1e-9
          : t.tail === 'left'
            ? b.to <= t.observed + 1e-9
            : b.from >= t.center + reach - 1e-9 || b.to <= t.center - reach + 1e-9
    : undefined;

  // Dot strips share one scale across both groups.
  const all = groups.flatMap((g) => g.values);
  const gLo = Math.floor(Math.min(...all, Infinity));
  const gHi = Math.ceil(Math.max(...all, -Infinity));
  const gx = (v: number) => 120 + ((v - gLo) / Math.max(1, gHi - gLo)) * (W - 120 - 24);

  return (
    <svg
      role="img"
      aria-label={`Null distribution of ${d.draws} shuffled differences${t ? `; observed ${fixed(t.observed, 2)}; ${t.extreme} at least as extreme` : ''}.`}
      viewBox={`0 0 ${W} ${height}`}
      className="min-h-0 w-full flex-1"
      data-concept="distribution"
      data-mode="hypothesis"
    >
      {groups.map((g, gi) => {
        const cy = 18 + gi * stripH;
        return (
          <g key={g.label} data-group={g.label}>
            <text x={8} y={cy + 4} className="fill-ink-muted font-sans" fontSize={11}>
              {g.label}
            </text>
            <line x1={gx(gLo)} x2={gx(gHi)} y1={cy} y2={cy} stroke="var(--se-border)" />
            {g.values.map((v, i) => (
              <circle
                key={i}
                cx={gx(v)}
                cy={cy}
                r={4}
                fill={gi === 0 ? 'var(--se-cv-sorted)' : 'var(--se-cv-hist)'}
                stroke="var(--se-bg)"
                strokeWidth={1}
              />
            ))}
            <line
              x1={gx(g.mean)}
              x2={gx(g.mean)}
              y1={cy - 9}
              y2={cy + 9}
              stroke="var(--se-text)"
              strokeWidth={2}
            />
            <text x={gx(g.mean) + 5} y={cy - 7} className="fill-ink font-mono" fontSize={10}>
              {`mean ${fixed(g.mean, 2)}`}
            </text>
          </g>
        );
      })}
      {groups.length > 0 ? (
        <text
          x={gx(gLo)}
          y={groups.length * stripH + 18}
          className="fill-ink-faint font-mono"
          fontSize={10}
        >
          {`${gLo} – ${gHi} cm`}
        </text>
      ) : null}
      <text
        x={40}
        y={mainTop - 8}
        className="fill-ink-muted font-sans"
        fontSize={11}
        fontWeight={600}
      >
        {`Null distribution: ${d.draws.toLocaleString('en-US')} shuffle${d.draws === 1 ? '' : 's'}`}
      </text>
      <Histogram
        bins={d.bins}
        top={mainTop}
        height={mainH}
        fill="var(--se-cv-hist)"
        label={d.xLabel}
        marks={d.latest ?? []}
        shade={shade}
      >
        {(s, y) =>
          t ? (
            <>
              {(t.tail === 'two' ? [-1, 1] : [t.tail === 'right' ? 1 : -1]).map((side) => {
                const edge = t.center + side * reach;
                const x0 = side > 0 ? s.x(edge) : s.x(s.lo);
                const x1 = side > 0 ? s.x(s.hi) : s.x(edge);
                return (
                  <rect
                    key={side}
                    data-tail-band={side}
                    x={x0}
                    y={y(0) - 3}
                    width={Math.max(0, x1 - x0)}
                    height={3}
                    fill="var(--se-cv-tail)"
                  />
                );
              })}
              {[t.observed, ...(t.tail === 'two' ? [2 * t.center - t.observed] : [])].map(
                (v, i) => (
                  <g key={i} data-observed={i === 0 ? 'observed' : 'mirror'}>
                    <line
                      x1={s.x(v)}
                      x2={s.x(v)}
                      y1={mainTop - 2}
                      y2={y(0)}
                      stroke="var(--se-text)"
                      strokeWidth={2}
                      strokeDasharray={i === 0 ? undefined : '5 4'}
                    />
                    <text
                      x={s.x(v) + (v >= t.center ? 5 : -5)}
                      y={mainTop + 10}
                      textAnchor={v >= t.center ? 'start' : 'end'}
                      className="fill-ink font-mono"
                      fontSize={11}
                      fontWeight={700}
                    >
                      {i === 0 ? `observed ${fixed(v, 2)}` : fixed(v, 2)}
                    </text>
                  </g>
                ),
              )}
            </>
          ) : null
        }
      </Histogram>
    </svg>
  );
}

export function DistributionView({ step }: { step: Step }) {
  const d = step.distribution;
  if (!d) return null;
  const t = d.test;
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto rounded-lg border border-hairline bg-bg p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          label={d.mode === 'sampling' ? 'Sample means' : 'Shuffles'}
          value={d.draws.toLocaleString('en-US')}
        />
        {d.stats ? (
          <>
            <Chip label="Mean" value={fixed(d.stats.mean, 2)} />
            <Chip label="SD" value={fixed(d.stats.sd, 2)} />
            {d.mode === 'sampling' ? (
              <Chip label="Skewness" value={fixed(d.stats.skewness, 2)} />
            ) : null}
          </>
        ) : null}
        {t ? (
          <>
            <Chip label="Test" value={t.tail === 'two' ? 'two-tailed' : 'one-tailed'} />
            <Chip
              label="As extreme"
              value={`${t.extreme.toLocaleString('en-US')} / ${d.draws.toLocaleString('en-US')}`}
            />
            <Chip
              label="p-value"
              value={d.draws > 0 ? fixed(t.pValue, 3) : '—'}
              strong={d.draws > 0 && t.pValue < t.alpha}
            />
          </>
        ) : null}
      </div>
      {d.mode === 'sampling' ? <Sampling d={d} /> : <Hypothesis d={d} />}
    </div>
  );
}

export default DistributionView;
