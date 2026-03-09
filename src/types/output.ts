export interface PaperTheoremData {
    type:
        | "theorem"
        | "definition"
        | "lemma"
        | "proposition"
        | "corollary"
        | "aside"
        | "example";
    name?: string;
    body: string;
    math?: string[];
    label?: string;
}

export interface PaperFigureData {
    filename: string;
    caption: string;
    label?: string;
}

export interface PaperSectionData {
    id: string;
    number: string;
    title: string;
    paragraphs: string[];
    theorems?: PaperTheoremData[];
    figures?: PaperFigureData[];
    subsections?: PaperSectionData[];
    callout?: { text: string; link: string };
}

/** Maps label keys to their resolved location in the paper. */
export interface PaperLabelInfo {
    /** Display number (e.g. "2.3", "1.5") */
    number: string;
    /** Type of labeled item */
    type: "section" | "theorem" | "figure" | "equation";
    /** Section ID (slug) containing this label */
    sectionId: string;
}
