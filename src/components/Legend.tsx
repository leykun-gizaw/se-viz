/**
 * The semantic color legend (PDF page 11): color is meaning, reused identically on every screen.
 * Built entirely from the design tokens so it can never drift from the renderer. Reusable — content
 * phases can drop it anywhere.
 */
interface SwatchRowProps {
  swatch: React.ReactNode;
  title: string;
  desc: string;
}

function SwatchRow({ swatch, title, desc }: SwatchRowProps) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-9 shrink-0 items-center justify-center">{swatch}</span>
      <p className="text-xs leading-snug">
        <span className="font-semibold text-ink">{title}</span>{' '}
        <span className="text-ink-muted">{desc}</span>
      </p>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h4 className="font-sans text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
        {label}
      </h4>
      {children}
    </div>
  );
}

export function Legend() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      <Group label="Entities">
        <SwatchRow
          swatch={
            <span className="flex h-5 w-9 items-center justify-center rounded-md bg-pointer">
              <svg width="18" height="8" viewBox="0 0 18 8" aria-hidden="true">
                <path d="M0 4h14M11 1l4 3-4 3" stroke="white" strokeWidth="1.5" fill="none" />
              </svg>
            </span>
          }
          title="Pointer · address · arrow"
          desc="Pointer cells, next/prev links, every connector — azure."
        />
        <SwatchRow
          swatch={<span className="h-5 w-9 rounded-md border border-heap bg-heap-soft" />}
          title="Heap-allocated data"
          desc="Nodes and malloc'd blocks — teal, with an address header."
        />
        <SwatchRow
          swatch={<span className="h-5 w-9 rounded-md border border-hairline bg-surface-2" />}
          title="Stack frame · scalar local"
          desc="Neutral / desaturated, so it recedes."
        />
        <SwatchRow
          swatch={
            <span className="h-5 w-9 rounded-md border border-dashed border-hairline-strong" />
          }
          title="Process box"
          desc="Hash fn, pipeline stage — dashed neutral, reads as process."
        />
      </Group>

      <Group label="State flags">
        <SwatchRow
          swatch={<span className="h-5 w-9 rounded-md border border-active ring-1 ring-active" />}
          title="Active / current"
          desc="Amber ring + badge. Exactly one element is current per step."
        />
        <SwatchRow
          swatch={
            <span className="flex h-5 w-9 items-center justify-center rounded-md border border-changed bg-changed-soft font-mono text-[10px] text-changed">
              42
            </span>
          }
          title="Value just changed"
          desc="A single green pulse that fades."
        />
      </Group>

      <Group label="Allocation states (heap)">
        <SwatchRow
          swatch={<span className="h-5 w-9 rounded-md border border-heap bg-heap-soft" />}
          title="Allocated"
          desc="Live, reachable, owned by a pointer."
        />
        <SwatchRow
          swatch={
            <span className="se-hatch h-5 w-9 rounded-md border border-hairline opacity-70" />
          }
          title="Freed"
          desc="Desaturated + hatched. No live references."
        />
        <SwatchRow
          swatch={
            <span className="se-hatch h-5 w-9 rounded-md border border-dashed border-danger" />
          }
          title="Dangling"
          desc="A pointer still aims at a freed block — flagged red. UB."
        />
        <SwatchRow
          swatch={<span className="h-5 w-9 rounded-md border border-active bg-heap-soft" />}
          title="Leaked"
          desc="Allocated but unreachable — warning marker, no incoming arrow."
        />
      </Group>
    </div>
  );
}
