import type { Ref } from "vue";
import type { TreeNode, TreeIndexEntry, ScrollTrackerOptions } from "./types";
/**
 * Tracks which tree node is currently visible via IntersectionObserver,
 * with a scroll-event fallback for fast scrollbar drags.
 * Deepest visible node wins.
 */
export declare function useScrollTracker<T extends TreeNode>(roots: T[], index: Map<string, TreeIndexEntry<T>>, visibleCount: Ref<number>, options?: ScrollTrackerOptions & {
    getChildren?: (node: T) => T[] | undefined;
    /** Scroll container for the scroll-event fallback. Falls back to document. */
    scrollContainer?: Ref<HTMLElement | null>;
    /** Sidebar element for auto-scrolling active TOC item. Uses data-toc-id attribute. */
    sidebarEl?: Ref<HTMLElement | null>;
}): {
    activeId: Ref<string | null, string | null>;
    activeRootId: import("vue").ComputedRef<string | null>;
};
//# sourceMappingURL=useScrollTracker.d.ts.map