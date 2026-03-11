import type { FlatPaperSection } from "../../paper/flattenPaperSections";
export interface SectionLayoutEntry<T extends FlatPaperSection = FlatPaperSection> {
    item: T;
    height: number;
    top: number;
    bottom: number;
}
export interface SectionLayout<T extends FlatPaperSection = FlatPaperSection> {
    entries: SectionLayoutEntry<T>[];
    totalHeight: number;
}
export interface SectionWindowRange {
    startIndex: number;
    endIndex: number;
    topSpacerPx: number;
    bottomSpacerPx: number;
}
export interface ForcedSectionWindowRange {
    startIndex: number;
    endIndex: number;
}
export declare function buildSectionLayout<T extends FlatPaperSection>(items: readonly T[], getHeight: (item: T) => number): SectionLayout<T>;
export declare function resolveSectionWindow<T extends FlatPaperSection>(layout: SectionLayout<T>, scrollTopPx: number, viewportHeightPx: number, overscanBeforePx: number, overscanAfterPx: number, forcedRange?: ForcedSectionWindowRange | null): SectionWindowRange;
export declare function resolveActiveSection<T extends FlatPaperSection>(layout: SectionLayout<T>, activeOffsetPx: number): T | null;
export declare function findSectionOffset<T extends FlatPaperSection>(layout: SectionLayout<T>, id: string): number | null;
//# sourceMappingURL=virtualSectionLayout.d.ts.map