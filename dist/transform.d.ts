import { a as PaperSectionData, d as CompiledPaperMetadata, e as PaperLabelInfo, L as LatexNode } from './flattenPaperSections-CN98CCOQ.js';
export { g as CodeBlock, h as CodeBlockNode, i as CommandNode, j as CommentNode, k as CompiledBibliographyItem, l as CompiledLabelEntry, C as CompiledTocEntry, m as ContentBlock, D as DescriptionNode, E as EnvironmentNode, F as FigureBlock, n as FigureNode, o as FlatPaperSection, G as GroupNode, q as LabelNode, r as ListNode, M as MathBlockData, s as MathNode, t as PaperCodeBlockData, P as PaperFigureData, u as PaperNestedBlock, v as PaperProofData, b as PaperTheoremData, w as ParagraphBreakNode, x as ProofBlock, y as ProofNode, Q as QuoteNode, S as SectionNode, T as TextNode, z as TheoremBlock, A as TheoremCounterConfig, B as TheoremNode, H as createCompiledPaperMetadata, I as estimatePaperSectionHeight, f as flattenPaperSections, J as parseBibliographyItems, K as parseLatexAuxLabels, c as parseLatexLogTotalPages, p as parseLatexTocEntries, N as parseTheoremCounterConfigs } from './flattenPaperSections-CN98CCOQ.js';
import { BibEntry } from './index.js';
export { LabelInfo, LabelRegistry, astToText, parseBibString, parseBibToMap, parseInlineString, parseLatex } from './index.js';

/**
 * Raw LaTeX text cleanup utilities.
 *
 * Text nodes from braceBalanced() contain raw LaTeX (accents, dashes,
 * nested commands, etc.). cleanRawLatex() processes these patterns,
 * mirroring the old regex-based parser's cleanProseSegment().
 */
/**
 * Clean residual LaTeX patterns from text node content.
 *
 * Math segments ($...$) are preserved verbatim.
 *
 * @param labelResolver Optional function to resolve \ref{key} → number string.
 */
declare function cleanRawLatex(text: string, labelResolver?: (key: string) => string | undefined): string;

/**
 * Output validation — scan transformed PaperSectionData for
 * suspicious unprocessed LaTeX patterns.
 */

interface ValidationIssue {
    path: string;
    text: string;
    pattern: string;
    match: string;
}
/**
 * Scan transformed output for suspicious unprocessed LaTeX patterns.
 * Returns a list of issues found.
 */
declare function validateOutput(sections: PaperSectionData[]): ValidationIssue[];

/**
 * AST → HTML transformer orchestrator.
 *
 * Delegates to:
 *   - CounterManager  (counters.ts)  — equation/theorem/section numbering
 *   - CommandRenderer  (commands.ts)  — \command → HTML dispatch
 *   - ContentExtractor (content.ts)   — walk nodes → ContentBlock[]
 *   - SectionBuilder   (sections.ts)  — build PaperSectionData[] hierarchy
 */

interface TransformOptions {
    /** KaTeX macros (merged with defaults). */
    macros?: Record<string, string>;
    /** Section callout mapping: section id → { text, link }. */
    callouts?: Record<string, {
        text: string;
        link: string;
    }>;
    /** Custom math renderer. Default: KaTeX if available. */
    renderMath?: (tex: string, displayMode: boolean) => string;
    /** Bibliography entries for \cite resolution. */
    bibEntries?: Map<string, BibEntry>;
    /** Canonical compiled metadata from LaTeX artifacts. */
    compiledMetadata?: CompiledPaperMetadata;
}
/** Default KaTeX macros used in the fourier_paper. */
declare const DEFAULT_MACROS: Record<string, string>;
/**
 * Transform a LaTeX AST into structured PaperSectionData[].
 */
declare class Transformer {
    private options;
    private bibEntries;
    private compiledMetadata?;
    private labels;
    private citedKeys;
    private citedKeySet;
    private sourceLabelTypes;
    private labelSections;
    private sectionAnchors;
    private sectionNumbers;
    private sectionTitles;
    /** After transform(), contains label key → location mapping. */
    labelMap: Record<string, PaperLabelInfo>;
    private counters;
    private commandRenderer;
    private contentExtractor;
    constructor(options?: TransformOptions);
    private resolveLabel;
    private resolveLabelNumber;
    private labelKeyToAnchorId;
    private inferLabelType;
    private findSectionIdForLabel;
    private inferTheoremLikeType;
    /** Initialize sub-modules that need references to `this`. */
    private initModules;
    /** Transform a full AST (typically from parseLatex) into sections. */
    transform(nodes: LatexNode[]): PaperSectionData[];
    private collectSourceLabelTypes;
    private recordCitations;
    /** Convert a single AST node to HTML string. */
    nodeToHtml(node: LatexNode): string;
    private listToHtml;
    private descriptionToHtml;
    /** Convert an array of nodes to HTML. */
    nodesToHtml(nodes: LatexNode[]): string;
}
/** Result of transformDocument including label map for cross-references. */
interface TransformResult {
    sections: PaperSectionData[];
    labelMap: Record<string, PaperLabelInfo>;
}
/**
 * Full pipeline: parse LaTeX AST → PaperSectionData[] + label map.
 */
declare function transformDocument(nodes: LatexNode[], options?: TransformOptions): TransformResult;

export { BibEntry, CompiledPaperMetadata, DEFAULT_MACROS, LatexNode, PaperLabelInfo, PaperSectionData, type TransformOptions, type TransformResult, Transformer, type ValidationIssue, cleanRawLatex, transformDocument, validateOutput };
