# latex-paper

LaTeX in, navigable paper data out.

`latex-paper` parses `.tex` and `.bib`, resolves labels and citations, builds a typed section tree, and can expose the result as a Vite virtual module. The Vue entry point adds the rendering and windowing primitives used by the paper view in `fourier-analysis`.

See [docs/virtual-paper.md](docs/virtual-paper.md) for the end-to-end path.

## Install

```bash
npm install @mkbabb/latex-paper
```

## Entry points

| Export | Purpose |
| --- | --- |
| `@mkbabb/latex-paper` | Pure parser types and helpers |
| `@mkbabb/latex-paper/transform` | AST → `PaperSectionData[]` transform |
| `@mkbabb/latex-paper/vite` | Build-time virtual module for paper content |
| `@mkbabb/latex-paper/vue` | Vue components and virtual-window composables |
| `@mkbabb/latex-paper/theme` | Base paper styles |

## Core path

1. `parseLatex()` builds the AST.
2. `Transformer` turns that AST into `PaperSectionData[]`, interleaving prose, display math, theorems, and figures as `content` blocks.
3. `flattenPaperSections()` derives a stable depth-first list with hierarchy metadata and height estimates.
4. `useVirtualSectionWindow()` turns that flat list into a bounded render window with top and bottom spacers.
5. `latexPaperPlugin()` emits `paperSections`, `labelMap`, `pageMap`, and `totalPages` through `virtual:paper-content`.

The page map is ordered, not title-matched. It is built from LaTeX TOC artifacts, so math-heavy headings no longer fall back to page `1`.

## Quick start

```ts
import latexPaperPlugin from "@mkbabb/latex-paper/vite";

export default {
    plugins: [
        latexPaperPlugin({
            texPath: "paper/main.tex",
            bibPath: "paper/refs.bib",
        }),
    ],
};
```

```ts
import { paperSections, labelMap, pageMap, totalPages } from "virtual:paper-content";
```

## Vue primitives

- `PaperSection` renders the heading shell.
- `PaperSectionBlocks` renders one section body without recursive subsection mounting.
- `flattenPaperSections()` exposes `id`, `index`, `depth`, `parentId`, `rootId`, `sourceLevel`, `starred`, and `estimatedHeight`.
- `useVirtualSectionWindow()` returns the visible slice, spacer sizes, active section state, and offset helpers for scroll navigation.

## Output shape

```ts
interface PaperSectionData {
    id: string;
    number: string;
    title: string;
    sourceLevel?: number;
    starred?: boolean;
    content: ContentBlock[];
    theorems?: PaperTheoremData[];
    figures?: PaperFigureData[];
    subsections?: PaperSectionData[];
    callout?: { text: string; link: string };
    summary?: string;
}
```

`ContentBlock` is one of:

- paragraph HTML string
- display-math block
- theorem block
- figure block

## Development

```bash
npm test
npm run build
npm pack
```

## Notes

- KaTeX is optional at the package level and used by the Vue entry point.
- The library ships built `dist/` artifacts and a packed tarball because `fourier-analysis` consumes it through the vendored tarball workflow.
