/**
 * The Python canvas's pieces (Phase 30): frames of names, object boxes per kind, and the value
 * slot that cross-fades a changed value. Colour keeps its meaning from the C canvas: references are
 * azure (the chip an arrow leaves from), the current element is amber, a changed value pulses
 * green. Every box registers an anchor by its stable id, so the shared `ArrowOverlay` draws the
 * references.
 *
 * Motion comes from {@link useMotionCues}: an element that just appeared slides in, one that went
 * away fades out (via `AnimatePresence`, instantly after a jump), a changed value cross-fades from
 * old to new with the green pulse, and boxes glide to their new place.
 */
import {
  AnimatePresence,
  motion,
  PresenceContext,
  type TargetAndTransition,
  type Variants,
} from 'framer-motion';
import { useAnchorRef } from '../../engine/anchorContext.ts';
import type { Cell, HeapBlock, StackFrame } from '../../engine/trace/types.ts';
import { useMemoryRender } from '../memory/renderContext.ts';
import type { ObjectNode } from './pyLayout.ts';
import { useMotionCues } from './pyMotion.ts';

const SPRING = { type: 'spring', stiffness: 360, damping: 30 } as const;
const FADE = { duration: 0.22, ease: 'easeOut' } as const;
const INSTANT = { duration: 0 } as const;

/** `custom` is whether motion plays: exits are instant after a jump or with reduced motion. */
const gone =
  (to: TargetAndTransition) =>
  (animate: boolean): TargetAndTransition =>
    animate ? { opacity: 0, ...to, transition: FADE } : { opacity: 0, transition: INSTANT };

const SLIDE: Variants = {
  hidden: { opacity: 0, x: -14 },
  shown: { opacity: 1, x: 0, transition: SPRING },
  gone: gone({ x: 10 }),
};
const DROP: Variants = {
  hidden: { opacity: 0, y: -16, scale: 0.97 },
  shown: { opacity: 1, y: 0, scale: 1, transition: SPRING },
  gone: gone({ y: -12, scale: 0.97 }),
};
const POP: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  shown: { opacity: 1, scale: 1, transition: SPRING },
  gone: gone({ scale: 0.92 }),
};

const isOmitted = (c: Cell) => c.name === '…';

/** An element that slides / pops in when `id` just appeared, and can glide to a new place. */
function Enter({
  id,
  variants,
  layout = true,
  className,
  children,
}: {
  id: string;
  variants: Variants;
  layout?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const cues = useMotionCues();
  return (
    <motion.div
      layout={cues.animate && layout ? 'position' : false}
      custom={cues.animate}
      variants={variants}
      initial={cues.animate && cues.entering.has(id) ? 'hidden' : false}
      animate="shown"
      exit="gone"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Children that fade out when removed (instantly unless motion plays). */
function Presence({ children }: { children: React.ReactNode }) {
  const { animate } = useMotionCues();
  return (
    <AnimatePresence initial={false} custom={animate}>
      {children}
    </AnimatePresence>
  );
}

/** A reference: the azure chip its arrow leaves from. */
function RefChip({ cell, anchored }: { cell: Cell & { kind: 'pointer' }; anchored: boolean }) {
  const ref = useAnchorRef(cell.id);
  return (
    <span
      ref={anchored ? ref : undefined}
      data-coach-anchor={anchored ? cell.id : undefined}
      title={`reference to ${cell.type} ${cell.target ?? ''}`}
      className="inline-flex h-4 w-6 items-center justify-center rounded-sm border border-pointer bg-pointer-soft align-middle"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-pointer" />
    </span>
  );
}

/** A slot's content: a primitive inline, or a reference chip. */
function ValueContent({ cell, anchored }: { cell: Cell; anchored: boolean }) {
  if (cell.kind === 'pointer') {
    if (cell.target === null) {
      return (
        <span
          title="an object past the display limit"
          className="font-mono text-[13px] text-ink-faint"
        >
          {cell.display ?? '…'}
        </span>
      );
    }
    return <RefChip cell={cell} anchored={anchored} />;
  }
  const text =
    cell.kind === 'scalar' ? (cell.value === null ? '?' : String(cell.value)) : cell.type;
  return (
    <span title={cell.type} className="whitespace-pre font-mono text-[13px] font-semibold text-ink">
      {text}
    </span>
  );
}

/** A slot's value; a changed one cross-fades old → new with the green pulse. */
function SlotValue({ cell }: { cell: Cell }) {
  const cues = useMotionCues();
  const was = cues.changed.get(cell.id);
  const now = <ValueContent cell={cell} anchored />;
  if (!was) return now;
  if (!cues.animate) {
    // Reduced motion: no fade, but the change is still marked for this step.
    return <span className="rounded bg-changed-soft px-1 text-changed">{now}</span>;
  }
  // Its own presence scope: under an `AnimatePresence initial={false}` (every row is), framer
  // blocks the initial animation of everything mounted inside the row, so the fade wouldn't play.
  return (
    <PresenceContext.Provider value={null}>
      <span className="inline-grid items-center justify-items-end">
        <motion.span
          key={`was:${cues.transition}`}
          aria-hidden="true"
          className="px-1 [grid-area:1/1]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <ValueContent cell={was} anchored={false} />
        </motion.span>
        <motion.span
          key={`now:${cues.transition}`}
          className="rounded px-1 [grid-area:1/1]"
          initial={{
            opacity: 0,
            backgroundColor: 'var(--se-changed-soft)',
            color: 'var(--se-changed)',
          }}
          animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0)', color: 'var(--se-text)' }}
          transition={{ opacity: { duration: 0.45 }, default: { duration: 0.9, ease: 'easeOut' } }}
        >
          {now}
        </motion.span>
      </span>
    </PresenceContext.Provider>
  );
}

/** A `name → value` row: a frame's name, a dict entry, an attribute. */
function Row({ cell, label, muted = false }: { cell: Cell; label: string; muted?: boolean }) {
  const { activeId } = useMemoryRender();
  const active = activeId === cell.id;
  return (
    <Enter
      id={cell.id}
      variants={SLIDE}
      className={`flex items-center justify-between gap-4 rounded-md px-2 py-0.5 ${
        active ? 'ring-1 ring-active' : ''
      }`}
    >
      <span
        className={`whitespace-pre font-mono text-[13px] ${muted ? 'italic text-ink-muted' : 'text-ink'}`}
      >
        {label}
      </span>
      <SlotValue cell={cell} />
    </Enter>
  );
}

/** One frame: "Global frame" or the function's name, then its names in order. */
export function FrameView({ frame }: { frame: StackFrame }) {
  const ref = useAnchorRef(frame.id);
  const { activeId } = useMemoryRender();
  const active = activeId === frame.id;
  return (
    <Enter id={frame.id} variants={DROP}>
      <div
        ref={ref}
        data-coach-anchor={frame.id}
        className={`min-w-44 rounded-lg border bg-surface ${
          active ? 'border-active ring-1 ring-active' : 'border-hairline'
        }`}
      >
        <div className="flex items-baseline justify-between gap-3 border-b border-hairline px-3 py-1.5">
          <span className="font-mono text-[13px] font-semibold text-ink">
            {frame.name === '<module>' ? 'Global frame' : frame.name}
          </span>
          <span className="font-mono text-[10px] text-ink-faint">{frame.id}</span>
        </div>
        <div className="flex flex-col gap-0.5 p-1.5">
          <Presence>
            {frame.variables.map((v) =>
              v.name === 'return' ? (
                <Row key={v.id} cell={v} label="Return value" muted />
              ) : (
                <Row key={v.id} cell={v} label={v.name} />
              ),
            )}
          </Presence>
          {frame.variables.length === 0 ? (
            <span className="px-2 py-0.5 font-mono text-xs text-ink-faint">no names yet</span>
          ) : null}
        </div>
      </div>
    </Enter>
  );
}

/** The header label and tag of each object kind. */
function heading(block: HeapBlock): [label: string, tag: string] {
  switch (block.objectKind) {
    case 'tuple':
    case 'frozenset':
      return [block.objectKind, 'immutable'];
    case 'set':
      return ['set', 'unordered'];
    case 'instance':
      return [block.type ?? 'object', 'instance'];
    case 'summary':
      return [block.label ?? block.type ?? 'object', 'summary'];
    case 'function':
    case 'class':
    case 'list':
    case 'dict':
      return [block.objectKind, ''];
    default:
      return [block.type ?? 'object', ''];
  }
}

function Empty({ text }: { text: string }) {
  return <div className="px-2.5 py-1.5 font-mono text-xs text-ink-faint">{text}</div>;
}

/** List and tuple items: indexed cells in a row, or indexed rows when an item is a reference. */
function SequenceBody({ block }: { block: HeapBlock }) {
  const cues = useMotionCues();
  const items = block.cells.filter((c) => !isOmitted(c));
  const more = block.cells.find(isOmitted);
  const tuple = block.objectKind === 'tuple';
  if (items.length === 0) return <Empty text={tuple ? 'empty ()' : 'empty []'} />;
  const known = cues.keys[block.id];
  const keys = known && known.length === items.length ? known : items.map((c) => c.id);
  const glide = cues.restructured.has(block.id);
  const vertical = items.some((c) => c.kind === 'pointer');
  const moreChip =
    more && more.kind === 'scalar' ? (
      <span className="self-center px-2 font-mono text-[11px] text-ink-faint">… {more.value}</span>
    ) : null;

  if (vertical) {
    return (
      <div className="flex flex-col gap-0.5 p-1.5">
        <Presence>
          {items.map((c, i) => (
            <Enter
              key={keys[i]}
              id={c.id}
              variants={SLIDE}
              layout={glide}
              className={`flex items-center justify-between gap-4 rounded-md border border-hairline px-2 py-0.5 ${
                tuple ? 'bg-surface' : 'bg-surface-2'
              }`}
            >
              <span className="font-mono text-[10px] text-ink-faint">{i}</span>
              <SlotValue cell={c} />
            </Enter>
          ))}
        </Presence>
        {moreChip}
      </div>
    );
  }
  return (
    <div className="flex items-stretch p-2">
      {tuple ? <span className="self-center pr-1 font-mono text-ink-faint">(</span> : null}
      <Presence>
        {items.map((c, i) => (
          <Enter
            key={keys[i]}
            id={c.id}
            variants={SLIDE}
            layout={glide}
            className={`-ml-px flex min-w-9 flex-col items-center gap-0.5 border border-hairline px-1.5 py-1 first:ml-0 first:rounded-l-md last:rounded-r-md ${
              tuple ? 'bg-surface' : 'bg-surface-2'
            }`}
          >
            <span className="font-mono text-[10px] text-ink-faint">{i}</span>
            <SlotValue cell={c} />
          </Enter>
        ))}
      </Presence>
      {tuple ? <span className="self-center pl-1 font-mono text-ink-faint">)</span> : null}
      {moreChip}
    </div>
  );
}

/** Named rows: dict entries (key → value) and instance attributes. */
function RowsBody({ block, keyed }: { block: HeapBlock; keyed: boolean }) {
  if (block.cells.length === 0) return <Empty text={keyed ? 'empty {}' : 'no attributes'} />;
  return (
    <div className="flex flex-col gap-0.5 p-1.5">
      <Presence>
        {block.cells.map((c) => (
          <Row key={c.id} cell={c} label={c.name} muted={keyed && !isOmitted(c)} />
        ))}
      </Presence>
    </div>
  );
}

/** Set members: unordered chips. */
function SetBody({ block }: { block: HeapBlock }) {
  if (block.cells.length === 0) return <Empty text="empty set()" />;
  return (
    <div className="flex max-w-64 flex-wrap gap-1.5 p-2">
      <Presence>
        {block.cells.map((c) => (
          <Enter
            key={c.id}
            id={c.id}
            variants={POP}
            className="rounded-full border border-hairline bg-surface-2 px-2 py-0.5"
          >
            <SlotValue cell={c} />
          </Enter>
        ))}
      </Presence>
    </div>
  );
}

function ObjectBody({ block }: { block: HeapBlock }) {
  switch (block.objectKind) {
    case 'list':
    case 'tuple':
      return <SequenceBody block={block} />;
    case 'set':
    case 'frozenset':
      return <SetBody block={block} />;
    case 'dict':
      return <RowsBody block={block} keyed />;
    case 'instance':
      return <RowsBody block={block} keyed={false} />;
    case 'function':
    case 'class':
      // The label is `function name(params)` / `class Name`: the box shows the signature.
      return (
        <div className="px-2.5 py-1.5 font-mono text-[12px] text-ink">
          {(block.label ?? '').replace(/^(function|class) /, '')}
        </div>
      );
    case 'summary':
      return (
        <div>
          <RowsBody block={block} keyed={false} />
          <div className="border-t border-hairline px-2.5 py-1 font-sans text-[10px] text-ink-faint">
            summary only (a fuller view comes later)
          </div>
        </div>
      );
    default:
      return <RowsBody block={block} keyed={false} />;
  }
}

/** One object box: kind, tag, id, and its kind's body. */
function ObjectBox({ block }: { block: HeapBlock }) {
  const ref = useAnchorRef(block.id);
  const { activeId } = useMemoryRender();
  const active = activeId === block.id;
  const [label, tag] = heading(block);
  return (
    <div
      ref={ref}
      data-coach-anchor={block.id}
      className={`w-max min-w-24 max-w-88 rounded-lg border bg-surface ${
        active ? 'border-active ring-1 ring-active' : 'border-hairline-strong'
      }`}
    >
      <div className="flex items-baseline gap-2 border-b border-hairline px-2.5 py-1">
        <span className="font-mono text-[11px] font-semibold text-heap">{label}</span>
        {tag ? (
          <span className="font-sans text-[9px] font-semibold uppercase tracking-wide text-ink-faint">
            {tag}
          </span>
        ) : null}
        <span className="ml-auto pl-2 font-mono text-[10px] text-ink-faint">{block.id}</span>
      </div>
      <ObjectBody block={block} />
    </div>
  );
}

/**
 * An object with the objects only it refers to drawn beside it, to its right. The gaps are wide on
 * purpose: `ArrowOverlay` routes an arrow to a box that isn't level with its source down a channel
 * beside the source and along a lane just above the target, and those lanes need the room.
 */
export function ObjectTree({ node, blocks }: { node: ObjectNode; blocks: Map<string, HeapBlock> }) {
  const block = blocks.get(node.id);
  if (!block) return null;
  return (
    <Enter id={node.id} variants={POP} className="flex items-start gap-12">
      <ObjectBox block={block} />
      {node.children.length > 0 ? (
        <div className="flex flex-col items-start gap-10">
          <Presence>
            {node.children.map((child) => (
              <ObjectTree key={child.id} node={child} blocks={blocks} />
            ))}
          </Presence>
        </div>
      ) : null}
    </Enter>
  );
}

/** A captioned area of the canvas, like the C canvas's regions. */
export function Region({
  label,
  hint,
  className = '',
  children,
}: {
  label: string;
  hint: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-hairline bg-surface/25 p-3 ${className}`}>
      <h3 className="mb-3 flex items-baseline gap-2 px-1">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          {label}
        </span>
        <span className="font-mono text-[10px] text-ink-faint">{hint}</span>
      </h3>
      {children}
    </section>
  );
}

export { Presence };
