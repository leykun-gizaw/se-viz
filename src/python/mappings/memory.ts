/**
 * Python state → the C memory model (Phase 29 spike), used by candidate **A** at load time and by
 * candidate **C** at render time.
 *
 * - A name is a cell: `scalar` for a primitive (its `repr` is the value), `pointer` for a reference
 *   (the target is the object's stable id, so aliasing is two arrows into one box).
 * - Every Python object is a {@link HeapBlock} whose id is the object's stable id (`o1`, ...), plus an
 *   additive {@link HeapBlock.objectKind | objectKind} tag. Its cells: list/tuple items by index,
 *   dict entries named by the key's `repr`, set members, instance attributes, or a summary.
 *
 * Cell ids are derived from the owner and the position or key, so the same logical slot keeps its
 * id across steps (`f2.n`, `o1[0]`, `o3['corn']`, `o4.fuel`), and `diffSteps` sees an in-place
 * mutation as a change inside the same block.
 *
 * Nothing here is special-cased per key type: a key's `repr` names its cell, whatever the
 * primitive type, and nested containers are ordinary pointer cells.
 *
 * @packageDocumentation
 */
import type { Cell, HeapBlock, PyObjectKind, StackFrame } from '../../engine/trace/types.ts';
import type { PyFrame, PyObject, PyValue } from '../protocol.ts';

// Phase 30: `PyObjectKind` and `HeapBlock.objectKind` live in the shared trace types now. The
// recorder's object kinds and the trace's must stay the same set; this fails to compile if not.
type SameKinds<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const KINDS_MATCH: SameKinds<PyObject['kind'], PyObjectKind> = true;
void KINDS_MATCH;

/** The frames + objects part of a snapshot (or of candidate B's payload). */
export interface PythonState {
  frames: PyFrame[];
  objects: Record<string, PyObject>;
  returnValue?: PyValue;
  unwinding?: true;
}

/** A compact, human label for a referenced object (used for non-primitive dict keys and set members). */
function refLabel(id: string, objects: Record<string, PyObject>): string {
  const obj = objects[id];
  if (!obj) return id;
  if (
    (obj.kind === 'tuple' || obj.kind === 'frozenset') &&
    obj.items.every((v) => v.kind === 'prim')
  ) {
    const inner = obj.items.map((v) => (v.kind === 'prim' ? v.repr : '')).join(', ');
    if (obj.kind === 'frozenset') return `frozenset({${inner}})`;
    return obj.items.length === 1 ? `(${inner},)` : `(${inner})`;
  }
  return `${obj.type} ${id}`;
}

/** One name or slot as a cell. */
export function valueToCell(
  id: string,
  name: string,
  value: PyValue,
  objects: Record<string, PyObject>,
): Cell {
  if (value.kind === 'prim') {
    return { kind: 'scalar', id, name, type: value.type, value: value.repr };
  }
  const target = objects[value.id];
  // A reference past `maxObjects` has no object entry: a pointer to nothing, labelled.
  if (!target) return { kind: 'pointer', id, name, type: 'object', target: null, display: '…' };
  return { kind: 'pointer', id, name, type: target.type, target: value.id };
}

function omittedCell(owner: string, omitted: number | undefined): Cell[] {
  if (!omitted) return [];
  return [
    { kind: 'scalar', id: `${owner}[…]`, name: '…', type: 'omitted', value: `${omitted} more` },
  ];
}

/** The cell-id key for a dict key or set member: its `repr`, or `#id` for a reference. */
function keyOf(value: PyValue): string {
  return value.kind === 'prim' ? value.repr : `#${value.id}`;
}

function blockLabel(obj: PyObject): string {
  switch (obj.kind) {
    case 'function':
      return `function ${obj.name}(${obj.params.join(', ')})`;
    case 'class':
      return `class ${obj.name}`;
    case 'summary':
      return `${obj.library} ${obj.type}`;
    default:
      return obj.type;
  }
}

/** One Python object as a heap block. */
export function objectToBlock(
  id: string,
  obj: PyObject,
  objects: Record<string, PyObject>,
): HeapBlock {
  let cells: Cell[];
  switch (obj.kind) {
    case 'list':
    case 'tuple':
      cells = obj.items.map((v, i) => valueToCell(`${id}[${i}]`, String(i), v, objects));
      cells.push(...omittedCell(id, obj.omitted));
      break;
    case 'set':
    case 'frozenset':
      cells = obj.items.map((v) => valueToCell(`${id}{${keyOf(v)}}`, '', v, objects));
      cells.push(...omittedCell(id, obj.omitted));
      break;
    case 'dict':
      cells = obj.entries.map((e) =>
        valueToCell(
          `${id}[${keyOf(e.key)}]`,
          e.key.kind === 'prim' ? e.key.repr : refLabel(e.key.id, objects),
          e.value,
          objects,
        ),
      );
      cells.push(...omittedCell(id, obj.omitted));
      break;
    case 'instance':
      cells = obj.attrs.map((a) => valueToCell(`${id}.${a.name}`, a.name, a.value, objects));
      break;
    case 'summary':
      cells = [
        {
          kind: 'scalar',
          id: `${id}.shape`,
          name: 'shape',
          type: 'tuple',
          value: `(${obj.shape.join(', ')}${obj.shape.length === 1 ? ',' : ''})`,
        },
        { kind: 'scalar', id: `${id}.dtype`, name: 'dtype', type: 'dtype', value: obj.dtype },
      ];
      break;
    case 'other':
      cells = [{ kind: 'scalar', id: `${id}.repr`, name: 'repr', type: obj.type, value: obj.repr }];
      break;
    case 'function':
    case 'class':
      cells = [];
      break;
  }
  return { id, label: blockLabel(obj), type: obj.type, cells, objectKind: obj.kind };
}

/** Frames and objects in the C model: `stack` bottom-first, `heap` in first-reached order. */
export function stateToMemory(
  state: PythonState,
  callIds: Map<string, number>,
): { stack: StackFrame[]; heap: HeapBlock[] } {
  const last = state.frames.length - 1;
  const stack = state.frames.map((frame, depth): StackFrame => {
    const variables = frame.vars.map((v) =>
      valueToCell(`${frame.id}.${v.name}`, v.name, v.value, state.objects),
    );
    // The return value belongs to the frame that is returning (the top one), as in Python Tutor.
    if (depth === last && state.returnValue) {
      variables.push(valueToCell(`${frame.id}.return`, 'return', state.returnValue, state.objects));
    }
    return { id: frame.id, name: frame.name, callId: callIds.get(frame.id) ?? 0, variables };
  });
  const heap = Object.entries(state.objects).map(([id, obj]) =>
    objectToBlock(id, obj, state.objects),
  );
  return { stack, heap };
}
