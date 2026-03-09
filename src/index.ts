/**
 * @mkbabb/latex-paper — Pure parser entry point (no KaTeX dependency).
 *
 * Exports the LaTeX and BibTeX parsers, AST types, and utilities.
 */

// AST types
export type {
    LatexNode,
    TextNode,
    MathNode,
    CommandNode,
    EnvironmentNode,
    GroupNode,
    CommentNode,
    ParagraphBreakNode,
    SectionNode,
    TheoremNode,
    ListNode,
    DescriptionNode,
    FigureNode,
    ProofNode,
    QuoteNode,
    LabelNode,
} from "./types/ast";

// Output types
export type {
    PaperSectionData,
    PaperTheoremData,
    PaperFigureData,
    PaperLabelInfo,
} from "./types/output";

// BibTeX types
export type { BibEntry } from "./types/bibtex";

// Parsers
export { parseLatex, parseInlineString, astToText } from "./grammar/document";
export { parseBibString, parseBibToMap } from "./bibtex/parser";

// Labels
export { LabelRegistry } from "./transform/labels";
export type { LabelInfo } from "./transform/labels";
