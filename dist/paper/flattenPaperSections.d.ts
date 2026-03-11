import type { PaperSectionData } from "../types/output";
export interface FlatPaperSection {
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
export declare function estimatePaperSectionHeight(section: PaperSectionData, depth: number): number;
export declare function flattenPaperSections(sections: PaperSectionData[]): FlatPaperSection[];
//# sourceMappingURL=flattenPaperSections.d.ts.map