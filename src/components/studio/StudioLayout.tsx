/**
 * The Studio workspace (Phase 28): one horizontal panel group, **course map | stage | step
 * explanation**. Both side panels resize by pointer and keyboard and collapse to a slim rail; their
 * widths and collapsed states persist (see `useSidePanel`). The stage takes the remaining width and
 * never drops below {@link STAGE_MIN_WIDTH}.
 *
 * The explanation panel's content belongs to the player (it needs the current beat), which lives in
 * the keyed `Workbench`. So this layout only provides a slot element: the workbench portals its
 * `ExplanationPanel` into it. Views without a player (theory decks, live coding) pass no explanation
 * and get a two-panel group.
 */
import type { ReactNode } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { occupiedWidth, STAGE_MIN_WIDTH } from './panelLayout.ts';
import type { SidePanelControls } from './useSidePanel.ts';

/** Chevron pointing left or right. */
export function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The square icon button used for collapse / expand. */
export function RailButton({
  label,
  direction,
  expanded,
  onClick,
}: {
  label: string;
  direction: 'left' | 'right';
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      title={label}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink"
    >
      <Chevron direction={direction} />
    </button>
  );
}

function ResizeHandle({ label, controls }: { label: string; controls: SidePanelControls }) {
  return (
    <Separator
      id={`${controls.spec.id}-handle`}
      aria-label={label}
      title={`${label} (drag, or focus and use ←/→, Shift for bigger steps, Enter to collapse)`}
      onKeyDownCapture={controls.onSeparatorKeyDown}
      className="relative z-10 w-px bg-hairline transition-colors hover:bg-pointer data-[separator=active]:bg-pointer data-[separator=focus]:bg-pointer"
    />
  );
}

/** Pointer hit area of the 1px handles (stable identity: the Group re-registers when it changes). */
const HIT_TARGET = { fine: 10, coarse: 28 };

function sizeProps(controls: SidePanelControls) {
  const { spec, state } = controls;
  return {
    id: spec.id,
    panelRef: controls.panelRef,
    defaultSize: `${occupiedWidth(spec, state)}px`,
    minSize: `${spec.minWidth}px`,
    maxSize: `${spec.maxWidth}px`,
    collapsible: true,
    collapsedSize: `${spec.railWidth}px`,
    groupResizeBehavior: 'preserve-pixel-size' as const,
    onResize: controls.onResize,
  };
}

export interface StudioLayoutProps {
  courseMap: SidePanelControls;
  /** The course map's content (it renders its own rail when collapsed). */
  sidebar: ReactNode;
  /** The stage: the player, a theory deck, or live coding. */
  children: ReactNode;
  /** Present only for views with a player. */
  explanation: SidePanelControls | null;
  /** Receives the element the explanation content is portalled into (null while collapsed). */
  onExplanationSlot: (el: HTMLDivElement | null) => void;
}

export function StudioLayout({
  courseMap,
  sidebar,
  children,
  explanation,
  onExplanationSlot,
}: StudioLayoutProps) {
  return (
    <Group
      // Remount when the panel set changes: react-resizable-panels 4.11 loops ("Maximum update
      // depth exceeded") when a Panel + Separator are removed from a mounted Group. Widths and
      // collapsed states live in our own persisted state, so a remount restores them exactly.
      key={explanation ? 'with-explanation' : 'without-explanation'}
      orientation="horizontal"
      className="h-full w-full"
      // The visible handle is a 1px hairline; the library widens its pointer hit area.
      resizeTargetMinimumSize={HIT_TARGET}
      onLayoutChanged={() => {
        courseMap.onSettled();
        explanation?.onSettled();
      }}
    >
      <Panel {...sizeProps(courseMap)} className="h-full min-h-0">
        {sidebar}
      </Panel>
      <ResizeHandle label="Resize the course map" controls={courseMap} />
      <Panel
        id="stage"
        minSize={`${STAGE_MIN_WIDTH}px`}
        className="flex h-full min-h-0 min-w-0 flex-col"
      >
        {children}
      </Panel>
      {explanation ? (
        <>
          <ResizeHandle label="Resize the step explanation" controls={explanation} />
          <Panel {...sizeProps(explanation)} className="h-full min-h-0">
            {explanation.state.collapsed ? (
              <aside
                aria-label="Step explanation"
                className="flex h-full flex-col items-center gap-3 bg-surface py-3"
              >
                <RailButton
                  label="Expand the step explanation"
                  direction="left"
                  expanded={false}
                  onClick={explanation.expand}
                />
                <span
                  aria-hidden="true"
                  className="font-sans text-xs font-semibold text-ink-muted [writing-mode:vertical-rl]"
                >
                  Step explanation
                </span>
              </aside>
            ) : (
              <div ref={onExplanationSlot} className="h-full min-h-0" />
            )}
          </Panel>
        </>
      ) : null}
    </Group>
  );
}
