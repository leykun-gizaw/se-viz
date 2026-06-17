import { describe, expect, it } from 'vitest';
import type { Cell, StaticSegment } from '../../engine/trace/types.ts';
import { hasStaticData, showStaticRegion, visibleStaticTrays } from './staticRegion.ts';

const scalar = (id: string): Cell => ({ kind: 'scalar', id, name: id, type: 'int', value: 0 });

const empty: StaticSegment = { data: [], bss: [], rodata: [] };
const dataOnly: StaticSegment = { data: [scalar('g.counter')], bss: [], rodata: [] };
const allThree: StaticSegment = {
  data: [scalar('g.counter')],
  bss: [scalar('g.total')],
  rodata: [scalar('g.rows')],
};

describe('staticRegion — sub-tray selection (Phase 24)', () => {
  it('renders only the non-empty sub-trays by default (auto)', () => {
    const trays = visibleStaticTrays(dataOnly, false);
    expect(trays.map((t) => t.key)).toEqual(['data']);
    expect(trays[0].label).toBe('.data');
  });

  it('renders all three sub-trays in canonical order when showAll (the lesson hint)', () => {
    const trays = visibleStaticTrays(empty, true);
    expect(trays.map((t) => t.label)).toEqual(['.data', '.bss', '.rodata']);
    // …even though every one is empty
    expect(trays.every((t) => t.cells.length === 0)).toBe(true);
  });

  it('shows every present tray when all three have cells', () => {
    expect(visibleStaticTrays(allThree, false).map((t) => t.key)).toEqual(['data', 'bss', 'rodata']);
  });

  it('hasStaticData is true only when some sub-segment has a cell', () => {
    expect(hasStaticData(undefined)).toBe(false);
    expect(hasStaticData(empty)).toBe(false);
    expect(hasStaticData(dataOnly)).toBe(true);
  });

  it('showStaticRegion: hidden when absent/empty (auto), shown with the full-map hint', () => {
    // A staticData-less step draws no static region → renders exactly as before.
    expect(showStaticRegion(undefined, false)).toBe(false);
    expect(showStaticRegion(undefined, true)).toBe(false);
    // Empty segment hidden by default, but forced visible by the layout hint.
    expect(showStaticRegion(empty, false)).toBe(false);
    expect(showStaticRegion(empty, true)).toBe(true);
    // Any cell ⇒ visible regardless of the hint.
    expect(showStaticRegion(dataOnly, false)).toBe(true);
  });
});
