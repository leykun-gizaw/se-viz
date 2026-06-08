# Theory Authoring Conventions (Phase 20: slide decks)

Theory docs are the **read-first** conceptual explanation for a topic — the *telling* that precedes
SE-Viz's *showing*. A session runs **theory → visualization**. Since Phase 20 theory renders as a
**PowerPoint-style slide deck** (a fixed 16:9 canvas scaled to fit, large type, one slide per
screen) for live teaching and screen-share. Theory is a **separate content type from a `Trace`** — it
is not played by the engine and does not touch the trace format. This file is the contract the theory
content pass authors against.

## File location & naming (unchanged)

One Markdown file per sidebar **topic**, named `theory.md`, in that topic's folder:

```
src/content/<course>/<topic>/theory.md
```

Auto-discovered (a `?raw` glob in [`src/content/theory.ts`](../src/content/theory.ts)) and pinned
**first** within its topic in the sidebar. A topic may have a theory doc, modules, or both; no
`theory.md` simply means no Theory entry. No edit to any shared file is needed to add one.

## Required frontmatter (unchanged)

```markdown
---
course: SE 200
topic: Pointers, Arrays and Strings
title: Pointers, Arrays & Strings
order: 50
---
```

| Field | Required | Meaning |
| --- | --- | --- |
| `course` | yes | Course code — **must match `docs/CURRICULUM.md`** (e.g. `SE 200`). Never fabricate. |
| `topic` | yes | Topic — **must match the topic its modules use** (the sidebar group string). |
| `title` | yes | Deck title — rendered as the **auto title slide** (slide 1). |
| `order` | recommended | Sort hint. Use the topic's module `order` (theory always pins first). |

`course`/`topic` are validated against the catalog by `src/content/theory.test.ts`.

## Slides: the `---` separator

The body is split into slides on a **top-level `---`** (a thematic break on its own line, blank lines
around it). The `---` is a **slide separator** — never a rendered horizontal rule inside a slide.
A `---` inside a fenced code block is left alone.

```markdown
## First concept

- a bullet
- another

---

## Next concept

…
```

- **Slide 1 is auto-generated** from the frontmatter (title + `course · topic`). **Do not** write a
  title slide — start the body with your first concept slide.
- A deck needs ≥1 authored slide; empty slides are dropped.

## Per-slide content budget (keep slides light)

Each slide must fit the 16:9 frame at **large type**. Treat one slide as **one idea**:

- a **`##` slide title**, plus **one** of:
  - ~3–6 short bullets (nesting allowed — see below), **or**
  - one short code block (≈4–8 lines), **or**
  - one callout, **or**
  - a small table (≤6 rows), **or**
  - 2–3 short sentences.

If a slide feels crowded, split it across two. Short lines beat long paragraphs — this is a slide,
not a page. (The renderer will internally scroll an over-long slide as a last resort, but author to
fit.)

## Recommended deck arc

1. **(auto title slide)**
2. **Why it matters** — the hook, in a few bullets.
3. **Mental model** — the picture to hold.
4. **Syntax / the rules that matter** — a table or a short list.
5. **Common patterns.**
6. **Pitfalls / misconceptions** — great as `watch-out` callout slides.
7. **A worked example** — one code-block slide.
8. **Recap** — a `recap` callout.
9. **See it run** — name the topic's modules; close with the continue bridge.

## Supported Markdown

Rendered by [`src/engine/markdown.ts`](../src/engine/markdown.ts) → a typed AST → React (**never an
HTML string**, so it is safe by construction; raw HTML in the source shows literally and is not
executed).

- Headings `#`–`###` (use `##` for a slide title, `###` for a sub-head), paragraphs, **nested**
  lists, GFM pipe tables, blockquotes.
- Inline: `**bold**`, `*italic*`, `` `code` ``, `[text](https://…)` (http/https/mailto/in-page only).
- **Underscores are not emphasis** — C identifiers like `node_t` read literally. Use `*…*` for
  italics; wrap C in backticks/fences regardless.

### Nested lists (Phase 20)

Indent **2 spaces** per level. A more-indented run of items becomes a sub-list of the item above it:

```markdown
- top item
  - nested item
  - another nested item
- second top item
```

### Code blocks

Fenced blocks with a `c` (also `h`/`cpp`) info string get **C syntax highlighting** in `.se-code`
with **ligatures off** (`->`, `!=`, `<=`, `*p` render literally). Keep them short for slides:

````markdown
```c
int *p = &x;   /* p holds the address of x */
*p = 7;        /* write through the pointer */
```
````

### Callouts (shared visual language with in-viz coaching)

A blockquote whose first line is `> [!variant] Optional title` becomes a **callout** styled with the
**coach variant tokens** (same color + glyph as the in-visualization coach notes). Continuation lines
must each start with `>`. The set is small and fixed:

| Syntax | Use for |
| --- | --- |
| `> [!idea]` | the key insight / mental model |
| `> [!watch-out]` | a pitfall, misconception, or UB warning |
| `> [!predict]` | a "what do you think happens?" prompt |
| `> [!recap]` | a short summary of what to retain |

An unknown `[!type]` falls back to a plain blockquote.

## The visualization bridge

The deck always shows a persistent **"Continue to the visualization →"** button (it jumps to the
first module of the same topic — derived from the catalog, not authored). Close the deck with a "See
it run" slide that names the topic's modules so the hand-off reads naturally.

## Navigation & presentation (for reference)

The deck renderer ([`src/components/TheoryDeck.tsx`](../src/components/TheoryDeck.tsx)) provides
`Slide k / N`, prev/next, progress dots, `←/→` (Home/End) keys, and a fullscreen presentation surface
(`f`, `Esc` to exit) — the primary screen-share view. Works in dark + light; no slide-transition
animation (reduced-motion safe). Authors don't wire any of this; just write good slides.
