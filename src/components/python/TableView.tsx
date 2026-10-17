/**
 * The pandas view of the Python canvas (Phase 35): DataFrame, Series and GroupBy boxes, and the
 * dashed "from" links between a table and the one it was made from.
 *
 * - **DataFrame:** a header row (column names, and a dtype line with the missing count), an index
 *   column, zebra rows, and a "showing 20 of 1,200 rows" footer when capped. **Series:** the same,
 *   with one value column. **GroupBy:** the keys, then one mini table per group (its label, size and
 *   first rows), stacked.
 * - **Wide tables scroll inside their box** (the box is at most 44rem wide); they never widen the
 *   page.
 * - **Motion** (from `pyMotion.ts`): a changed value pulses green (the shared value slot); a column
 *   added in place slides in; rows sorted in place glide to their new places, by index label; a
 *   table made by a filter first shows its source's rows, the dropped ones struck through, which
 *   then fade while the kept rows close up, with a "kept 7 of 20 rows" chip; a sorted copy starts in
 *   its source's order and its rows glide into the new one. No motion after a jump or with reduced
 *   motion: the final state shows at once, and the chip and the green marks stay.
 *
 * @packageDocumentation
 */
import { AnimatePresence, motion, PresenceContext } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useAnchors } from '../../engine/anchorContext.ts';
import {
  columnId,
  columnKeys,
  displayText,
  isGroupBy,
  isMissing,
  isTable,
  rowCount,
  rowId,
  tableRows,
  thousands,
  type GroupByBlock,
  type TableBlock,
} from '../../engine/trace/pandas.ts';
import type { Cell, HeapBlock, Step } from '../../engine/trace/types.ts';
import { useMotionCues, type TableEntrance } from './pyMotion.ts';
import { SlotValue } from './PySlot.tsx';
import { cellText } from './ndLayout.ts';
import { columnWidth, fromLinkPath, showingText, template, useDerived } from './tableLayout.ts';

const CELL_TEXT = 'whitespace-pre font-mono text-[12px] text-ink';
const MISSING_TEXT = 'whitespace-pre font-mono text-[12px] italic text-ink-faint';
const SPRING = { type: 'spring', stiffness: 300, damping: 30 } as const;
/** dtypes whose values are text. */
const TEXT_DTYPES = /^(str|string|object|category)/;

/** The header facts of a table box: its shape (rows × columns, or length). */
export function TableHeading({ block }: { block: HeapBlock }) {
  if (isTable(block)) {
    const [rows, cols] = block.table.shape;
    return (
      <span className="font-mono text-[11px] text-ink">
        {block.table.kind === 'series'
          ? `${thousands(rows ?? 0)} values`
          : `${thousands(rows ?? 0)} × ${thousands(cols ?? 0)}`}
      </span>
    );
  }
  if (isGroupBy(block)) {
    return (
      <span className="font-mono text-[11px] text-ink">
        by {block.groupby.keys.join(', ')} · {block.groupby.ngroups}{' '}
        {block.groupby.ngroups === 1 ? 'group' : 'groups'}
      </span>
    );
  }
  return null;
}

/** A value as a table shows it: pandas' text (no quotes, `NaN`), a long float shortened. */
const tableText = (v: string) => cellText(displayText(v));

/** One value: the shared slot (pulse, cross-fade), a missing value faint and italic. */
function Value({ cell }: { cell: Cell | undefined }) {
  if (!cell) return <span className={MISSING_TEXT}> </span>;
  return (
    <SlotValue
      cell={cell}
      format={tableText}
      textClass={isMissing(cell) ? MISSING_TEXT : CELL_TEXT}
    />
  );
}

/** A cell of a column that just slid in (its own presence scope, so the slide plays). */
function Slide({ on, children }: { on: boolean; children: React.ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <PresenceContext.Provider value={null}>
      <motion.span
        className="block"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {children}
      </motion.span>
    </PresenceContext.Provider>
  );
}

interface ShownRow {
  key: string;
  label: string;
  cells: (Cell | undefined)[];
  /** During a filter's entrance: `false` for a row the filter dropped. */
  kept?: boolean;
}

/** Which rows to draw, and in what order, for this render (the entrance's first beat, or the end). */
function useShownRows(block: TableBlock): { rows: ShownRow[]; entering: TableEntrance | null } {
  const cues = useMotionCues();
  const entrance = cues.animate ? (cues.tables.get(block.id) ?? null) : null;
  // Each step change derives new cues, so a new entrance object: it plays once per arrival.
  const [settled, setSettled] = useState<TableEntrance | null>(null);
  const pending = entrance !== null && settled !== entrance;
  useEffect(() => {
    if (!entrance) return;
    // The first beat (the source's rows, or its order) holds while the box pops in.
    const t = window.setTimeout(() => setSettled(entrance), entrance.kind === 'filter' ? 700 : 450);
    return () => window.clearTimeout(t);
  }, [entrance]);
  const final = tableRows(block);
  if (!pending || !entrance) return { rows: final, entering: null };
  if (entrance.kind === 'filter') return { rows: entrance.rows, entering: entrance };
  const byKey = new Map(final.map((r) => [r.key, r]));
  return {
    rows: entrance.start.map((k) => byKey.get(k)).filter((r): r is ShownRow => r !== undefined),
    entering: entrance,
  };
}

/** A DataFrame's or Series' table, footer and chips. */
function TableGrid({ block }: { block: TableBlock }) {
  const cues = useMotionCues();
  const derived = useDerived().get(block.id);
  const { rows, entering } = useShownRows(block);
  const series = block.table.kind === 'series';
  const cols = columnKeys(block);
  const columns = block.table.columns;
  const widths = useMemo(() => {
    const all = tableRows(block);
    const index = columnWidth([block.table.indexName ?? '', ...block.table.rowLabels]);
    const data = cols.map((_, j) => {
      const c = columns[j];
      const head = series ? (block.table.name ?? '') : (c?.name ?? '');
      const dtype = c ? `${c.dtype}${c.missing > 0 ? ` · ${c.missing} NaN` : ''}` : '';
      return columnWidth([
        head,
        dtype,
        ...all.map((r) => {
          const cell = r.cells[j];
          return cell?.kind === 'scalar' ? tableText(String(cell.value)) : '';
        }),
      ]);
    });
    return [index, ...data];
  }, [block, cols, columns, series]);
  const grid = template(widths);
  // Text columns read from the left, numbers from the right (so their digits line up).
  const align = cols.map((_, j) =>
    TEXT_DTYPES.test(columns[j]?.dtype ?? '') ? 'text-left' : 'text-right',
  );
  const order = rows.map((r) => r.key).join('\u0000');
  const glide = cues.reduce ? false : ('position' as const);
  const filter = derived?.relation.kind === 'filter' ? derived.relation : null;
  const showing = showingText(
    block.table.rowKeys.length,
    rowCount(block),
    series ? null : columns.length,
    series ? null : (block.table.shape[1] ?? 0),
    series ? 'values' : 'rows',
  );

  if (block.table.rowKeys.length === 0 && !entering) {
    return (
      <div className="px-2.5 py-1.5 font-mono text-xs text-ink-faint">
        empty {series ? 'Series' : 'DataFrame'}
        {!series ? ` · ${columns.length} columns` : ''}
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-full overflow-x-auto p-1.5" data-pd-table={block.id}>
        {/* The font is set here so the `ch` column widths are the cells' own characters. */}
        <div className="w-max font-mono text-[12px]">
          <div
            className="grid items-end border-b border-hairline-strong pb-0.5"
            style={{ gridTemplateColumns: grid }}
          >
            <span className="truncate px-1 font-mono text-[10px] text-ink-faint">
              {block.table.indexName ?? ''}
            </span>
            {cols.map((key, j) => {
              const c = columns[j];
              const name = series ? (block.table.name ?? '') : (c?.name ?? '');
              return (
                <span key={key ?? 'values'} className={`min-w-0 px-1 ${align[j]}`}>
                  <Slide
                    on={cues.animate && key !== null && cues.entering.has(columnId(block.id, key))}
                  >
                    <span
                      className="block truncate font-mono text-[12px] font-semibold text-ink"
                      title={name}
                    >
                      {name || (series ? 'values' : '')}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-ink-faint">
                      {c?.dtype}
                      {c && c.missing > 0 ? (
                        <span className="text-active"> · {c.missing} NaN</span>
                      ) : null}
                    </span>
                  </Slide>
                </span>
              );
            })}
          </div>
          <AnimatePresence initial={false} custom={cues.animate}>
            {rows.map((row, i) => {
              const ghost = row.kept === false;
              const marked = entering?.kind === 'filter';
              return (
                <motion.div
                  key={ghost ? `ghost:${row.key}` : row.key}
                  layout={glide}
                  layoutDependency={order}
                  data-pd-row={`${block.id}:${row.key}`}
                  initial={
                    cues.animate && cues.entering.has(rowId(block.id, row.key))
                      ? { opacity: 0, x: -10 }
                      : false
                  }
                  animate={{ opacity: 1, x: 0 }}
                  exit={
                    cues.animate
                      ? { opacity: 0, height: 0, transition: { duration: 0.45, ease: 'easeInOut' } }
                      : { opacity: 0, transition: { duration: 0 } }
                  }
                  transition={cues.animate ? SPRING : { duration: 0 }}
                  className={`grid items-baseline overflow-hidden ${
                    ghost
                      ? 'bg-danger-soft line-through decoration-danger'
                      : marked
                        ? 'bg-changed-soft'
                        : i % 2 === 1
                          ? 'bg-surface-2'
                          : ''
                  }`}
                  style={{ gridTemplateColumns: grid }}
                >
                  <span className="truncate px-1 py-px font-mono text-[11px] text-ink-faint">
                    {row.label}
                  </span>
                  {row.cells.map((cell, j) => {
                    const key = cols[j];
                    return (
                      <span
                        key={key ?? 'values'}
                        className={`min-w-0 truncate px-1 py-px ${align[j]}`}
                      >
                        <Slide
                          on={
                            cues.animate &&
                            key !== null &&
                            key !== undefined &&
                            cues.entering.has(columnId(block.id, key))
                          }
                        >
                          <Value cell={cell} />
                        </Slide>
                      </span>
                    );
                  })}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
      {showing || filter ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-2.5 py-1">
          {filter ? (
            <span className="rounded-full border border-changed bg-changed-soft px-2 py-px font-sans text-[10px] font-semibold text-changed">
              kept {thousands(filter.keptCount)} of {thousands(filter.of)} rows
            </span>
          ) : null}
          {showing ? <span className="font-sans text-[10px] text-ink-faint">{showing}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** A GroupBy: what it groups by, then each group's label, size and first rows. */
function GroupByStack({ block }: { block: GroupByBlock }) {
  const g = block.groupby;
  const obj = block.cells.find((c) => c.name === 'obj');
  const widths = useMemo(() => {
    const index = columnWidth(g.groups.flatMap((x) => x.rowLabels));
    const data = g.columns.map((c, j) =>
      columnWidth([
        c.name,
        c.dtype,
        ...g.groups.flatMap((x) => x.rows.map((r) => tableText(r[j] ?? ''))),
      ]),
    );
    return [index, ...data];
  }, [g]);
  const grid = template(widths);
  const keys = g.keys.join(', ');
  const showing = showingText(
    g.groups.length,
    g.ngroups,
    g.columns.length,
    g.columns.length + g.columnsOmitted,
    'groups',
  );
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-hairline px-2.5 py-1 font-sans text-[11px] text-ink-muted">
        <span>
          {thousands(g.rowsTotal)} rows split by {keys}
        </span>
        {obj ? (
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-ink-faint">
            obj <SlotValue cell={obj} />
          </span>
        ) : null}
      </div>
      <div className="max-w-full overflow-x-auto p-1.5">
        <div className="flex w-max flex-col gap-2 font-mono text-[12px]">
          {g.groups.map((group) => (
            <div key={group.key} className="rounded-md border border-hairline">
              <div className="flex items-baseline gap-2 border-b border-hairline bg-surface-2 px-1.5 py-0.5">
                <span className="font-mono text-[11px] font-semibold text-heap">
                  {keys} = {group.label}
                </span>
                <span className="font-mono text-[10px] text-ink-muted">
                  {group.size} {group.size === 1 ? 'row' : 'rows'}
                </span>
              </div>
              <div className="grid" style={{ gridTemplateColumns: grid }}>
                <span />
                {g.columns.map((c) => (
                  <span
                    key={c.key}
                    className={`truncate px-1 font-mono text-[10px] text-ink-faint ${
                      TEXT_DTYPES.test(c.dtype) ? 'text-left' : 'text-right'
                    }`}
                  >
                    {c.name}
                  </span>
                ))}
              </div>
              {group.rows.map((r, i) => (
                <div
                  key={`${group.key}:${group.rowLabels[i] ?? i}`}
                  className={`grid items-baseline ${i % 2 === 1 ? 'bg-surface-2' : ''}`}
                  style={{ gridTemplateColumns: grid }}
                >
                  <span className="truncate px-1 py-px font-mono text-[11px] text-ink-faint">
                    {group.rowLabels[i]}
                  </span>
                  {r.map((v, j) => (
                    <span
                      key={g.columns[j]?.key ?? j}
                      className={`truncate px-1 py-px ${
                        TEXT_DTYPES.test(g.columns[j]?.dtype ?? '') ? 'text-left' : 'text-right'
                      } ${['nan', 'None', '<NA>', 'NaT'].includes(v) ? MISSING_TEXT : CELL_TEXT}`}
                    >
                      {tableText(v)}
                    </span>
                  ))}
                </div>
              ))}
              {group.size > group.rows.length ? (
                <div className="px-1.5 py-px font-mono text-[10px] text-ink-faint">
                  … {group.size - group.rows.length} more{' '}
                  {group.size - group.rows.length === 1 ? 'row' : 'rows'}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      {showing ? (
        <div className="border-t border-hairline px-2.5 py-1 font-sans text-[10px] text-ink-faint">
          {showing}
        </div>
      ) : null}
    </div>
  );
}

/** A DataFrame, Series or GroupBy box's body. */
export function TableBody({ block }: { block: HeapBlock }) {
  if (isTable(block)) return <TableGrid block={block} />;
  if (isGroupBy(block)) return <GroupByStack block={block} />;
  return null;
}

/** Dashed "from" links from every derived pandas object on screen to the one it was made from. */
export function FromLinks({ step }: { step: Step }) {
  const { getAnchor, version } = useAnchors();
  const derived = useDerived();
  const links = useMemo(() => {
    void version; // re-measure on every anchor change
    const out: { id: string; d: string; label: { x: number; y: number } }[] = [];
    let lane = 0;
    const here = new Set(step.heap.map((b) => b.id));
    for (const block of step.heap) {
      const d = derived.get(block.id);
      if (!d || !here.has(d.source)) continue;
      // A GroupBy already refers to the table it groups: its reference arrow says it.
      if (block.cells.some((c) => c.kind === 'pointer' && c.target === d.source)) continue;
      const made = getAnchor(block.id);
      const source = getAnchor(d.source);
      if (!made || !source) continue;
      out.push({ id: block.id, ...fromLinkPath(made, source, lane++) });
    }
    return out;
  }, [getAnchor, version, step, derived]);
  if (links.length === 0) return null;
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="se-from"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--se-static)" />
        </marker>
      </defs>
      {links.map((l) => (
        <path
          key={l.id}
          d={l.d}
          fill="none"
          stroke="var(--se-static)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          markerEnd="url(#se-from)"
        />
      ))}
      {links.map((l) => (
        <text
          key={`${l.id}-label`}
          x={l.label.x}
          y={l.label.y}
          fill="var(--se-static)"
          stroke="var(--se-bg)"
          strokeWidth={4}
          paintOrder="stroke"
          fontSize={10}
          fontFamily="var(--font-mono, monospace)"
          dominantBaseline="middle"
        >
          from
        </text>
      ))}
    </svg>
  );
}
