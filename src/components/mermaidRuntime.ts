/**
 * The Mermaid side of the ` ```mermaid ` diagram block (Phase 27), kept apart from the React
 * component so every decision is a plain, testable function.
 *
 * Mermaid is **never** imported statically: {@link loadMermaid} is the only `import('mermaid')` in
 * the app, so the library lands in its own chunk and is fetched the first time a slide with a
 * Mermaid block mounts. Decks without one never download it.
 *
 * Containment (the Phase 22 objections, answered narrowly):
 * - **Security** — `securityLevel: 'strict'` (Mermaid sanitizes the SVG with DOMPurify, no click
 *   callbacks), `htmlLabels: false` (labels are SVG `<text>`, no `<foreignObject>` HTML), and the
 *   security/theme keys are marked `secure` so a diagram's own `%%{init}%%` / frontmatter can't flip
 *   them. The SVG is then checked ({@link svgProblem}) and mounted with `DOMParser` +
 *   `replaceChildren` ({@link mountSvg}) — never `dangerouslySetInnerHTML`.
 * - **Design tokens** — `theme: 'base'` with `themeVariables` read from the live `--se-*` tokens at
 *   render time ({@link themeVariablesFromTokens}); the component re-renders when `data-theme` on
 *   `<html>` changes ({@link watchTheme}).
 */
import type { Mermaid, MermaidConfig } from 'mermaid';

/** The slice of the Mermaid API we use (and that tests mock). */
export type MermaidApi = Pick<Mermaid, 'initialize' | 'parse' | 'render'>;

/** Resolves the Mermaid API. The default is the app's one lazy `import('mermaid')`. */
export type MermaidLoader = () => Promise<MermaidApi>;

/** The only place the app imports Mermaid — dynamically, so it is code-split into its own chunk. */
export const loadMermaid: MermaidLoader = async () => (await import('mermaid')).default;

/** Mermaid `themeVariables` — colors/fonts as strings, plus a couple of flags. */
export type MermaidThemeVariables = Record<string, string | boolean>;

/**
 * Mermaid `base`-theme variable → the `--se-*` design token that feeds it. Neutral surfaces and
 * hairline borders for shapes, **azure for every line and arrow** (the app's "arrows are pointers"
 * rule), the danger token for Mermaid's error colors. Anything not listed is derived by Mermaid
 * from these.
 */
export const TOKEN_THEME_VARIABLES: Readonly<Record<string, string>> = {
  background: '--se-surface',
  // Shapes (flowchart nodes, states, classes, entities, actors)
  primaryColor: '--se-surface-2',
  primaryTextColor: '--se-text',
  primaryBorderColor: '--se-text-faint',
  secondaryColor: '--se-surface-3',
  secondaryTextColor: '--se-text',
  secondaryBorderColor: '--se-text-faint',
  tertiaryColor: '--se-surface',
  tertiaryTextColor: '--se-text',
  tertiaryBorderColor: '--se-border-strong',
  mainBkg: '--se-surface-2',
  nodeBorder: '--se-text-faint',
  nodeTextColor: '--se-text',
  textColor: '--se-text',
  titleColor: '--se-text',
  clusterBkg: '--se-surface',
  clusterBorder: '--se-border-strong',
  // Lines and arrows: azure
  lineColor: '--se-pointer',
  arrowheadColor: '--se-pointer',
  defaultLinkColor: '--se-pointer',
  edgeLabelBackground: '--se-surface',
  // State diagrams
  stateBkg: '--se-surface-2',
  stateLabelColor: '--se-text',
  transitionColor: '--se-pointer',
  transitionLabelColor: '--se-text-muted',
  labelBackgroundColor: '--se-surface',
  compositeBackground: '--se-surface',
  compositeTitleBackground: '--se-surface-2',
  compositeBorder: '--se-border-strong',
  altBackground: '--se-surface-3',
  // Notes
  noteBkgColor: '--se-surface-3',
  noteBorderColor: '--se-border-strong',
  noteTextColor: '--se-text',
  // Sequence diagrams
  actorBkg: '--se-surface-2',
  actorBorder: '--se-text-faint',
  actorTextColor: '--se-text',
  actorLineColor: '--se-text-faint',
  signalColor: '--se-pointer',
  signalTextColor: '--se-text',
  labelBoxBkgColor: '--se-surface-2',
  labelBoxBorderColor: '--se-text-faint',
  labelTextColor: '--se-text',
  loopTextColor: '--se-text-muted',
  activationBkgColor: '--se-surface-3',
  activationBorderColor: '--se-text-faint',
  sequenceNumberColor: '--se-surface',
  // Class / ER diagrams
  classText: '--se-text',
  relationColor: '--se-pointer',
  relationLabelBackground: '--se-surface',
  relationLabelColor: '--se-text',
  attributeBackgroundColorOdd: '--se-surface',
  attributeBackgroundColorEven: '--se-surface-2',
  rowOdd: '--se-surface',
  rowEven: '--se-surface-2',
  // Errors
  errorBkgColor: '--se-danger-soft',
  errorTextColor: '--se-danger',
};

/** The app's sans stack (index.css `--font-sans`), used when the computed body font is unavailable. */
export const FALLBACK_FONT = "'Manrope', ui-sans-serif, system-ui, sans-serif";

/** Diagram label size in slide pixels (slide body copy is 25px; in-house diagram labels ≈ 15–18). */
export const MERMAID_FONT_PX = 21;
const MERMAID_FONT_SIZE = `${MERMAID_FONT_PX}px`;

/**
 * Build Mermaid `themeVariables` from the design tokens. `read` returns a token's current value
 * (e.g. via `getComputedStyle`); an empty value is **skipped** so Mermaid derives that color itself
 * rather than choking on `''`. Flat by design: no gradients, no drop shadows.
 */
export function themeVariablesFromTokens(
  read: (token: string) => string,
  opts: { dark: boolean; fontFamily?: string },
): MermaidThemeVariables {
  const vars: MermaidThemeVariables = {
    darkMode: opts.dark,
    fontFamily: opts.fontFamily?.trim() || FALLBACK_FONT,
    fontSize: MERMAID_FONT_SIZE,
    useGradient: false,
    dropShadow: 'none',
  };
  for (const [name, token] of Object.entries(TOKEN_THEME_VARIABLES)) {
    const value = read(token).trim();
    if (value !== '') vars[name] = value;
  }
  return vars;
}

/** Read the live tokens + theme off `<html>` (browser only). */
export function currentThemeVariables(root: HTMLElement = document.documentElement) {
  const style = getComputedStyle(root);
  return themeVariablesFromTokens((token) => style.getPropertyValue(token), {
    dark: root.dataset.theme === 'dark',
    fontFamily: getComputedStyle(document.body).fontFamily,
  });
}

/**
 * Config keys a diagram's own frontmatter / `%%{init}%%` directive may **not** override: Mermaid's
 * defaults plus everything that guarantees strict + token-themed output.
 */
export const SECURE_KEYS = [
  'secure',
  'securityLevel',
  'startOnLoad',
  'maxTextSize',
  'suppressErrorRendering',
  'maxEdges',
  'htmlLabels',
  'theme',
  'themeVariables',
  'themeCSS',
  'darkMode',
  'look',
  'fontFamily',
];

/** The full Mermaid config for a given set of theme variables. Pure. */
export function buildMermaidConfig(themeVariables: MermaidThemeVariables): MermaidConfig {
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    htmlLabels: false,
    theme: 'base',
    // Mermaid 12 defaults some diagrams (e.g. flowchart) to the gradient/shadow `neo` look and a
    // `redux-color` theme; pinning both at the root keeps every kind on the flat, token-fed base.
    look: 'classic',
    // Mermaid 12 defaults to the ELK layout engine (a separate ~1.4 MB chunk) for every diagram.
    // Dagre (~0.1 MB) lays out the flowchart / state / class / ER subset fine; a diagram can still
    // opt into `layout: elk` in its frontmatter if it truly needs it.
    layout: 'dagre',
    themeVariables,
    fontFamily: String(themeVariables.fontFamily ?? FALLBACK_FONT),
    // Mermaid lays text out at this numeric size; it must match the CSS size or labels overflow /
    // wrap mid-word.
    fontSize: MERMAID_FONT_PX,
    // Slide-tuned layout (a diagram's frontmatter may still override): tighter spacing than
    // Mermaid's page-oriented 50/50 so a 5–6-step left→right flow fits the 1120px slide column, and
    // a label wrap width sized for the larger slide font (Mermaid 12's 120px default splits words
    // like "Hypothesize" mid-word at 21px).
    flowchart: { nodeSpacing: 30, rankSpacing: 36, wrappingWidth: 220 },
    state: { wrappingWidth: 220 },
    // Throw on bad input instead of drawing Mermaid's "syntax error" bomb — we show the source.
    suppressErrorRendering: true,
    secure: SECURE_KEYS,
  };
}

let idSeq = 0;

/**
 * A fresh, CSS-safe element id for one Mermaid render. Mermaid scopes the diagram's `<style>` and
 * marker ids by this id, so two diagrams on one slide — or a re-render on theme change — must never
 * share one. Unique for the life of the page.
 */
export function nextMermaidId(): string {
  idSeq += 1;
  return `se-mermaid-${idSeq}`;
}

/** Why a rendered SVG must not be mounted, or `null` if it is fine. Defence in depth after strict. */
export function svgProblem(svg: string): string | null {
  if (!/^\s*<svg[\s>]/i.test(svg)) return 'output is not an <svg> element';
  // Label text is entity-escaped, so these only match real tags / attributes.
  if (/<foreignObject[\s>/]/i.test(svg)) return 'HTML labels (<foreignObject>) are not supported';
  if (/<script[\s>/]/i.test(svg)) return 'output contains a <script>';
  if (/<[^>]*\son[a-z]+\s*=/i.test(svg)) return 'output contains an inline event handler';
  if (/<[^>]*=\s*["']?\s*javascript:/i.test(svg)) return 'output contains a javascript: URL';
  return null;
}

/** Outcome of one render: the SVG markup, or the stage that failed and why. */
export type MermaidOutcome =
  | { ok: true; id: string; svg: string }
  | { ok: false; stage: 'import' | 'parse' | 'render'; error: unknown };

/** The last config each Mermaid instance was initialized with (so we re-initialize only on change). */
const configured = new WeakMap<MermaidApi, string>();

/** Initialize `api` for these theme variables unless it already is. Returns whether it ran. */
export function ensureInitialized(api: MermaidApi, themeVariables: MermaidThemeVariables): boolean {
  const key = JSON.stringify(themeVariables);
  if (configured.get(api) === key) return false;
  api.initialize(buildMermaidConfig(themeVariables));
  configured.set(api, key);
  return true;
}

/**
 * Mermaid's config is global, so an initialize + parse + render must not interleave with another
 * diagram's (e.g. two diagrams mid-render when the theme flips). Every render goes through this
 * one-at-a-time queue.
 */
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Load Mermaid (lazily), initialize it for `themeVariables`, validate with `mermaid.parse`, and
 * render to an SVG string. Never throws: every failure comes back as `{ ok: false, stage }` so the
 * caller can fall back to the source as a code block.
 */
export async function renderMermaid(
  source: string,
  opts: { themeVariables: MermaidThemeVariables; load?: MermaidLoader; id?: string },
): Promise<MermaidOutcome> {
  let api: MermaidApi;
  try {
    api = await (opts.load ?? loadMermaid)();
  } catch (error) {
    return { ok: false, stage: 'import', error };
  }
  const id = opts.id ?? nextMermaidId();
  return serialized(async (): Promise<MermaidOutcome> => {
    try {
      ensureInitialized(api, opts.themeVariables);
      await api.parse(source);
    } catch (error) {
      return { ok: false, stage: 'parse', error };
    }
    try {
      const { svg } = await api.render(id, source);
      const problem = svgProblem(svg);
      if (problem) return { ok: false, stage: 'render', error: new Error(problem) };
      return { ok: true, id, svg };
    } catch (error) {
      return { ok: false, stage: 'render', error };
    }
  });
}

/** Minimal observer shape (so tests can drive {@link watchTheme} without a DOM). */
export interface ThemeObserver {
  observe(target: Node, options: MutationObserverInit): void;
  disconnect(): void;
}
export type ThemeObserverCtor = new (callback: () => void) => ThemeObserver;

/**
 * Call `onChange` whenever `data-theme` on `root` actually changes value. Returns an unsubscribe.
 * (The theme toggle in `useTheme` flips that attribute; every `--se-*` token re-resolves from it.)
 */
export function watchTheme(
  root: Node & { dataset: DOMStringMap },
  onChange: () => void,
  Observer: ThemeObserverCtor = MutationObserver,
): () => void {
  let last = root.dataset.theme;
  const observer = new Observer(() => {
    const now = root.dataset.theme;
    if (now === last) return;
    last = now;
    onChange();
  });
  observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

/**
 * Parse Mermaid's SVG markup into an element with `DOMParser` (XML first; HTML parsing as a lenient
 * fallback for entity quirks) — inert, nothing executes during parsing. `null` if there is no SVG.
 */
export function parseSvg(svg: string): SVGSVGElement | null {
  const parser = new DOMParser();
  const xml = parser.parseFromString(svg, 'image/svg+xml');
  const root = xml.documentElement;
  if (root.localName === 'svg' && xml.getElementsByTagName('parsererror').length === 0) {
    return root as unknown as SVGSVGElement;
  }
  return parser.parseFromString(svg, 'text/html').querySelector('svg');
}

/** Replace `container`'s children with the parsed SVG. Returns `false` (and leaves it) on failure. */
export function mountSvg(container: Element, svg: string): boolean {
  const el = parseSvg(svg);
  if (!el) return false;
  container.replaceChildren(container.ownerDocument.importNode(el, true));
  return true;
}
