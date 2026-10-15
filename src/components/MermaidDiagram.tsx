/**
 * The ` ```mermaid ` diagram block (Phase 27) — the general-purpose escape hatch next to the four
 * in-house kinds in `Diagram.tsx`. All Mermaid work lives in `mermaidRuntime.ts`, which is itself
 * **lazy-loaded** (as is Mermaid, from inside it), so this component is the only part of the feature
 * in the main bundle. It only wires the runtime to React:
 *
 * - On mount it loads the runtime + Mermaid (their own chunks), renders with token-derived theme
 *   variables and a fresh id, and mounts the SVG into a ref'd container via `DOMParser` +
 *   `replaceChildren`. React never renders children into that container, so it never fights the
 *   imperative mount.
 * - Space is reserved while loading (a fixed minimum height, kept after rendering) so the slide
 *   doesn't jump; the last SVG stays up while a theme-change re-render is in flight.
 * - It re-renders when `data-theme` on `<html>` changes.
 * - If the import fails, `mermaid.parse` rejects, or the output is refused, it shows `fallback`
 *   (the source as a code block) and `console.warn`s naming the slide.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Diagram } from '../engine/markdown.ts';

/** The runtime chunk (which in turn holds the app's one `import('mermaid')`). */
const loadRuntime = () => import('./mermaidRuntime.ts');

type MermaidSpec = Extract<Diagram, { kind: 'mermaid' }>;
type Status = 'loading' | 'ready' | 'failed';

/** Minimum height reserved for a Mermaid diagram (slide px), while loading and after. */
const RESERVE_PX = 220;

export function MermaidDiagram({
  diagram,
  fallback,
  context,
}: {
  diagram: MermaidSpec;
  /**
   * Shown instead of the diagram when it can't render. `Markdown` passes its scale-styled code
   * block; the bare default (a plain `<pre>`) only applies to direct `DiagramView` use.
   */
  fallback?: ReactNode;
  /** Where this diagram lives (e.g. `"Debugging" slide 4`), for the failure warning. */
  context?: string;
}) {
  const { source, caption } = diagram;
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let disposed = false;
    let generation = 0;
    let stop = () => {};

    const fail = (stage: string, error: unknown) => {
      console.warn(
        `[se-viz] Mermaid diagram on ${context ?? 'a theory slide'} could not render (${stage});` +
          ' showing its source instead.',
        error,
      );
      setStatus('failed');
    };

    const start = async () => {
      let rt: Awaited<ReturnType<typeof loadRuntime>>;
      try {
        rt = await loadRuntime();
      } catch (error) {
        if (!disposed) fail('import', error);
        return;
      }
      const run = async () => {
        const mine = ++generation;
        try {
          await document.fonts?.ready; // Mermaid measures label text — measure the real font
        } catch {
          /* measure with whatever is loaded */
        }
        const outcome = await rt.renderMermaid(source, {
          themeVariables: rt.currentThemeVariables(),
        });
        if (disposed || mine !== generation) return; // superseded or unmounted
        const container = ref.current;
        if (!outcome.ok) fail(outcome.stage, outcome.error);
        else if (container && rt.mountSvg(container, outcome.svg)) setStatus('ready');
        else fail('mount', null);
      };
      if (disposed) return;
      stop = rt.watchTheme(document.documentElement, () => void run());
      await run();
    };

    void start();
    return () => {
      disposed = true;
      stop();
    };
  }, [source, context]);

  return (
    <figure className="my-5" data-mermaid={status}>
      <div
        ref={ref}
        role="img"
        aria-label={caption ?? 'Diagram'}
        aria-busy={status === 'loading'}
        hidden={status === 'failed'}
        style={{ minHeight: RESERVE_PX }}
        className="flex w-full items-center justify-center [&>svg]:block [&>svg]:h-auto [&>svg]:max-h-[440px] [&>svg]:w-full"
      />
      {status === 'failed' ? (fallback ?? <pre className="se-code">{source}</pre>) : null}
      {caption && status !== 'failed' ? (
        <figcaption className="mt-2 text-center text-[17px] italic text-ink-faint">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
