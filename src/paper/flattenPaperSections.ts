import type {
    ContentBlock,
    FigureBlock,
    MathBlockData,
    PaperSectionData,
    TheoremBlock,
} from "../types/output";

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

function stripMarkup(text: string): string {
    return text
        .replace(/<[^>]+>/g, " ")
        .replace(/&[a-z]+;/gi, " ")
        .replace(/\$[^$]*\$/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function estimateTextHeight(text: string): number {
    const clean = stripMarkup(text);
    if (!clean) return 40;
    const lines = Math.ceil(clean.length / 180);
    return 40 + lines * 26;
}

function estimateBlockHeight(block: ContentBlock): number {
    if (typeof block === "string") {
        return estimateTextHeight(block);
    }
    if ("figure" in block) {
        const figure = (block as FigureBlock).figure;
        return 300 + estimateTextHeight(figure.caption);
    }
    if ("theorem" in block) {
        const theorem = (block as TheoremBlock).theorem;
        const mathCount = theorem.math?.length ?? 0;
        return 140 + estimateTextHeight(theorem.body) + mathCount * 96;
    }
    const math = block as MathBlockData;
    return 104 + Math.min(120, Math.ceil(math.tex.length / 120) * 16);
}

export function estimatePaperSectionHeight(
    section: PaperSectionData,
    depth: number,
): number {
    const headingHeight = depth === 0 ? 124 : depth === 1 ? 88 : 72;
    const depthPadding = Math.max(0, 24 - depth * 4);
    const contentHeight = section.content.reduce(
        (sum, block) => sum + estimateBlockHeight(block),
        0,
    );
    const calloutHeight = section.callout ? 148 : 0;

    return Math.max(
        depth === 0 ? 320 : 220,
        Math.round(headingHeight + depthPadding + contentHeight + calloutHeight),
    );
}

export function flattenPaperSections(
    sections: PaperSectionData[],
): FlatPaperSection[] {
    const flat: FlatPaperSection[] = [];

    function walk(
        nodes: PaperSectionData[],
        depth: number,
        parentId: string | null,
        rootId: string,
        rootIndex: number,
    ) {
        for (const [nodeIndex, section] of nodes.entries()) {
            const nextRootId = depth === 0 ? section.id : rootId;
            const nextRootIndex = depth === 0 ? nodeIndex : rootIndex;
            flat.push({
                id: section.id,
                index: flat.length,
                depth,
                sourceLevel: section.sourceLevel ?? depth,
                starred: section.starred ?? false,
                parentId,
                rootId: nextRootId,
                rootIndex: nextRootIndex,
                section,
                estimatedHeight: estimatePaperSectionHeight(section, depth),
            });

            if (section.subsections?.length) {
                walk(
                    section.subsections,
                    depth + 1,
                    section.id,
                    nextRootId,
                    nextRootIndex,
                );
            }
        }
    }

    walk(sections, 0, null, "", 0);
    return flat;
}
