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
interface PaperSectionData {
    id: string;
    number: string;
    title: string;
    paragraphs: string[];
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

export type { PaperSectionData as P, PaperLabelInfo as a, PaperFigureData as b, PaperTheoremData as c };
