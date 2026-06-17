import { describe, expect, it } from 'vitest';
import { linkedListTrace } from '../content/fixtures/linkedList.ts';
import { mallocFreeTrace } from '../content/fixtures/mallocFree.ts';
import {
  ARROW_PALETTE_SIZE,
  arrowColorSlots,
  classifyTarget,
  indexStep,
  pointersByTarget,
  resolvePointers,
} from './pointers.ts';
import type { Step } from './trace/types.ts';

function step(trace: { steps: Step[] }, id: string): Step {
  const s = trace.steps.find((st) => st.id === id);
  if (!s) throw new Error(`missing step ${id}`);
  return s;
}

describe('pointer target resolution', () => {
  it('resolves head and current to their heap nodes by stable id', () => {
    const s = step(linkedListTrace, 'advance-1'); // current has just advanced to n1
    const resolved = resolvePointers(s);
    const byId = new Map(resolved.map((r) => [r.id, r]));

    expect(byId.get('head')?.target).toBe('n0');
    expect(byId.get('head')?.targetKind).toBe('block');
    expect(byId.get('current')?.target).toBe('n1');
    expect(byId.get('current')?.targetKind).toBe('block');
  });

  it("classifies the last node's next as a NULL target", () => {
    const s = step(linkedListTrace, 'advance-1');
    const idx = indexStep(s);
    // n2.next points at NULL in the fixture.
    const n2next = idx.cells.get('n2.next');
    expect(n2next?.kind).toBe('pointer');
    if (n2next?.kind === 'pointer') {
      expect(classifyTarget(n2next.target, idx)).toBe('null');
    }
  });

  it('flags a pointer into a freed/dangling block as danger (UB), but not a live one', () => {
    const s = step(mallocFreeTrace, 'leak-c'); // final step: all four allocation states present
    const byId = new Map(resolvePointers(s).map((r) => [r.id, r]));

    expect(byId.get('old')?.target).toBe('b40');
    expect(byId.get('old')?.danger).toBe(true); // b40 is dangling
    expect(byId.get('buf')?.danger).toBe(false); // b0 is allocated
  });

  it('maps targets back to the pointers aiming at them', () => {
    const s = step(linkedListTrace, 'init-current');
    const targeted = pointersByTarget(s);
    // Both head and current aim at n0 initially.
    expect(targeted.get('n0')).toEqual(expect.arrayContaining(['head', 'current']));
  });
});

describe('arrowColorSlots (per-arrow hues)', () => {
  it('gives every id a distinct slot while ids fit the palette', () => {
    const ids = ['head', 'n0.next', 'n1.next', 'n2.next', 'walk'];
    expect(ids.length).toBeLessThanOrEqual(ARROW_PALETTE_SIZE);
    const slots = arrowColorSlots(ids);
    expect(new Set(slots.values()).size).toBe(ids.length);
    for (const slot of slots.values()) {
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThan(ARROW_PALETTE_SIZE);
    }
  });

  it('is deterministic and order-independent (same set → same assignment)', () => {
    const a = arrowColorSlots(['head', 'p', 'n0.next']);
    const b = arrowColorSlots(['n0.next', 'head', 'p']);
    expect(a).toEqual(b);
  });

  it('keeps an id on its hash slot across steps when no collision forces a probe', () => {
    // An id alone always sits on its raw hash slot, so its color is stable as other,
    // non-colliding arrows come and go between steps.
    const alone = arrowColorSlots(['head']).get('head');
    const together = arrowColorSlots(['head', 'zzz-unrelated']).get('head');
    expect(alone).toBe(together);
  });

  it('handles more ids than palette slots without looping or going out of range', () => {
    const ids = Array.from({ length: ARROW_PALETTE_SIZE + 4 }, (_, i) => `ptr-${i}`);
    const slots = arrowColorSlots(ids);
    expect(slots.size).toBe(ids.length);
    for (const slot of slots.values()) {
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThan(ARROW_PALETTE_SIZE);
    }
    // The first PALETTE_SIZE ids (canonical order) still cover every hue exactly once.
    const first = [...ids].sort().slice(0, ARROW_PALETTE_SIZE);
    expect(new Set(first.map((id) => slots.get(id))).size).toBe(ARROW_PALETTE_SIZE);
  });
});

describe('static segment participates in resolution (Phase 24)', () => {
  const s: Step = {
    id: 's',
    index: 0,
    narration: '',
    highlightedLines: [],
    stack: [
      {
        id: 'main',
        name: 'main',
        callId: 0,
        variables: [{ kind: 'pointer', id: 'p', name: 'p', type: 'const char *', target: 'ro.msg' }],
      },
    ],
    heap: [{ id: 'blk', label: 'b', cells: [], state: 'allocated' }],
    staticData: {
      data: [{ kind: 'pointer', id: 'g.table', name: 'table', type: 'void *', target: 'blk' }],
      bss: [],
      rodata: [{ kind: 'scalar', id: 'ro.msg', name: 'msg', type: 'const char[3]', value: '"hi"' }],
    },
  };

  it('resolves a pointer that lives in .data (→ heap block) and a stack pointer into .rodata', () => {
    const r = new Map(resolvePointers(s).map((x) => [x.id, x]));
    expect(r.get('g.table')?.targetKind).toBe('block'); // a static .data pointer → heap
    expect(r.get('p')?.targetKind).toBe('cell'); // a stack pointer → a .rodata cell
  });

  it('indexStep includes static cells so they are resolvable targets', () => {
    expect(indexStep(s).cells.has('ro.msg')).toBe(true);
  });

  it('pointersByTarget includes pointers that live in the static segment', () => {
    expect(pointersByTarget(s).get('blk')).toContain('table');
  });
});
