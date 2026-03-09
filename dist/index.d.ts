export { C as ContentBlock, M as MathBlockData, P as PaperFigureData, c as PaperLabelInfo, a as PaperSectionData, b as PaperTheoremData } from './output-zFciSIqc.js';

/** Discriminated union of all LaTeX AST node types. */
interface TextNode {
    type: "text";
    value: string;
}
interface MathNode {
    type: "math";
    value: string;
    display: boolean;
    /** Original content before label stripping — used by label collection. */
    rawValue?: string;
}
interface CommandNode {
    type: "command";
    name: string;
    args: LatexNode[][];
    optArgs?: LatexNode[][];
}
interface EnvironmentNode {
    type: "environment";
    name: string;
    args?: LatexNode[][];
    optArgs?: LatexNode[][];
    body: LatexNode[];
}
interface GroupNode {
    type: "group";
    body: LatexNode[];
}
interface CommentNode {
    type: "comment";
    value: string;
}
interface ParagraphBreakNode {
    type: "paragraphBreak";
}
interface SectionNode {
    type: "section";
    level: "chapter" | "section" | "subsection" | "subsubsection";
    starred: boolean;
    title: LatexNode[];
}
interface TheoremNode {
    type: "theorem";
    envType: string;
    name?: LatexNode[];
    body: LatexNode[];
}
interface ListNode {
    type: "list";
    ordered: boolean;
    items: LatexNode[][];
}
interface DescriptionNode {
    type: "description";
    items: {
        term: LatexNode[];
        body: LatexNode[];
    }[];
}
interface FigureNode {
    type: "figure";
    filename?: string;
    caption?: LatexNode[];
    label?: string;
    options?: string;
}
interface ProofNode {
    type: "proof";
    body: LatexNode[];
}
interface QuoteNode {
    type: "quote";
    body: LatexNode[];
}
interface LabelNode {
    type: "label";
    key: string;
}
type LatexNode = TextNode | MathNode | CommandNode | EnvironmentNode | GroupNode | CommentNode | ParagraphBreakNode | SectionNode | TheoremNode | ListNode | DescriptionNode | FigureNode | ProofNode | QuoteNode | LabelNode;

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

export { type BibEntry, type CommandNode, type CommentNode, type DescriptionNode, type EnvironmentNode, type FigureNode, type GroupNode, type LabelInfo, type LabelNode, LabelRegistry, type LatexNode, type ListNode, type MathNode, type ParagraphBreakNode, type ProofNode, type QuoteNode, type SectionNode, type TextNode, type TheoremNode, astToText, parseBibString, parseBibToMap, parseInlineString, parseLatex };
