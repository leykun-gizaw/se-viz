/**
 * matplotlib figures as step output (Phase 36), lazy-loaded by the stage only for traces that have
 * figures:
 *
 * - {@link FigureStrip}: the console panel's row of thumbnails, one per figure visible at the
 *   current step (cumulative, like printed output; see `figuresAt`). Clicking one opens it large.
 * - {@link FigureViewer}: the larger view, laid over the visualization panel. Esc or Close shuts it.
 *
 * Figures keep matplotlib's own colours and sit on a white surface in both themes. An SVG figure is
 * sanitized (`sanitizeSvg.ts`) and inserted with `DOMParser` + `importNode` (`svgDom.ts`); a PNG
 * figure is shown only as a validated `data:image/png;base64,` URL. There is no `innerHTML` here.
 *
 * @packageDocumentation
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TraceFigure } from '../../../engine/trace/types.ts';
import { chartWords, figureName, formatText, missingText } from './figureText.ts';
import { safePngDataUrl } from './sanitizeSvg.ts';
import { mountSvg, nextFigurePrefix } from './svgDom.ts';

const aspectOf = (f: TraceFigure) => (f.width > 0 && f.height > 0 ? f.width / f.height : 4 / 3);

/** The figure itself: sanitized SVG, a validated PNG, or a note. Fills its box (aspect kept). */
export function FigureImage({
  figure,
  className = '',
}: {
  figure: TraceFigure;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // One id prefix per mounted copy (the thumbnail and the large view never share ids).
  const [prefix] = useState(() => nextFigurePrefix(figure.id));
  const [failed, setFailed] = useState(false);
  const label = `${figureName(figure)}${figure.title ? `: ${figure.title}` : ''}`;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || figure.format !== 'svg' || figure.data === undefined) return;
    setFailed(!mountSvg(el, figure.data, prefix));
  }, [figure.format, figure.data, prefix]);

  if (figure.format === 'png') {
    const src = safePngDataUrl(figure.data);
    if (src) {
      return (
        <img src={src} alt={label} className={`block h-full w-full object-contain ${className}`} />
      );
    }
  }
  if (figure.format === 'svg' && !failed) {
    return <div ref={ref} role="img" aria-label={label} className={`se-figure ${className}`} />;
  }
  return (
    <div
      className={`flex h-full w-full items-center justify-center p-2 text-center font-sans text-[11px] text-neutral-600 ${className}`}
    >
      {figure.format === 'none' ? missingText(figure) : 'This figure could not be shown safely'}
    </div>
  );
}

/** The console panel's thumbnails. `current` marks figures made by the step on screen. */
export function FigureStrip({
  figures,
  current,
  openId,
  onOpen,
}: {
  figures: readonly TraceFigure[];
  current: number;
  openId: string | null;
  onOpen: (id: string) => void;
}) {
  if (figures.length === 0) return null;
  return (
    <ul className="flex gap-3 overflow-x-auto px-4 pb-1 pt-2" aria-label="Figures">
      {figures.map((f) => {
        const fresh = f.step === current;
        const words = chartWords(f);
        return (
          <li key={f.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onOpen(f.id)}
              aria-pressed={openId === f.id}
              title={`Open ${figureName(f)}${f.title ? ` (${f.title})` : ''}`}
              className={`group flex w-36 flex-col gap-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-pointer ${
                openId === f.id ? 'opacity-100' : ''
              }`}
            >
              <span
                className={`se-figure-surface block h-24 w-36 overflow-hidden rounded border p-1 transition-shadow group-hover:shadow-md ${
                  fresh ? 'border-changed ring-2 ring-changed/40' : 'border-hairline-strong'
                }`}
              >
                <span
                  className="mx-auto block h-full"
                  style={{ aspectRatio: String(aspectOf(f)), maxWidth: '100%' }}
                >
                  <FigureImage figure={f} className="h-full w-full" />
                </span>
              </span>
              <span className="flex items-center gap-1.5 font-sans text-[11px] leading-4">
                <span className="font-semibold text-ink">{figureName(f)}</span>
                {fresh ? (
                  <span className="rounded border border-changed/50 px-1 font-mono text-[9px] uppercase leading-3.5 text-changed">
                    new
                  </span>
                ) : null}
                {f.format !== 'svg' ? (
                  <span className="rounded border border-hairline-strong px-1 font-mono text-[9px] uppercase leading-3.5 text-ink-muted">
                    {f.format === 'png' ? 'png' : 'note'}
                  </span>
                ) : null}
              </span>
              <span className="block w-36 truncate font-sans text-[11px] leading-4 text-ink-muted">
                {f.title ?? words ?? 'untitled'}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The larger view of one figure, over the visualization panel. */
export function FigureViewer({
  figure,
  total,
  onClose,
}: {
  figure: TraceFigure;
  /** How many figures are visible now (for "1 of 3"). */
  total: number;
  onClose: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), [figure.id]);
  const words = chartWords(figure);
  const aspect = aspectOf(figure);
  const index = Number(figure.id.replace(/^fig/, ''));
  return (
    <section
      aria-label={`${figureName(figure)}, large view`}
      className="absolute inset-0 z-20 flex flex-col gap-3 rounded-lg border border-hairline bg-bg/95 p-4 backdrop-blur-sm"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          // Only the viewer closes: presentation mode must not also exit.
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-sans text-sm font-semibold text-ink">
            {figureName(figure)}
            {figure.title ? (
              <span className="font-normal text-ink-muted"> · {figure.title}</span>
            ) : null}
          </h2>
          <p className="font-mono text-[11px] text-ink-faint">
            {[
              words,
              formatText(figure),
              `step ${figure.step + 1}`,
              figure.trigger === 'end' ? 'open at the end of the run' : 'shown by plt.show()',
              total > 1 ? `${index} of ${total} shown so far` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <button
          ref={close}
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md border border-hairline-strong bg-surface px-2.5 py-1 font-sans text-xs text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-pointer"
        >
          Close <span className="text-ink-faint">Esc</span>
        </button>
      </header>
      <div
        className="flex min-h-0 flex-1 items-center justify-center"
        style={{ containerType: 'size' }}
      >
        <div
          className="se-figure-surface overflow-hidden rounded-md border border-hairline-strong p-3 shadow-sm"
          style={
            figure.format === 'none'
              ? { width: 'min(100cqw, 28rem)', height: '8rem' }
              : { width: `min(100cqw, calc((100cqh - 1.5rem) * ${aspect} + 1.5rem))` }
          }
        >
          <div
            style={figure.format === 'none' ? { height: '100%' } : { aspectRatio: String(aspect) }}
          >
            <FigureImage figure={figure} className="h-full w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}
