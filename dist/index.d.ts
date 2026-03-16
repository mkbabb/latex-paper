import { L as LatexNode } from './flattenPaperSections-CN98CCOQ.js';
export { g as CodeBlock, h as CodeBlockNode, i as CommandNode, j as CommentNode, k as CompiledBibliographyItem, l as CompiledLabelEntry, d as CompiledPaperMetadata, C as CompiledTocEntry, m as ContentBlock, D as DescriptionNode, E as EnvironmentNode, F as FigureBlock, n as FigureNode, o as FlatPaperSection, G as GroupNode, q as LabelNode, r as ListNode, M as MathBlockData, s as MathNode, t as PaperCodeBlockData, P as PaperFigureData, e as PaperLabelInfo, u as PaperNestedBlock, v as PaperProofData, a as PaperSectionData, b as PaperTheoremData, w as ParagraphBreakNode, x as ProofBlock, y as ProofNode, Q as QuoteNode, S as SectionNode, T as TextNode, z as TheoremBlock, A as TheoremCounterConfig, B as TheoremNode, H as createCompiledPaperMetadata, I as estimatePaperSectionHeight, f as flattenPaperSections, J as parseBibliographyItems, K as parseLatexAuxLabels, c as parseLatexLogTotalPages, p as parseLatexTocEntries, N as parseTheoremCounterConfigs } from './flattenPaperSections-CN98CCOQ.js';

interface BibEntry {
    key: string;
    type: string;
    author: string;
    shortAuthor: string;
    year: string;
    title: string;
    fields: Record<string, string>;
}

/**
 * Top-level document parser: inlineNode dispatch + parseLatex().
 */

/** Parse a complete LaTeX document string into an AST. */
declare function parseLatex(source: string): LatexNode[];
/** Parse a LaTeX string meant for inline content (e.g., theorem name, caption). */
declare function parseInlineString(source: string): LatexNode[];
/**
 * Flatten an AST to plain text, stripping all commands and environments.
 * Useful for generating slugs, TOC entries, etc.
 */
declare function astToText(nodes: LatexNode[]): string;

/**
 * BibTeX parser: parseBibString() and parseBibFile().
 * Uses hand-written combinators (the BBNF grammar is available as documentation,
 * but the combinator approach is more robust for real-world .bib files).
 */

/**
 * Parse a BibTeX string into an array of BibEntry objects.
 * Uses regex extraction — robust for real-world .bib files.
 */
declare function parseBibString(source: string): BibEntry[];
/**
 * Parse a BibTeX string and return a Map keyed by citation key.
 */
declare function parseBibToMap(source: string): Map<string, BibEntry>;

/**
 * LabelRegistry: two-pass cross-reference resolution.
 * Pass 1: collect all \label{key} nodes and assign numbers.
 * Pass 2: resolve \ref{key} and \eqref{key} to their numbers.
 */

interface LabelInfo {
    key: string;
    number: string;
    type: "section" | "theorem" | "figure" | "equation";
    /** Section ID (slug) containing this label, set during transform. */
    sectionId?: string;
}
declare class LabelRegistry {
    private labels;
    private sectionCounters;
    private theoremCounter;
    private figureCounter;
    private equationCounter;
    /** Current section number string — standalone \label nodes inherit this. */
    private currentSectionNumber;
    /** Current section type for standalone labels. */
    private currentSectionType;
    /** Collect all labels from an AST (pass 1). */
    collectLabels(nodes: LatexNode[]): void;
    /** Resolve a label key to its info. Returns undefined if not found. */
    resolve(key: string): LabelInfo | undefined;
    /** Get all collected labels. */
    all(): Map<string, LabelInfo>;
    private visitNode;
    private visitSection;
    private visitTheorem;
    private visitFigure;
    private visitMath;
}

export { type BibEntry, type LabelInfo, LabelRegistry, LatexNode, astToText, parseBibString, parseBibToMap, parseInlineString, parseLatex };
