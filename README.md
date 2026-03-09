# latex-paper

LaTeX-to-structured-HTML parser and transformer. Parses `.tex` and `.bib` files into a typed AST, transforms that AST into hierarchical `PaperSectionData` for rendering academic papers on the web.

## Install

```bash
npm install @mkbabb/latex-paper
```

## Quick Start

```ts
import { parseLatex, parseBibToMap } from "@mkbabb/latex-paper";
import { transformDocument } from "@mkbabb/latex-paper/transform";

const ast = parseLatex(texSource);
const { sections, labelMap } = transformDocument(ast, {
    bibEntries: parseBibToMap(bibSource),
});
```

Math is preserved as raw TeX strings (`$x^2$`, `\begin{align}...`), leaving rendering to the consumer. KaTeX is an optional peer dependency.

## Entry Points

Three subpath exports with increasing dependency footprint:

| Export | Source | Includes |
|---|---|---|
| `@mkbabb/latex-paper` | `src/index.ts` | Pure parser: AST types, `parseLatex`, `parseBibString`, `LabelRegistry` |
| `@mkbabb/latex-paper/transform` | `src/transform.ts` | Re-exports above + `Transformer`, `transformDocument`, `cleanRawLatex`, `validateOutput` |
| `@mkbabb/latex-paper/vite` | `src/vite.ts` | Vite plugin: build-time parse+transform, virtual module, HMR |

## Structure

```
src/
├── index.ts                # Pure parser entry point (no KaTeX)
├── transform.ts            # Parser + AST→HTML transformer
├── vite.ts                 # Vite plugin
├── types/
│   ├── ast.ts              # LatexNode discriminated union (15 node types)
│   ├── bibtex.ts           # BibEntry interface
│   └── output.ts           # PaperSectionData, PaperTheoremData, PaperFigureData, PaperLabelInfo
├── grammar/
│   ├── primitives.ts       # Shared parser primitives, lazy inlineNode registration
│   ├── compile.ts          # BBNF grammar compilation
│   ├── document.ts         # Top-level inlineNode dispatch, parseLatex(), astToText()
│   ├── text.ts             # Plain text, dashes, smart quotes, accents, symbols→Unicode
│   ├── math.ts             # Inline/display math delimiters, math environments
│   ├── commands.ts         # Sections, formatting, refs, cites, figures, &c.
│   └── environments.ts     # \begin{X}...\end{X} context-sensitive dispatch
├── transform/
│   ├── html.ts             # Transformer class, cleanRawLatex, validateOutput
│   └── labels.ts           # LabelRegistry: two-pass cross-reference resolution
├── bibtex/
│   └── parser.ts           # BibTeX parser (regex-based)
└── utils/
    └── accents.ts          # LaTeX accent→Unicode maps

grammar/                    # BBNF grammar files (loaded as raw text by tsup)
├── latex-tokens.bbnf
├── latex-commands.bbnf
└── bibtex.bbnf
```

## Parsing

### LaTeX

Built on [`@mkbabb/parse-that`](https://github.com/mkbabb/parse-that) combinators and [`@mkbabb/bbnf-lang`](https://github.com/mkbabb/bbnf-lang) for grammar compilation. LaTeX is context-sensitive—environment names determine how bodies are parsed, commands have heterogeneous argument structures—so the actual dispatch is hand-written combinators while the BBNF grammars define token-level structure.

`parseLatex(source)` loops over an `inlineNode` dispatch parser trying each sub-parser in priority order: comments, paragraph breaks, display/inline math, typography (`---`→em dash, `--`→en dash, smart quotes), environments, sections, accents, formatting, references, citations, skip/spacing commands, escaped characters, then plain text as catch-all.

Environments dispatch context-sensitively via `.chain()` on the name: math envs (`equation`, `align`, `gather`, &c.) capture raw content; theorem-like envs produce `TheoremNode`s; lists split on `\item`; figures extract `\includegraphics`/`\caption`/`\label`; and unsupported envs (`center`, `tabular`, `tikzpicture`, &c.) are consumed and discarded.

### BibTeX

`parseBibString(source)` extracts entries via regex, cleans LaTeX accents to Unicode, and computes `shortAuthor` (last name, or last name + "et al." for multiple authors).

```ts
const bib = parseBibToMap(bibSource);
bib.get("fourier1822"); // => { key, type, author, shortAuthor, year, title, fields }
```

## Transformation

`LabelRegistry` performs two-pass cross-reference resolution: walks the AST counting sections/theorems/figures/equations, assigns hierarchical numbers (e.g., `"2.3"` for theorem 3 in chapter 2), and resets sub-counters on new chapters.

The `Transformer` class converts the flat AST into hierarchical `PaperSectionData[]`: builds chapter/section/subsection hierarchy with auto-numbering, extracts paragraphs as HTML, extracts theorems and figures into their respective data types, resolves `\cite` to `[Author, Year]`, resolves `\ref`/`\eqref`/`\hyperref` to `<a class="paper-ref">` links, and converts formatting commands to HTML (`\textbf`→`<strong>`, `\emph`→`<em>`, `\texttt`→`<code>`, &c.).

`cleanRawLatex()` is a fallback for residual LaTeX patterns in text nodes. `validateOutput()` scans transformed output for unprocessed LaTeX and returns `ValidationIssue[]`.

## Vite Plugin

Build-time integration. Parses `.tex` and `.bib`, runs the full pipeline, and exposes a virtual module:

```ts
// vite.config.ts
import latexPaper from "@mkbabb/latex-paper/vite";

export default {
    plugins: [
        latexPaper({
            texPath: "paper/main.tex",
            bibPath: "paper/refs.bib",       // defaults to texPath with .bib extension
            macros: {},                       // KaTeX macro definitions
            callouts: {                       // section slug → { text, link }
                applications: { text: "See the demo", link: "/demo" },
            },
            virtualModuleId: "virtual:paper-content", // default
        }),
    ],
};
```

```ts
import { paperSections, labelMap } from "virtual:paper-content";
```

Watches both files and invalidates on change (HMR).

## Output Types

```ts
interface PaperSectionData {
    id: string;                          // slugified title
    number: string;                      // "1", "1.2", "1.2.3"
    title: string;
    paragraphs: string[];                // HTML strings
    theorems?: PaperTheoremData[];
    figures?: PaperFigureData[];
    subsections?: PaperSectionData[];    // recursive
    callout?: { text: string; link: string };
}

interface PaperTheoremData {
    type: "theorem" | "definition" | "lemma" | "proposition"
        | "corollary" | "aside" | "example";
    name?: string;
    body: string;                        // HTML
    math?: string[];                     // display math TeX strings
    label?: string;
}

interface PaperFigureData {
    filename: string;
    caption: string;                     // HTML
    label?: string;
}

interface PaperLabelInfo {
    number: string;                      // e.g. "2.3"
    type: "section" | "theorem" | "figure" | "equation";
    sectionId: string;
}
```

The parser produces a `LatexNode` discriminated union of 15 node types. See [`src/types/ast.ts`](src/types/ast.ts).

## Build & Development

```sh
npm run build           # library → dist/ (ESM + .d.ts)
npm test                # vitest run
npm run test:watch      # vitest (watch mode)
npm run test:coverage   # vitest with coverage
```

**Dependencies:** [`@mkbabb/parse-that`](https://github.com/mkbabb/parse-that) (parser combinators), [`@mkbabb/bbnf-lang`](https://github.com/mkbabb/bbnf-lang) (grammar compiler).

**Peer dependencies (optional):** `katex` ^0.16, `vite` ^6.0 || ^7.0.

**TypeScript:** `strict: true`, `verbatimModuleSyntax: true`, `target: ES2022`, `moduleResolution: bundler`.

## Sources, acknowledgements, &c.

- [`@mkbabb/parse-that`](https://github.com/mkbabb/parse-that) — Parser combinators powering the LaTeX grammar.
- [`@mkbabb/bbnf-lang`](https://github.com/mkbabb/bbnf-lang) — BBNF grammar compiler for token-level definitions.
- [KaTeX](https://katex.org/) — Math typesetting for the web.
- [Vite](https://vite.dev/) — Build tool; the plugin targets its plugin API.
