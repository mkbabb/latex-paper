export interface PaperTheoremData {
    type: "theorem" | "definition" | "lemma" | "proposition" | "corollary" | "aside" | "example";
    name?: string;
    /** Theorem number (e.g., "1.3") from the label registry. */
    number?: string;
    body: string;
    math?: string[];
    label?: string;
}
export interface PaperFigureData {
    filename: string;
    caption: string;
    label?: string;
}
/** A standalone display equation between paragraphs. */
export interface MathBlockData {
    tex: string;
    /** Element ID for scroll-to targeting (e.g. "eq-f3"). */
    id?: string;
}
/**
 * A content block is either a paragraph (HTML string) or a display math block.
 * Use `typeof block === "string"` to distinguish.
 */
export type ContentBlock = string | MathBlockData;
export interface PaperSectionData {
    id: string;
    number: string;
    title: string;
    /**
     * Interleaved paragraphs and display equations in document order.
     * Strings are paragraph HTML; MathBlockData are display equations.
     */
    content: ContentBlock[];
    theorems?: PaperTheoremData[];
    figures?: PaperFigureData[];
    subsections?: PaperSectionData[];
    callout?: {
        text: string;
        link: string;
    };
    /** Summary of content counts (e.g., "3 theorems, 2 definitions"). */
    summary?: string;
}
/** Maps label keys to their resolved location in the paper. */
export interface PaperLabelInfo {
    /** Display number (e.g. "2.3", "1.5") */
    number: string;
    /** Type of labeled item */
    type: "section" | "theorem" | "figure" | "equation";
    /** Section ID (slug) containing this label */
    sectionId: string;
    /** Element-level ID for precise scroll targeting (e.g. "thm-sturm_proof") */
    elementId?: string;
}
//# sourceMappingURL=output.d.ts.map