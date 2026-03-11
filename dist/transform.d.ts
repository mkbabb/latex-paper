import { BibEntry, LatexNode } from './index.js';
export { CommandNode, CommentNode, DescriptionNode, EnvironmentNode, FigureNode, GroupNode, LabelInfo, LabelNode, LabelRegistry, ListNode, MathNode, ParagraphBreakNode, ProofNode, QuoteNode, SectionNode, TextNode, TheoremNode, astToText, parseBibString, parseBibToMap, parseInlineString, parseLatex } from './index.js';
import { a as PaperSectionData, c as PaperLabelInfo } from './flattenPaperSections-jzNipltq.js';
export { C as ContentBlock, F as FigureBlock, d as FlatPaperSection, M as MathBlockData, P as PaperFigureData, b as PaperTheoremData, T as TheoremBlock, e as estimatePaperSectionHeight, f as flattenPaperSections } from './flattenPaperSections-jzNipltq.js';

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
 * AST → HTML transformer with configurable macros and callouts.
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
}
/** Default KaTeX macros used in the fourier_paper. */
declare const DEFAULT_MACROS: Record<string, string>;
/**
 * Transform a LaTeX AST into structured PaperSectionData[].
 */
declare class Transformer {
    private options;
    private bibEntries;
    private labels;
    /** After transform(), contains label key → location mapping. */
    labelMap: Record<string, PaperLabelInfo>;
    constructor(options?: TransformOptions);
    /** Transform a full AST (typically from parseLatex) into sections. */
    transform(nodes: LatexNode[]): PaperSectionData[];
    private buildSectionHierarchy;
    /** Recursively tag labels found in AST nodes with a section ID. */
    private tagLabelsInNodes;
    /** Build the public labelMap from the registry. */
    private buildLabelMap;
    /** Generate content summary strings for each section (recursive). */
    private generateSummaries;
    private cleanEmpty;
    /**
     * Extract all content blocks in document order: paragraphs, display math,
     * theorems, and figures interleaved as they appear in the source.
     */
    private extractContent;
    private transformTheorem;
    /** Convert a single AST node to HTML string. */
    nodeToHtml(node: LatexNode): string;
    private commandToHtml;
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

export { BibEntry, DEFAULT_MACROS, LatexNode, PaperLabelInfo, PaperSectionData, type TransformOptions, type TransformResult, Transformer, type ValidationIssue, cleanRawLatex, transformDocument, validateOutput };
