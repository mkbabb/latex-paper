import { nextTick } from "vue";
import type { ScrollToOptions } from "./types";

/**
 * Scroll-to-element with rAF retry, force-loading all content if needed.
 */
export function useScrollTo(options: ScrollToOptions) {
    const { scrollContainer, totalCount, visibleCount } = options;
    const scrollOffset = options.scrollOffset ?? 16;
    const maxAttempts = options.maxAttempts ?? 60;

    function scrollTo(id: string) {
        // Force-load all content so the target element exists
        visibleCount.value = totalCount;

        let attempts = 0;
        let lastY = -1;

        function tryScroll() {
            const el = document.getElementById(id);
            const scroller = scrollContainer.value;
            if (!el || !scroller) {
                if (attempts++ < maxAttempts) requestAnimationFrame(tryScroll);
                return;
            }

            const scrollerRect = scroller.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const absoluteTop =
                elRect.top - scrollerRect.top + scroller.scrollTop;

            if (Math.abs(absoluteTop - lastY) < 1 && attempts > 2) {
                scroller.scrollTo({
                    top: Math.max(0, absoluteTop - scrollOffset),
                    behavior: "smooth",
                });
                return;
            }
            lastY = absoluteTop;
            attempts++;
            requestAnimationFrame(tryScroll);
        }
        nextTick(() => requestAnimationFrame(tryScroll));
    }

    return { scrollTo };
}
