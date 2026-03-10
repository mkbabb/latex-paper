import type { ScrollToOptions } from "./types";
/**
 * Scroll-to-element with rAF retry.
 * When a treeIndex is provided, loads only up to the target section's root index + buffer
 * instead of force-loading all content.
 */
export declare function useScrollTo(options: ScrollToOptions): {
    scrollTo: (id: string) => void;
};
//# sourceMappingURL=useScrollTo.d.ts.map