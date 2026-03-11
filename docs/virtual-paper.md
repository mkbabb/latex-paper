# Virtual paper pipeline

This is the paper path, stripped to the load-bearing parts.

## 1. Parse

`parseLatex()` produces a typed AST. `parseBibToMap()` handles citations.

## 2. Transform

`Transformer` walks the AST and emits `PaperSectionData[]`.

Each section carries:

- heading metadata
- `content` blocks in document order
- theorem and figure side data
- recursive `subsections`
- label targets and summaries

The important detail is that the section body is already normalized. The Vue layer does not need to rediscover where prose stops and display math begins.

## 3. Flatten

`flattenPaperSections()` converts the recursive tree into one depth-first list.

Each flat item includes:

- `id`
- `index`
- `depth`
- `parentId`
- `rootId`
- `rootIndex`
- `sourceLevel`
- `starred`
- `estimatedHeight`

That flat list is the navigation and virtualization substrate. The recursive tree remains the semantic source; the flat list is the layout source.

## 4. Window

`useVirtualSectionWindow()` consumes the flat list and a scroll container.

It computes:

- `visibleItems`
- `topSpacerPx`
- `bottomSpacerPx`
- `activeId`
- `activeRootId`
- `getOffsetFor(id)`
- `ensureTargetWindow(id)`

The default pattern is:

1. start from estimated heights
2. render a bounded slice
3. measure mounted sections
4. cache those heights for the session
5. recompute offsets from the better data

This keeps the DOM small without losing deterministic scroll math.

## 5. Page mapping

`latexPaperPlugin()` reads LaTeX build artifacts:

- `.log` for `totalPages`
- `.aux` TOC entries for ordered section pages

`buildPageMapFromTocEntries()` assigns pages by traversal order, not by slugged title text. That matters for headings with inline math, braces, or symbols.

Starred headings do not consume TOC entries. They inherit the last known page instead.

## 6. Consumer contract

The Vite virtual module exposes:

- `paperSections`
- `labelMap`
- `pageMap`
- `totalPages`

The consumer can then choose its own renderer. `fourier-analysis` uses the Vue entry point and drives section navigation from the flat list rather than from a fully mounted tree.

## Why this is faster

- The whole paper tree is no longer mounted at once.
- Active-section tracking is computed from layout state, not from a forest of live observers.
- Far jumps warm only a small neighborhood around the target.
- Page numbers are stable because they are keyed to LaTeX’s own TOC order.
