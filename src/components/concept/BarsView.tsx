/**
 * Search and sort concept view (Phase 37, `view: 'bars'`): the array as bars with their values and
 * indices, and what the step looked at — compared bars (amber), swapped or written bars (green),
 * the sorted region (teal), a search range (bars outside it dimmed), labelled pointers (`low`,
 * `mid`, `high`, `i`, `j`, …) and, for merge sort, the split tree as one row per level. Counters
 * sit in the header. Data-driven from {@link Step.bars}; bars with a stable key slide to their new
 * place (no motion with `prefers-reduced-motion`).
 */
import type { BarsSegment, BarsStep, Step } from '../../engine/trace/types.ts';

const SLOT = 56;
const BAR = 40;
const CHART = 200;
const TOP = 26;
const POINTER_ROW = 16;
const LEVEL_ROW = 22;

type BarState = 'idle' | 'sorted' | 'compared' | 'swapped';

const FILL: Record<BarState, string> = {
  idle: 'var(--se-cv-idle)',
  sorted: 'var(--se-cv-sorted)',
  compared: 'var(--se-cv-compared)',
  swapped: 'var(--se-cv-swapped)',
};

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1">
      <span className="font-sans text-[10px] uppercase tracking-wide text-ink-faint">{label}</span>
      <span className="font-mono text-sm font-semibold text-ink">{value}</span>
    </span>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-sans text-xs text-ink-muted">
      <span
        aria-hidden="true"
        className="inline-block h-3 w-3 rounded-sm border border-hairline-strong"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

const SEGMENT_STROKE: Record<BarsSegment['state'], string> = {
  idle: 'var(--se-border-strong)',
  split: 'var(--se-text-muted)',
  active: 'var(--se-cv-compared)',
  merged: 'var(--se-cv-sorted)',
};

/** A text summary of the step for screen readers. */
function describeBars(b: BarsStep): string {
  const parts = [`Array [${b.values.join(', ')}]`];
  if (b.compared?.length) parts.push(`comparing indices ${b.compared.join(' and ')}`);
  if (b.swapped?.length) parts.push(`changed at indices ${b.swapped.join(', ')}`);
  if (b.range) parts.push(`range ${b.range.from} to ${b.range.to}`);
  for (const p of b.pointers ?? []) parts.push(`${p.label} at ${p.index}`);
  if (b.found !== undefined) parts.push(`found at index ${b.found}`);
  return `${parts.join('; ')}.`;
}

export function BarsView({ step }: { step: Step }) {
  const b = step.bars;
  if (!b) return null;
  const n = b.values.length;
  const max = Math.max(1, ...b.values);
  const keys = b.keys ?? b.values.map((_, i) => `i${i}`);
  const sorted = new Set(b.sorted ?? []);
  const compared = new Set(b.compared ?? []);
  const swapped = new Set(b.swapped ?? []);
  const writes = b.counters.writes !== undefined;

  const stateOf = (i: number): BarState =>
    swapped.has(i) || b.found === i
      ? 'swapped'
      : compared.has(i)
        ? 'compared'
        : sorted.has(i)
          ? 'sorted'
          : 'idle';
  const dimmed = (i: number) => (b.range ? i < b.range.from || i > b.range.to : false);

  // Pointers stack under their bar (several may share one), in the order given.
  const stacks = new Map<number, string[]>();
  for (const p of b.pointers ?? []) {
    const list = stacks.get(p.index) ?? [];
    list.push(p.label);
    stacks.set(p.index, list);
  }
  const pointerRows = Math.max(1, ...[...stacks.values()].map((l) => l.length));
  const levels = b.segments ? Math.max(...b.segments.map((s) => s.depth)) + 1 : 0;

  const pad = SLOT; // room for a pointer just past either end (-1 or n)
  const width = pad * 2 + n * SLOT;
  const base = TOP + CHART;
  const indexY = base + 16;
  const pointerY = indexY + 18;
  const levelY = pointerY + pointerRows * POINTER_ROW + 10;
  const height = levelY + levels * LEVEL_ROW + 6;
  const slotX = (i: number) => pad + i * SLOT;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto rounded-lg border border-hairline bg-bg p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip label="Comparisons" value={b.counters.comparisons} />
        {b.counters.swaps !== undefined ? <Chip label="Swaps" value={b.counters.swaps} /> : null}
        {writes ? <Chip label="Writes" value={b.counters.writes ?? 0} /> : null}
        {b.target !== undefined ? <Chip label="Target" value={b.target} /> : null}
        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          <Swatch color={FILL.compared} label="compared" />
          <Swatch
            color={FILL.swapped}
            label={b.target !== undefined ? 'found' : writes ? 'written' : 'swapped'}
          />
          {b.target === undefined ? <Swatch color={FILL.sorted} label="sorted" /> : null}
        </span>
      </div>
      <svg
        role="img"
        aria-label={describeBars(b)}
        viewBox={`0 0 ${width} ${height}`}
        className="min-h-0 w-full flex-1"
        data-concept="bars"
      >
        {b.range ? (
          <rect
            x={slotX(b.range.from) + 2}
            y={TOP - 22}
            width={(b.range.to - b.range.from + 1) * SLOT - 4}
            height={CHART + 22 + 22}
            rx={6}
            fill="var(--se-pointer-soft)"
            stroke="var(--se-pointer)"
            strokeOpacity={0.5}
            strokeDasharray="4 3"
          />
        ) : null}
        <line
          x1={pad - 6}
          x2={pad + n * SLOT + 6}
          y1={base}
          y2={base}
          stroke="var(--se-border-strong)"
        />
        {b.values.map((v, i) => {
          const h = Math.max(4, (v / max) * (CHART - 6));
          const state = stateOf(i);
          return (
            <g
              key={keys[i]}
              className="se-cv-move"
              style={{ transform: `translate(${slotX(i)}px, 0px)` }}
              opacity={dimmed(i) ? 0.35 : 1}
              data-bar={i}
              data-state={state}
            >
              <rect
                x={(SLOT - BAR) / 2}
                y={base - h}
                width={BAR}
                height={h}
                rx={4}
                fill={FILL[state]}
                stroke={state === 'idle' ? 'var(--se-border-strong)' : 'none'}
              />
              <text
                x={SLOT / 2}
                y={base - h - 7}
                textAnchor="middle"
                className={`font-mono ${state === 'idle' ? 'fill-ink-muted' : 'fill-ink'}`}
                fontSize={14}
                fontWeight={state === 'idle' ? 400 : 700}
              >
                {v}
              </text>
            </g>
          );
        })}
        {b.values.map((_, i) => (
          <text
            key={i}
            x={slotX(i) + SLOT / 2}
            y={indexY}
            textAnchor="middle"
            className="fill-ink-faint font-mono"
            fontSize={11}
          >
            {i}
          </text>
        ))}
        {[...stacks.entries()].map(([index, labels]) =>
          labels.map((label, row) => (
            <text
              key={label}
              x={slotX(index) + SLOT / 2}
              y={pointerY + row * POINTER_ROW}
              textAnchor="middle"
              className="fill-pointer font-mono"
              fontSize={12}
              fontWeight={600}
              data-pointer={label}
            >
              {row === 0 ? `▲ ${label}` : label}
            </text>
          )),
        )}
        {b.segments
          ? b.segments.map((s) => {
              const y = levelY + s.depth * LEVEL_ROW;
              const x1 = slotX(s.from) + 6;
              const x2 = slotX(s.to + 1) - 6;
              return (
                <g
                  key={`${s.from}-${s.to}`}
                  data-segment={`${s.from}-${s.to}`}
                  data-state={s.state}
                >
                  <path
                    d={`M${x1} ${y - 5} V${y} H${x2} V${y - 5}`}
                    fill="none"
                    stroke={SEGMENT_STROKE[s.state]}
                    strokeWidth={s.state === 'active' ? 3 : 2}
                    strokeDasharray={s.state === 'idle' ? '3 3' : undefined}
                  />
                </g>
              );
            })
          : null}
        {levels > 0 ? (
          <text x={4} y={levelY + 2} className="fill-ink-faint font-sans" fontSize={10}>
            splits
          </text>
        ) : null}
      </svg>
    </div>
  );
}

export default BarsView;
