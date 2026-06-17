/**
 * Pure helpers for the static / data region (Phase 24) — kept React-free so the sub-tray selection
 * logic is unit-testable in the node test env (no DOM). The renderer ({@link MemoryCanvas}) only
 * decides *what* to draw from these; *how* it draws is in the component.
 *
 * @packageDocumentation
 */

import type { Cell, StaticSegment } from '../../engine/trace/types.ts';

/** The three sub-segments, in canonical map order (`.data` → `.bss` → `.rodata`). */
export type StaticTrayKey = 'data' | 'bss' | 'rodata';

/** One sub-tray ready to render: its key, the segment label, a short gloss, and its cells. */
export interface StaticTray {
  key: StaticTrayKey;
  /** Section name as written in an object file, e.g. `".data"`. */
  label: string;
  /** One-line gloss of what lives here. */
  gloss: string;
  cells: Cell[];
}

/** True when any sub-segment holds at least one cell. */
export function hasStaticData(seg: StaticSegment | undefined): seg is StaticSegment {
  return !!seg && (seg.data.length > 0 || seg.bss.length > 0 || seg.rodata.length > 0);
}

/**
 * Whether to draw the static region at all this step: when the step has any static cells, or when
 * the layout hint forces the full map (`staticLayout: 'full'`) and a segment object exists to show.
 */
export function showStaticRegion(seg: StaticSegment | undefined, showAll: boolean): seg is StaticSegment {
  return !!seg && (showAll || hasStaticData(seg));
}

/**
 * The sub-trays to render, in canonical order. With `showAll` (the memory-layout-lesson hint) all
 * three appear even when empty so the full map reads; otherwise only the non-empty ones show.
 */
export function visibleStaticTrays(seg: StaticSegment, showAll: boolean): StaticTray[] {
  const all: StaticTray[] = [
    { key: 'data', label: '.data', gloss: 'initialized globals', cells: seg.data },
    { key: 'bss', label: '.bss', gloss: 'zeroed globals', cells: seg.bss },
    { key: 'rodata', label: '.rodata', gloss: 'read-only / literals', cells: seg.rodata },
  ];
  return showAll ? all : all.filter((t) => t.cells.length > 0);
}
