import type { Ref } from "vue";
import type { PaperSectionData } from "../../types/output";
import type { TreeNode } from "../tracking/types";
import { type PaperContext } from "../context";
/**
 * Convenience composable that wires generic tracking primitives to PaperContext.
 * Accepts PaperContext directly, or injects it from an ancestor provider.
 */
export declare function usePaperReader(options?: {
    context?: PaperContext;
    batchSize?: number;
    scrollContainer?: Ref<HTMLElement | null>;
    sidebarEl?: Ref<HTMLElement | null>;
}): {
    sections: PaperSectionData[];
    visibleCount: Ref<number, number>;
    loadSentinel: Ref<HTMLElement | null, HTMLElement | null>;
    treeIndex: Map<string, import("..").TreeIndexEntry<TreeNode>>;
    isActive: (id: string, activeId: string | null) => boolean;
    isInActiveChain: (id: string, activeId: string | null) => boolean;
    activeId: Ref<string | null, string | null>;
    activeRootId: import("vue").ComputedRef<string | null>;
    scrollTo: (id: string) => void;
    renderInline: (tex: string) => string;
    renderDisplay: (tex: string) => string;
    renderTitle: (text: string) => string;
};
//# sourceMappingURL=usePaperReader.d.ts.map