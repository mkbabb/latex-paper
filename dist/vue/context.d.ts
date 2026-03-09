import type { InjectionKey } from "vue";
import type { PaperSectionData, PaperLabelInfo } from "../types/output";
export interface PaperContext {
    sections: PaperSectionData[];
    labelMap: Record<string, PaperLabelInfo>;
    renderInline: (tex: string) => string;
    renderDisplay: (tex: string) => string;
    renderTitle: (text: string) => string;
    assetBase: string;
    scrollToId: (id: string) => void;
}
export declare const PAPER_CONTEXT: InjectionKey<PaperContext>;
/**
 * Creates a renderTitle function that replaces $...$ with KaTeX HTML.
 */
export declare function createRenderTitle(renderInline: (tex: string) => string): (text: string) => string;
//# sourceMappingURL=context.d.ts.map