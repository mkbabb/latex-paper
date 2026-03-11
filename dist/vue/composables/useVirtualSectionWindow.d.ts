import { type MaybeRefOrGetter, type Ref } from "vue";
import type { FlatPaperSection } from "../../paper/flattenPaperSections";
export interface VirtualSectionWindowOptions<T extends FlatPaperSection = FlatPaperSection> {
    items: MaybeRefOrGetter<readonly T[]>;
    scrollContainer: Ref<HTMLElement | null>;
    overscanBeforePx?: number;
    overscanAfterPx?: number;
    warmTargetBefore?: number;
    warmTargetAfter?: number;
    leadingOffsetPx?: MaybeRefOrGetter<number>;
}
export declare function useVirtualSectionWindow<T extends FlatPaperSection>(options: VirtualSectionWindowOptions<T>): {
    visibleItems: import("vue").ComputedRef<T[]>;
    topSpacerPx: import("vue").ComputedRef<number>;
    bottomSpacerPx: import("vue").ComputedRef<number>;
    measureSection: (id: string, el: HTMLElement | null) => void;
    ensureTargetWindow: (id: string) => void;
    getOffsetFor: (id: string) => number | null;
    activeId: import("vue").ComputedRef<any>;
    activeRootId: import("vue").ComputedRef<any>;
    recalculate: () => void;
};
//# sourceMappingURL=useVirtualSectionWindow.d.ts.map