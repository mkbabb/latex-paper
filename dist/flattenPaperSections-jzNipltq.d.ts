interface PaperTheoremData {
    type: "theorem" | "definition" | "lemma" | "proposition" | "corollary" | "aside" | "example";
    name?: string;
    /** Theorem number (e.g., "1.3") from the label registry. */
    number?: string;
    body: string;
    math?: string[];
    label?: string;
}
interface PaperFigureData {
    filename: string;
    caption: string;
    label?: string;
}
/** A standalone display equation between paragraphs. */
interface MathBlockData {
    tex: string;
    /** Element ID for scroll-to targeting (e.g. "eq-f3"). */
    id?: string;
}
/** Wrapper to embed a theorem in the content stream. */
interface TheoremBlock {
    theorem: PaperTheoremData;
}
/** Wrapper to embed a figure in the content stream. */
interface FigureBlock {
    figure: PaperFigureData;
}
/**
 * A content block in document order.
 * - `string` → paragraph HTML
 * - `MathBlockData` → display equation (has `.tex`)
 * - `TheoremBlock` → theorem/definition/lemma (has `.theorem`)
 * - `FigureBlock` → figure (has `.figure`)
 */
type ContentBlock = string | MathBlockData | TheoremBlock | FigureBlock;
interface PaperSectionData {
    id: string;
    number: string;
    title: string;
    /** Original LaTeX sectioning level: 0=chapter, 1=section, 2=subsection, 3=subsubsection. */
    sourceLevel?: number;
    /** Whether the source heading used a starred LaTeX form (for example, \subsection*{...}). */
    starred?: boolean;
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
interface PaperLabelInfo {
    /** Display number (e.g. "2.3", "1.5") */
    number: string;
    /** Type of labeled item */
    type: "section" | "theorem" | "figure" | "equation";
    /** Section ID (slug) containing this label */
    sectionId: string;
    /** Element-level ID for precise scroll targeting (e.g. "thm-sturm_proof") */
    elementId?: string;
}

interface FlatPaperSection {
    id: string;
    index: number;
    depth: number;
    sourceLevel: number;
    starred: boolean;
    parentId: string | null;
    rootId: string;
    rootIndex: number;
    section: PaperSectionData;
    estimatedHeight: number;
}
declare function estimatePaperSectionHeight(section: PaperSectionData, depth: number): number;
declare function flattenPaperSections(sections: PaperSectionData[]): FlatPaperSection[];

export { type ContentBlock as C, type FigureBlock as F, type MathBlockData as M, type PaperFigureData as P, type TheoremBlock as T, type PaperSectionData as a, type PaperTheoremData as b, type PaperLabelInfo as c, type FlatPaperSection as d, estimatePaperSectionHeight as e, flattenPaperSections as f };
