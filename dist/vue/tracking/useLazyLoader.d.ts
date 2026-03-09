import type { Ref } from "vue";
import type { LazyLoaderOptions } from "./types";
/**
 * Progressive content loading: mounts items in batches as the user scrolls.
 * Uses IntersectionObserver for normal scrolling, plus a scroll-event fallback
 * for fast scrollbar drags that skip past the sentinel.
 */
export declare function useLazyLoader(totalCount: number, options?: LazyLoaderOptions & {
    scrollContainer?: Ref<HTMLElement | null>;
}): {
    visibleCount: Ref<number, number>;
    loadSentinel: Ref<HTMLElement | null, HTMLElement | null>;
};
//# sourceMappingURL=useLazyLoader.d.ts.map