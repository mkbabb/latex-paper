// src/vue/context.ts
var PAPER_CONTEXT = /* @__PURE__ */ Symbol("paper-context");
function createRenderTitle(renderInline) {
  return (text) => text.replace(
    /\$([^$]+)\$/g,
    (_, tex) => `<span class="math-inline">${renderInline(tex)}</span>`
  );
}

// src/vue/tracking/useLazyLoader.ts
import { ref, watch, onMounted, onUnmounted, nextTick } from "vue";
function useLazyLoader(totalCount, options) {
  const batchSize = options?.batchSize ?? 2;
  const rootMargin = options?.rootMargin ?? "0px 0px 600px 0px";
  const visibleCount = ref(batchSize);
  const loadSentinel = ref(null);
  let observer = null;
  let rafId = 0;
  function loadMore() {
    if (visibleCount.value < totalCount) {
      visibleCount.value = Math.min(
        visibleCount.value + batchSize,
        totalCount
      );
    }
  }
  function onScroll() {
    if (rafId || visibleCount.value >= totalCount) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      if (!loadSentinel.value || visibleCount.value >= totalCount) return;
      const container = options?.scrollContainer?.value;
      const viewportBottom = container ? container.getBoundingClientRect().bottom : window.innerHeight;
      const sentinelRect = loadSentinel.value.getBoundingClientRect();
      if (sentinelRect.top < viewportBottom) {
        loadMore();
      }
    });
  }
  onMounted(() => {
    const container = options?.scrollContainer?.value;
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) loadMore();
        }
      },
      { root: container ?? void 0, rootMargin }
    );
    nextTick(() => {
      if (loadSentinel.value) observer.observe(loadSentinel.value);
    });
    const scrollTarget = container ?? document;
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
  });
  onUnmounted(() => {
    observer?.disconnect();
    if (rafId) cancelAnimationFrame(rafId);
    const container = options?.scrollContainer?.value;
    const scrollTarget = container ?? document;
    scrollTarget.removeEventListener("scroll", onScroll);
  });
  watch(visibleCount, () => {
    if (!observer) return;
    observer.disconnect();
    nextTick(() => {
      if (loadSentinel.value) observer.observe(loadSentinel.value);
    });
  });
  return { visibleCount, loadSentinel };
}

// src/vue/tracking/useTreeIndex.ts
function useTreeIndex(roots, options) {
  const getChildren = options?.getChildren ?? ((n) => n.children);
  const index = /* @__PURE__ */ new Map();
  function walk(list, depth, parentId, rootId, rootIndex) {
    for (const node of list) {
      const ri = depth === 0 ? roots.indexOf(node) : rootIndex;
      const rid = depth === 0 ? node.id : rootId;
      index.set(node.id, {
        node,
        depth,
        rootId: rid,
        parentId: depth === 0 ? node.id : parentId,
        rootIndex: ri
      });
      const children = getChildren(node);
      if (children) {
        walk(children, depth + 1, depth === 0 ? node.id : parentId, rid, ri);
      }
    }
  }
  walk(roots, 0, null, "", 0);
  function isActive(id, activeId) {
    return id === activeId;
  }
  function isInActiveChain(id, activeId) {
    if (!activeId) return false;
    const entry = index.get(activeId);
    if (!entry) return false;
    if (id === activeId) return true;
    if (id === entry.parentId) return true;
    const target = index.get(id);
    if (!target) return false;
    return isDescendant(activeId, id);
  }
  function isDescendant(childId, ancestorId) {
    const ancestor = index.get(ancestorId);
    if (!ancestor) return false;
    const children = getChildren(ancestor.node);
    if (!children) return false;
    for (const child of children) {
      if (child.id === childId) return true;
      if (isDescendant(childId, child.id)) return true;
    }
    return false;
  }
  return { index, isActive, isInActiveChain, isDescendant };
}

// src/vue/tracking/useScrollTracker.ts
import { ref as ref2, computed, watch as watch2, onMounted as onMounted2, onUnmounted as onUnmounted2, nextTick as nextTick2 } from "vue";
function useScrollTracker(roots, index, visibleCount, options) {
  const getChildren = options?.getChildren ?? ((n) => n.children);
  const rootMargin = options?.rootMargin ?? "-20% 0px -60% 0px";
  const threshold = options?.threshold ?? 0;
  const activeId = ref2(roots[0]?.id ?? null);
  const sectionVisibility = /* @__PURE__ */ new Map();
  let observer = null;
  const observedIds = /* @__PURE__ */ new Set();
  let locked = false;
  function lockTracking() {
    locked = true;
  }
  function unlockTracking() {
    locked = false;
  }
  const activeRootId = computed(() => {
    if (!activeId.value) return null;
    return index.get(activeId.value)?.parentId ?? null;
  });
  function findDeepestVisible(list) {
    for (const node of list) {
      const children = getChildren(node);
      if (children) {
        const deep = findDeepestVisible(children);
        if (deep) return deep;
      }
      if (sectionVisibility.get(node.id)) return node.id;
    }
    return null;
  }
  function updateActive() {
    const found = findDeepestVisible(roots);
    if (found) activeId.value = found;
  }
  let cachedIds = null;
  function collectIds(list) {
    if (cachedIds) return cachedIds;
    const out = [];
    function walk(nodes) {
      for (const node of nodes) {
        out.push(node.id);
        const children = getChildren(node);
        if (children) walk(children);
      }
    }
    walk(list);
    cachedIds = out;
    return out;
  }
  function invalidateIdCache() {
    cachedIds = null;
  }
  let rafId = 0;
  function onScroll() {
    if (locked || rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      const container = options?.scrollContainer?.value;
      const topPct = parseFloat(rootMargin.split(" ")[0]) / 100;
      const viewportH = container ? container.clientHeight : window.innerHeight;
      const activeZoneTop = Math.abs(topPct) * viewportH;
      const containerTop = container ? container.getBoundingClientRect().top : 0;
      const allIds = collectIds(roots);
      let bestId = null;
      let bestDist = Infinity;
      let closestBelowId = null;
      let closestBelowDist = Infinity;
      for (const id of allIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const dist = rect.top - containerTop - activeZoneTop;
        if (dist <= 0 && Math.abs(dist) < bestDist) {
          bestDist = Math.abs(dist);
          bestId = id;
        }
        if (dist > 0 && dist < closestBelowDist) {
          closestBelowDist = dist;
          closestBelowId = id;
        }
      }
      const resolvedId = bestId ?? closestBelowId;
      if (resolvedId && resolvedId !== activeId.value) {
        sectionVisibility.clear();
        sectionVisibility.set(resolvedId, true);
        activeId.value = resolvedId;
      }
    });
  }
  function observeTree(list) {
    for (const node of list) {
      if (!observedIds.has(node.id)) {
        const el = document.getElementById(node.id);
        if (el) {
          observer.observe(el);
          observedIds.add(node.id);
        }
      }
      const children = getChildren(node);
      if (children) observeTree(children);
    }
  }
  onMounted2(() => {
    const container = options?.scrollContainer?.value;
    observer = new IntersectionObserver(
      (entries) => {
        if (locked) return;
        for (const entry of entries) {
          sectionVisibility.set(
            entry.target.id,
            entry.isIntersecting
          );
        }
        updateActive();
      },
      { root: container ?? void 0, rootMargin, threshold }
    );
    nextTick2(() => observeTree(roots));
    const scrollTarget = container ?? document;
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
  });
  onUnmounted2(() => {
    observer?.disconnect();
    if (rafId) cancelAnimationFrame(rafId);
    const container = options?.scrollContainer?.value;
    const scrollTarget = container ?? document;
    scrollTarget.removeEventListener("scroll", onScroll);
  });
  watch2(visibleCount, () => {
    invalidateIdCache();
    if (!observer) return;
    nextTick2(() => observeTree(roots));
  });
  if (options?.sidebarEl) {
    const sidebarEl = options.sidebarEl;
    watch2(activeId, (id) => {
      if (!id || !sidebarEl.value) return;
      nextTick2(() => {
        const el = sidebarEl.value?.querySelector(
          `[data-toc-id="${id}"]`
        );
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });
    });
  }
  function forceRecalculate() {
    sectionVisibility.clear();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    const container = options?.scrollContainer?.value;
    const topPct = parseFloat(rootMargin.split(" ")[0]) / 100;
    const viewportH = container ? container.clientHeight : window.innerHeight;
    const activeZoneTop = Math.abs(topPct) * viewportH;
    const containerTop = container ? container.getBoundingClientRect().top : 0;
    const allIds = collectIds(roots);
    let bestId = null;
    let bestDist = Infinity;
    let closestBelowId = null;
    let closestBelowDist = Infinity;
    for (const id of allIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const dist = rect.top - containerTop - activeZoneTop;
      if (dist <= 0 && Math.abs(dist) < bestDist) {
        bestDist = Math.abs(dist);
        bestId = id;
      }
      if (dist > 0 && dist < closestBelowDist) {
        closestBelowDist = dist;
        closestBelowId = id;
      }
    }
    const resolvedId = bestId ?? closestBelowId;
    if (resolvedId) {
      sectionVisibility.set(resolvedId, true);
      activeId.value = resolvedId;
    }
  }
  return { activeId, activeRootId, forceRecalculate, lockTracking, unlockTracking };
}

// src/vue/tracking/useScrollTo.ts
import { nextTick as nextTick3 } from "vue";
function useScrollTo(options) {
  const { scrollContainer, totalCount, visibleCount } = options;
  const scrollOffset = options.scrollOffset ?? 16;
  const maxAttempts = options.maxAttempts ?? 60;
  const treeIndex = options.treeIndex;
  function ensureTargetLoaded(id) {
    if (treeIndex) {
      const entry = treeIndex.get(id);
      if (entry) {
        const needed = entry.rootIndex + 2;
        visibleCount.value = Math.max(
          visibleCount.value,
          Math.min(needed, totalCount)
        );
        return;
      }
    }
    visibleCount.value = totalCount;
  }
  function scrollTo(id) {
    ensureTargetLoaded(id);
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
      const absoluteTop = elRect.top - scrollerRect.top + scroller.scrollTop;
      if (Math.abs(absoluteTop - lastY) < 1 && attempts > 2) {
        scroller.scrollTo({
          top: Math.max(0, absoluteTop - scrollOffset),
          behavior: "smooth"
        });
        return;
      }
      lastY = absoluteTop;
      attempts++;
      requestAnimationFrame(tryScroll);
    }
    nextTick3(() => requestAnimationFrame(tryScroll));
  }
  return { scrollTo };
}

// src/vue/tracking/useClickDelegate.ts
import { onMounted as onMounted3, onUnmounted as onUnmounted3 } from "vue";
function useClickDelegate(options) {
  const selector = options.selector ?? "[data-scroll-target]";
  const attribute = options.attribute ?? "data-scroll-target";
  function handleClick(e) {
    const target = e.target.closest(selector);
    if (!target) return;
    e.preventDefault();
    const value = target.getAttribute(attribute);
    if (!value) return;
    const id = options.resolve(value);
    if (id) options.scrollTo(id);
  }
  onMounted3(() => {
    const el = options.container.value;
    if (el) el.addEventListener("click", handleClick);
  });
  onUnmounted3(() => {
    const el = options.container.value;
    if (el) el.removeEventListener("click", handleClick);
  });
  return { handleClick };
}

// src/vue/composables/useKatex.ts
import katex from "katex";
import "vue";
var cache = /* @__PURE__ */ new Map();
function useKatex(macros) {
  const resolvedMacros = macros ?? {};
  function renderInline(tex) {
    const key = `i:${tex}`;
    let html = cache.get(key);
    if (html === void 0) {
      html = katex.renderToString(tex, {
        throwOnError: false,
        displayMode: false,
        macros: resolvedMacros
      });
      cache.set(key, html);
    }
    return html;
  }
  function renderDisplay(tex) {
    const key = `d:${tex}`;
    let html = cache.get(key);
    if (html === void 0) {
      html = katex.renderToString(tex, {
        throwOnError: false,
        displayMode: true,
        macros: resolvedMacros
      });
      cache.set(key, html);
    }
    return html;
  }
  const renderTitle = createRenderTitle(renderInline);
  return { renderInline, renderDisplay, renderTitle };
}

// src/vue/composables/usePaperReader.ts
import { inject as inject2 } from "vue";
function paperToTree(section) {
  return {
    id: section.id,
    children: section.subsections?.map(paperToTree)
  };
}
function usePaperReader(options) {
  const ctx = options?.context ?? inject2(PAPER_CONTEXT);
  if (!ctx) {
    throw new Error(
      "usePaperReader requires PaperContext. Pass it via options.context or provide(PAPER_CONTEXT, ...)."
    );
  }
  const { sections, labelMap, renderInline, renderDisplay, renderTitle } = ctx;
  const scrollContainer = options?.scrollContainer ?? { value: null };
  const { visibleCount, loadSentinel } = useLazyLoader(sections.length, {
    batchSize: options?.batchSize,
    scrollContainer
  });
  const treeNodes = sections.map(paperToTree);
  const { index: treeIndex, isActive, isInActiveChain } = useTreeIndex(
    treeNodes
  );
  const { activeId, activeRootId, forceRecalculate, lockTracking, unlockTracking } = useScrollTracker(treeNodes, treeIndex, visibleCount, {
    sidebarEl: options?.sidebarEl,
    scrollContainer
  });
  const { scrollTo } = useScrollTo({
    scrollContainer,
    totalCount: sections.length,
    visibleCount,
    treeIndex
  });
  useClickDelegate({
    container: scrollContainer,
    selector: ".paper-ref",
    attribute: "data-ref",
    resolve: (refKey) => {
      const info = labelMap[refKey];
      if (!info) return null;
      return info.anchorId ?? info.elementId ?? info.sectionId;
    },
    scrollTo
  });
  return {
    sections,
    visibleCount,
    loadSentinel,
    treeIndex,
    isActive,
    isInActiveChain,
    activeId,
    activeRootId,
    scrollTo,
    forceRecalculate,
    lockTracking,
    unlockTracking,
    renderInline,
    renderDisplay,
    renderTitle
  };
}

// src/vue/composables/useSidebarFollow.ts
import { nextTick as nextTick4, onMounted as onMounted4, onUnmounted as onUnmounted4, watch as watch3 } from "vue";
function useSidebarFollow(options) {
  const damping = options.damping ?? 0.22;
  let followRaf = 0;
  let syncRaf = 0;
  let currentScrollSource = null;
  let currentSidebar = null;
  let targetScrollTop = null;
  let manualOverride = false;
  let programmaticScrollDepth = 0;
  function suspendForManualInteraction() {
    manualOverride = true;
    targetScrollTop = null;
    if (followRaf) {
      cancelAnimationFrame(followRaf);
      followRaf = 0;
    }
    if (syncRaf) {
      cancelAnimationFrame(syncRaf);
      syncRaf = 0;
    }
  }
  function escapeSelector(value) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(value);
    }
    return value.replace(/["\\]/g, "\\$&");
  }
  function getActiveElement() {
    const nav = options.sidebarEl.value;
    const id = options.activeId.value ?? options.activeRootId?.value ?? null;
    if (!nav || !id) return null;
    return nav.querySelector(
      `[data-toc-id="${escapeSelector(id)}"]`
    );
  }
  function resolveTarget(nav, activeEl) {
    const navHeight = nav.clientHeight;
    const elementCenter = activeEl.offsetTop + activeEl.offsetHeight / 2;
    const maxScrollTop = Math.max(0, nav.scrollHeight - navHeight);
    const deadzone = navHeight * 0.18;
    const currentCenter = nav.scrollTop + navHeight / 2;
    if (Math.abs(elementCenter - currentCenter) <= deadzone) {
      return nav.scrollTop;
    }
    return Math.max(0, Math.min(maxScrollTop, elementCenter - navHeight / 2));
  }
  function withProgrammaticScroll(fn) {
    programmaticScrollDepth += 1;
    try {
      fn();
    } finally {
      requestAnimationFrame(() => {
        programmaticScrollDepth = Math.max(0, programmaticScrollDepth - 1);
      });
    }
  }
  function follow() {
    followRaf = 0;
    if (manualOverride) return;
    const nav = options.sidebarEl.value;
    const target = targetScrollTop;
    if (!nav || target == null) return;
    const delta = target - nav.scrollTop;
    if (Math.abs(delta) < 1) {
      withProgrammaticScroll(() => {
        nav.scrollTop = target;
      });
      targetScrollTop = null;
      return;
    }
    withProgrammaticScroll(() => {
      nav.scrollTop += delta * damping;
    });
    followRaf = requestAnimationFrame(follow);
  }
  function queue(immediate = false) {
    if (!immediate && manualOverride) return;
    const nav = options.sidebarEl.value;
    const activeEl = getActiveElement();
    if (!nav || !activeEl) return;
    targetScrollTop = resolveTarget(nav, activeEl);
    if (immediate) {
      if (followRaf) {
        cancelAnimationFrame(followRaf);
        followRaf = 0;
      }
      withProgrammaticScroll(() => {
        nav.scrollTop = targetScrollTop;
      });
      targetScrollTop = null;
      return;
    }
    if (!followRaf) {
      followRaf = requestAnimationFrame(follow);
    }
  }
  function scheduleFromScroll() {
    if (manualOverride) {
      manualOverride = false;
      targetScrollTop = null;
    }
    if (syncRaf) return;
    syncRaf = requestAnimationFrame(() => {
      syncRaf = 0;
      queue();
    });
  }
  function handleSidebarWheel() {
    suspendForManualInteraction();
  }
  function handleSidebarTouch() {
    suspendForManualInteraction();
  }
  function handleSidebarPointer(event) {
    const target = event.target;
    if (target?.closest("[data-toc-id], .sidebar-top-btn")) return;
    suspendForManualInteraction();
  }
  function handleSidebarKeydown(event) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "PageUp" || event.key === "PageDown" || event.key === "Home" || event.key === "End" || event.key === " ") {
      suspendForManualInteraction();
    }
  }
  function handleSidebarScroll() {
    if (programmaticScrollDepth > 0) return;
    suspendForManualInteraction();
  }
  function bindSidebar(nav) {
    if (currentSidebar === nav) return;
    currentSidebar?.removeEventListener("wheel", handleSidebarWheel);
    currentSidebar?.removeEventListener("scroll", handleSidebarScroll);
    currentSidebar?.removeEventListener("touchstart", handleSidebarTouch);
    currentSidebar?.removeEventListener("pointerdown", handleSidebarPointer);
    currentSidebar?.removeEventListener("keydown", handleSidebarKeydown);
    currentSidebar = nav;
    currentSidebar?.addEventListener("wheel", handleSidebarWheel, { passive: true });
    currentSidebar?.addEventListener("scroll", handleSidebarScroll, { passive: true });
    currentSidebar?.addEventListener("touchstart", handleSidebarTouch, { passive: true });
    currentSidebar?.addEventListener("pointerdown", handleSidebarPointer, { passive: true });
    currentSidebar?.addEventListener("keydown", handleSidebarKeydown);
  }
  function bindScrollSource(source) {
    if (currentScrollSource === source) return;
    currentScrollSource?.removeEventListener("scroll", scheduleFromScroll);
    currentScrollSource = source;
    currentScrollSource?.addEventListener("scroll", scheduleFromScroll, {
      passive: true
    });
  }
  onMounted4(() => {
    bindScrollSource(options.scrollSource?.value ?? null);
    bindSidebar(options.sidebarEl.value ?? null);
    nextTick4(() => queue(true));
    window.addEventListener("resize", scheduleFromScroll);
  });
  watch3(
    [options.activeId, options.activeRootId ?? { value: null }],
    () => {
      nextTick4(() => queue());
    },
    { flush: "post" }
  );
  watch3(
    options.sidebarEl,
    (sidebar) => {
      bindSidebar(sidebar);
    },
    { immediate: true }
  );
  watch3(
    () => options.scrollSource?.value ?? null,
    (source) => {
      bindScrollSource(source);
    },
    { immediate: true }
  );
  onUnmounted4(() => {
    if (followRaf) cancelAnimationFrame(followRaf);
    if (syncRaf) cancelAnimationFrame(syncRaf);
    currentScrollSource?.removeEventListener("scroll", scheduleFromScroll);
    currentSidebar?.removeEventListener("wheel", handleSidebarWheel);
    currentSidebar?.removeEventListener("scroll", handleSidebarScroll);
    currentSidebar?.removeEventListener("touchstart", handleSidebarTouch);
    currentSidebar?.removeEventListener("pointerdown", handleSidebarPointer);
    currentSidebar?.removeEventListener("keydown", handleSidebarKeydown);
    window.removeEventListener("resize", scheduleFromScroll);
  });
  return { queueSidebarFollow: queue };
}

// src/vue/composables/useVirtualSectionWindow.ts
import {
  computed as computed2,
  onUnmounted as onUnmounted5,
  ref as ref3,
  shallowRef,
  toValue,
  watch as watch4
} from "vue";

// src/vue/composables/virtualSectionLayout.ts
function buildSectionLayout(items, getHeight) {
  let offset = 0;
  const entries = items.map((item) => {
    const height = Math.max(1, Math.round(getHeight(item)));
    const top = offset;
    offset += height;
    return {
      item,
      height,
      top,
      bottom: offset
    };
  });
  return {
    entries,
    totalHeight: offset
  };
}
function findStartIndex(entries, startOffset) {
  if (entries.length === 0) return 0;
  let low = 0;
  let high = entries.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (entries[mid].bottom <= startOffset) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}
function findEndIndex(entries, endOffset) {
  if (entries.length === 0) return 0;
  let low = 0;
  let high = entries.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (entries[mid].top < endOffset) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}
function resolveSectionWindow(layout, scrollTopPx, viewportHeightPx, overscanBeforePx, overscanAfterPx, forcedRange) {
  if (layout.entries.length === 0) {
    return {
      startIndex: 0,
      endIndex: -1,
      topSpacerPx: 0,
      bottomSpacerPx: 0
    };
  }
  const startOffset = Math.max(0, scrollTopPx - overscanBeforePx);
  const endOffset = Math.max(
    0,
    scrollTopPx + viewportHeightPx + overscanAfterPx
  );
  let startIndex = findStartIndex(layout.entries, startOffset);
  let endIndex = findEndIndex(layout.entries, endOffset);
  if (forcedRange) {
    startIndex = Math.min(startIndex, forcedRange.startIndex);
    endIndex = Math.max(endIndex, forcedRange.endIndex);
  }
  startIndex = Math.max(0, Math.min(startIndex, layout.entries.length - 1));
  endIndex = Math.max(startIndex, Math.min(endIndex, layout.entries.length - 1));
  return {
    startIndex,
    endIndex,
    topSpacerPx: layout.entries[startIndex]?.top ?? 0,
    bottomSpacerPx: Math.max(
      0,
      layout.totalHeight - (layout.entries[endIndex]?.bottom ?? 0)
    )
  };
}
function resolveActiveSection(layout, activeOffsetPx) {
  if (layout.entries.length === 0) return null;
  let low = 0;
  let high = layout.entries.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (layout.entries[mid].top <= activeOffsetPx) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return layout.entries[low]?.item ?? null;
}
function findSectionOffset(layout, id) {
  for (const entry of layout.entries) {
    if (entry.item.id === id) {
      return entry.top;
    }
  }
  return null;
}

// src/vue/composables/useVirtualSectionWindow.ts
var SESSION_HEIGHT_CACHE = /* @__PURE__ */ new Map();
function useVirtualSectionWindow(options) {
  const items = computed2(() => Array.from(toValue(options.items)));
  const measuredHeights = /* @__PURE__ */ new Map();
  const itemIndex = /* @__PURE__ */ new Map();
  const layout = shallowRef({
    entries: [],
    totalHeight: 0
  });
  const range = ref3({
    startIndex: 0,
    endIndex: -1,
    topSpacerPx: 0,
    bottomSpacerPx: 0
  });
  const activeItem = ref3(null);
  const warmRange = ref3(null);
  const elementMap = /* @__PURE__ */ new Map();
  let scrollRaf = 0;
  let recalcRaf = 0;
  let warmTimer = 0;
  let containerResizeObserver = null;
  function getViewportHeight() {
    return Math.max(
      1,
      options.scrollContainer.value?.clientHeight ?? window.innerHeight ?? 900
    );
  }
  function getLeadingOffset() {
    return Math.max(0, toValue(options.leadingOffsetPx) ?? 0);
  }
  function getHeight(item) {
    return measuredHeights.get(item.id) ?? SESSION_HEIGHT_CACHE.get(item.id) ?? item.estimatedHeight;
  }
  function rebuildLayout() {
    layout.value = buildSectionLayout(items.value, getHeight);
  }
  function computeWindowState() {
    const container = options.scrollContainer.value;
    const viewportHeight = getViewportHeight();
    const overscanBeforePx = options.overscanBeforePx ?? viewportHeight;
    const overscanAfterPx = options.overscanAfterPx ?? viewportHeight * 2;
    const normalizedScrollTop = Math.max(
      0,
      (container?.scrollTop ?? 0) - getLeadingOffset()
    );
    range.value = resolveSectionWindow(
      layout.value,
      normalizedScrollTop,
      viewportHeight,
      overscanBeforePx,
      overscanAfterPx,
      warmRange.value
    );
    activeItem.value = resolveActiveSection(
      layout.value,
      normalizedScrollTop + viewportHeight * 0.2
    );
  }
  function recalculate() {
    rebuildLayout();
    computeWindowState();
  }
  function scheduleRecalculate() {
    if (recalcRaf) return;
    recalcRaf = requestAnimationFrame(() => {
      recalcRaf = 0;
      recalculate();
    });
  }
  function scheduleWarmRangeRelease() {
    if (warmTimer) window.clearTimeout(warmTimer);
    warmTimer = window.setTimeout(() => {
      warmRange.value = null;
      scheduleRecalculate();
    }, 320);
  }
  function syncMeasuredHeight(id, height) {
    const normalized = Math.max(1, Math.round(height));
    if (measuredHeights.get(id) === normalized) return;
    measuredHeights.set(id, normalized);
    SESSION_HEIGHT_CACHE.set(id, normalized);
    scheduleWarmRangeRelease();
    scheduleRecalculate();
  }
  function disconnectSection(id) {
    elementMap.delete(id);
  }
  function measureSection(id, el) {
    if (!el) {
      disconnectSection(id);
      return;
    }
    const current = elementMap.get(id);
    if (current === el) {
      syncMeasuredHeight(id, el.offsetHeight);
      return;
    }
    disconnectSection(id);
    elementMap.set(id, el);
    requestAnimationFrame(() => {
      const target = elementMap.get(id);
      if (target) syncMeasuredHeight(id, target.offsetHeight);
    });
  }
  function ensureTargetWindow(id) {
    const index = itemIndex.get(id);
    if (index == null) return;
    const warmBefore = options.warmTargetBefore ?? 2;
    const warmAfter = options.warmTargetAfter ?? 3;
    warmRange.value = {
      startIndex: Math.max(0, index - warmBefore),
      endIndex: Math.min(items.value.length - 1, index + warmAfter)
    };
    scheduleWarmRangeRelease();
    recalculate();
  }
  function getOffsetFor(id) {
    return findSectionOffset(layout.value, id);
  }
  function attachContainerObserver(container) {
    containerResizeObserver?.disconnect();
    containerResizeObserver = null;
    if (!container || typeof ResizeObserver === "undefined") return;
    containerResizeObserver = new ResizeObserver(() => {
      scheduleRecalculate();
    });
    containerResizeObserver.observe(container);
  }
  function handleScroll() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      computeWindowState();
    });
  }
  let currentContainer = null;
  function bindContainer(container) {
    if (currentContainer === container) return;
    currentContainer?.removeEventListener("scroll", handleScroll);
    currentContainer = container;
    currentContainer?.addEventListener("scroll", handleScroll, { passive: true });
    attachContainerObserver(container);
    scheduleRecalculate();
  }
  watch4(
    items,
    (nextItems) => {
      itemIndex.clear();
      for (const item of nextItems) {
        itemIndex.set(item.id, item.index);
        const cached = SESSION_HEIGHT_CACHE.get(item.id);
        if (cached != null) measuredHeights.set(item.id, cached);
      }
      for (const id of [...measuredHeights.keys()]) {
        if (!itemIndex.has(id)) measuredHeights.delete(id);
      }
      recalculate();
    },
    { immediate: true }
  );
  watch4(
    options.scrollContainer,
    (container) => bindContainer(container),
    { immediate: true }
  );
  watch4(
    () => toValue(options.leadingOffsetPx),
    () => scheduleRecalculate()
  );
  onUnmounted5(() => {
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
    if (recalcRaf) cancelAnimationFrame(recalcRaf);
    if (warmTimer) window.clearTimeout(warmTimer);
    currentContainer?.removeEventListener("scroll", handleScroll);
    containerResizeObserver?.disconnect();
    elementMap.clear();
  });
  const visibleItems = computed2(() => {
    if (range.value.endIndex < range.value.startIndex) return [];
    return items.value.slice(range.value.startIndex, range.value.endIndex + 1);
  });
  const activeId = computed2(() => activeItem.value?.id ?? null);
  const activeRootId = computed2(() => activeItem.value?.rootId ?? null);
  return {
    visibleItems,
    topSpacerPx: computed2(() => range.value.topSpacerPx),
    bottomSpacerPx: computed2(() => range.value.bottomSpacerPx),
    measureSection,
    ensureTargetWindow,
    getOffsetFor,
    activeId,
    activeRootId,
    recalculate
  };
}

// src/paper/flattenPaperSections.ts
function stripMarkup(text) {
  return text.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\$[^$]*\$/g, " ").replace(/\s+/g, " ").trim();
}
function estimateTextHeight(text) {
  const clean = stripMarkup(text);
  if (!clean) return 40;
  const lines = Math.ceil(clean.length / 180);
  return 40 + lines * 26;
}
function estimateBlockHeight(block) {
  if (typeof block === "string") {
    return estimateTextHeight(block);
  }
  if ("figure" in block) {
    const figure = block.figure;
    return 300 + estimateTextHeight(figure.caption);
  }
  if ("theorem" in block) {
    const theorem = block.theorem;
    return 140 + estimateNestedContentHeight(theorem.content);
  }
  if ("code" in block) {
    const codeBlock = block.code;
    const lines = codeBlock.code.split("\n").length;
    return 96 + lines * 22 + (codeBlock.caption ? estimateTextHeight(codeBlock.caption) : 0);
  }
  if ("proof" in block) {
    const proof = block.proof;
    return 120 + estimateNestedContentHeight(proof.content);
  }
  const math = block;
  return 104 + Math.min(120, Math.ceil(math.tex.length / 120) * 16);
}
function estimateNestedContentHeight(blocks) {
  return blocks.reduce((sum, block) => {
    if (typeof block === "string") return sum + estimateTextHeight(block);
    return sum + estimateBlockHeight(block);
  }, 0);
}
function estimatePaperSectionHeight(section, depth) {
  const headingHeight = depth === 0 ? 124 : depth === 1 ? 88 : 72;
  const depthPadding = Math.max(0, 24 - depth * 4);
  const contentHeight = section.content.reduce(
    (sum, block) => sum + estimateBlockHeight(block),
    0
  );
  const calloutHeight = section.callout ? 148 : 0;
  return Math.max(
    depth === 0 ? 320 : 220,
    Math.round(headingHeight + depthPadding + contentHeight + calloutHeight)
  );
}
function flattenPaperSections(sections) {
  const flat = [];
  function walk(nodes, depth, parentId, rootId, rootIndex) {
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
        estimatedHeight: estimatePaperSectionHeight(section, depth)
      });
      if (section.subsections?.length) {
        walk(
          section.subsections,
          depth + 1,
          section.id,
          nextRootId,
          nextRootIndex
        );
      }
    }
  }
  walk(sections, 0, null, "", 0);
  return flat;
}

// sfc-script:/Users/mkbabb/Programming/latex-paper/src/vue/components/MathBlock.vue?type=script
import { defineComponent as _defineComponent } from "vue";
import { inject as inject3 } from "vue";
var MathBlock_default = /* @__PURE__ */ _defineComponent({
  __name: "MathBlock",
  props: {
    tex: { type: String, required: true },
    id: { type: String, required: false },
    number: { type: String, required: false },
    numbered: { type: Boolean, required: false }
  },
  setup(__props, { expose: __expose }) {
    __expose();
    const props = __props;
    const ctx = inject3(PAPER_CONTEXT);
    const html = ctx.renderDisplay(props.tex);
    const __returned__ = { props, ctx, html };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});

// sfc-template:/Users/mkbabb/Programming/latex-paper/src/vue/components/MathBlock.vue?type=template
import { setBlockTracking as _setBlockTracking, createElementVNode as _createElementVNode, toDisplayString as _toDisplayString, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode } from "vue";
var _hoisted_1 = ["id"];
var _hoisted_2 = {
  key: 0,
  class: "math-block__number fira-code"
};
function render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("div", {
    class: "math-block",
    id: $props.id
  }, [
    _cache[0] || (_setBlockTracking(-1, true), (_cache[0] = _createElementVNode("div", {
      class: "math-block__equation",
      innerHTML: $setup.html
    }, null, 8, ["innerHTML"])).cacheIndex = 0, _setBlockTracking(1), _cache[0]),
    $props.numbered && $props.number ? (_openBlock(), _createElementBlock(
      "div",
      _hoisted_2,
      " (" + _toDisplayString($props.number) + ") ",
      1
      /* TEXT */
    )) : _createCommentVNode("v-if", true)
  ], 8, _hoisted_1);
}

// src/vue/components/MathBlock.vue
MathBlock_default.render = render;
MathBlock_default.__file = "src/vue/components/MathBlock.vue";
var MathBlock_default2 = MathBlock_default;

// sfc-script:/Users/mkbabb/Programming/latex-paper/src/vue/components/MathInline.vue?type=script
import { defineComponent as _defineComponent2 } from "vue";
import { inject as inject4 } from "vue";
var MathInline_default = /* @__PURE__ */ _defineComponent2({
  __name: "MathInline",
  props: {
    tex: { type: String, required: true }
  },
  setup(__props, { expose: __expose }) {
    __expose();
    const props = __props;
    const ctx = inject4(PAPER_CONTEXT);
    const html = ctx.renderInline(props.tex);
    const __returned__ = { props, ctx, html };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});

// sfc-template:/Users/mkbabb/Programming/latex-paper/src/vue/components/MathInline.vue?type=template
import { setBlockTracking as _setBlockTracking2, createElementVNode as _createElementVNode2 } from "vue";
function render2(_ctx, _cache, $props, $setup, $data, $options) {
  return _cache[0] || (_setBlockTracking2(-1, true), (_cache[0] = _createElementVNode2("span", {
    class: "math-inline",
    innerHTML: $setup.html
  }, null, 8, ["innerHTML"])).cacheIndex = 0, _setBlockTracking2(1), _cache[0]);
}

// src/vue/components/MathInline.vue
MathInline_default.render = render2;
MathInline_default.__file = "src/vue/components/MathInline.vue";
var MathInline_default2 = MathInline_default;

// sfc-script:/Users/mkbabb/Programming/latex-paper/src/vue/components/Theorem.vue?type=script
import { defineComponent as _defineComponent3 } from "vue";
import { inject as inject5 } from "vue";
var Theorem_default = /* @__PURE__ */ _defineComponent3({
  __name: "Theorem",
  props: {
    type: { type: String, required: true },
    name: { type: String, required: false },
    number: { type: String, required: false },
    label: { type: String, required: false }
  },
  setup(__props, { expose: __expose }) {
    __expose();
    const ctx = inject5(PAPER_CONTEXT);
    const labels = {
      theorem: "Theorem",
      definition: "Definition",
      lemma: "Lemma",
      proposition: "Proposition",
      corollary: "Corollary",
      aside: "Aside",
      example: "Example"
    };
    const __returned__ = { ctx, labels };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});

// sfc-template:/Users/mkbabb/Programming/latex-paper/src/vue/components/Theorem.vue?type=template
import { toDisplayString as _toDisplayString2, createElementVNode as _createElementVNode3, openBlock as _openBlock2, createElementBlock as _createElementBlock2, createCommentVNode as _createCommentVNode2, createTextVNode as _createTextVNode, Fragment as _Fragment, renderSlot as _renderSlot, normalizeClass as _normalizeClass } from "vue";
var _hoisted_12 = ["id"];
var _hoisted_22 = { class: "theorem-label" };
var _hoisted_3 = { class: "theorem-type" };
var _hoisted_4 = {
  key: 0,
  class: "theorem-number"
};
var _hoisted_5 = ["innerHTML"];
function render3(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock2(), _createElementBlock2("div", {
    id: $props.label ? $props.label.replace(/:/g, "-") : void 0,
    class: _normalizeClass(["theorem-block", `theorem-block--${$props.type}`])
  }, [
    _createElementVNode3("p", _hoisted_22, [
      _createElementVNode3(
        "span",
        _hoisted_3,
        _toDisplayString2($setup.labels[$props.type]),
        1
        /* TEXT */
      ),
      $props.number ? (_openBlock2(), _createElementBlock2(
        "span",
        _hoisted_4,
        "\xA0" + _toDisplayString2($props.number),
        1
        /* TEXT */
      )) : _createCommentVNode2("v-if", true),
      $props.name ? (_openBlock2(), _createElementBlock2(
        _Fragment,
        { key: 1 },
        [
          _cache[0] || (_cache[0] = _createTextVNode(
            " \u2014 ",
            -1
            /* CACHED */
          )),
          _createElementVNode3("em", {
            class: "theorem-name",
            innerHTML: $setup.ctx.renderTitle($props.name)
          }, null, 8, _hoisted_5)
        ],
        64
        /* STABLE_FRAGMENT */
      )) : _createCommentVNode2("v-if", true)
    ]),
    _createElementVNode3(
      "div",
      {
        class: _normalizeClass(["theorem-body", {
          "theorem-body--italic": $props.type === "theorem" || $props.type === "lemma" || $props.type === "proposition" || $props.type === "corollary"
        }])
      },
      [
        _renderSlot(_ctx.$slots, "default")
      ],
      2
      /* CLASS */
    )
  ], 10, _hoisted_12);
}

// src/vue/components/Theorem.vue
Theorem_default.render = render3;
Theorem_default.__file = "src/vue/components/Theorem.vue";
var Theorem_default2 = Theorem_default;

// sfc-script:/Users/mkbabb/Programming/latex-paper/src/vue/components/CodeBlock.vue?type=script
import { defineComponent as _defineComponent4 } from "vue";
import { computed as computed3 } from "vue";

// src/vue/composables/useCodeHighlight.ts
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import cpp from "highlight.js/lib/languages/cpp";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import typescript from "highlight.js/lib/languages/typescript";
var initialized = false;
function ensureLanguages() {
  if (initialized) return;
  initialized = true;
  hljs.registerLanguage("bash", bash);
  hljs.registerLanguage("cpp", cpp);
  hljs.registerLanguage("javascript", javascript);
  hljs.registerLanguage("js", javascript);
  hljs.registerLanguage("json", json);
  hljs.registerLanguage("plaintext", plaintext);
  hljs.registerLanguage("python", python);
  hljs.registerLanguage("py", python);
  hljs.registerLanguage("rust", rust);
  hljs.registerLanguage("rs", rust);
  hljs.registerLanguage("typescript", typescript);
  hljs.registerLanguage("ts", typescript);
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function useCodeHighlight() {
  ensureLanguages();
  function highlight(code, language) {
    try {
      if (language && hljs.getLanguage(language)) {
        return {
          html: hljs.highlight(code, { language }).value,
          language
        };
      }
      const auto = hljs.highlightAuto(code);
      return {
        html: auto.value,
        language: auto.language
      };
    } catch {
      return {
        html: escapeHtml(code),
        language
      };
    }
  }
  return { highlight };
}

// sfc-script:/Users/mkbabb/Programming/latex-paper/src/vue/components/CodeBlock.vue?type=script
import { inject as inject6 } from "vue";
var CodeBlock_default = /* @__PURE__ */ _defineComponent4({
  __name: "CodeBlock",
  props: {
    code: { type: String, required: true },
    caption: { type: String, required: false },
    language: { type: String, required: false }
  },
  setup(__props, { expose: __expose }) {
    __expose();
    const props = __props;
    const ctx = inject6(PAPER_CONTEXT);
    const { highlight } = useCodeHighlight();
    const highlighted = computed3(() => highlight(props.code, props.language));
    const __returned__ = { props, ctx, highlight, highlighted };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});

// sfc-template:/Users/mkbabb/Programming/latex-paper/src/vue/components/CodeBlock.vue?type=template
import { openBlock as _openBlock3, createElementBlock as _createElementBlock3, createCommentVNode as _createCommentVNode3, createElementVNode as _createElementVNode4 } from "vue";
var _hoisted_13 = { class: "paper-code-block" };
var _hoisted_23 = ["innerHTML"];
var _hoisted_32 = ["data-language"];
var _hoisted_42 = ["innerHTML"];
function render4(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock3(), _createElementBlock3("figure", _hoisted_13, [
    $props.caption ? (_openBlock3(), _createElementBlock3("figcaption", {
      key: 0,
      class: "paper-code-caption",
      innerHTML: $setup.ctx.renderTitle($props.caption)
    }, null, 8, _hoisted_23)) : _createCommentVNode3("v-if", true),
    _createElementVNode4("pre", {
      class: "paper-code-pre hljs",
      "data-language": $setup.highlighted.language || $props.language || void 0
    }, [
      _createElementVNode4("code", {
        innerHTML: $setup.highlighted.html
      }, null, 8, _hoisted_42)
    ], 8, _hoisted_32)
  ]);
}

// src/vue/components/CodeBlock.vue
CodeBlock_default.render = render4;
CodeBlock_default.__file = "src/vue/components/CodeBlock.vue";
var CodeBlock_default2 = CodeBlock_default;

// sfc-script:/Users/mkbabb/Programming/latex-paper/src/vue/components/PaperSection.vue?type=script
import { defineComponent as _defineComponent5 } from "vue";
import { inject as inject7 } from "vue";
var PaperSection_default = /* @__PURE__ */ _defineComponent5({
  __name: "PaperSection",
  props: {
    id: { type: String, required: true },
    number: { type: String, required: true },
    title: { type: String, required: true },
    depth: { type: Number, required: false },
    sectionIndex: { type: Number, required: false }
  },
  setup(__props, { expose: __expose }) {
    __expose();
    const ctx = inject7(PAPER_CONTEXT);
    const __returned__ = { ctx };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});

// sfc-template:/Users/mkbabb/Programming/latex-paper/src/vue/components/PaperSection.vue?type=template
import { toDisplayString as _toDisplayString3, openBlock as _openBlock4, createElementBlock as _createElementBlock4, createCommentVNode as _createCommentVNode4, createElementVNode as _createElementVNode5, resolveDynamicComponent as _resolveDynamicComponent, withCtx as _withCtx, createBlock as _createBlock, normalizeClass as _normalizeClass2, renderSlot as _renderSlot2, normalizeStyle as _normalizeStyle } from "vue";
var _hoisted_14 = ["id"];
var _hoisted_24 = {
  key: 0,
  class: "section-number"
};
var _hoisted_33 = ["innerHTML"];
var _hoisted_43 = {
  key: 0,
  class: "section-divider"
};
var _hoisted_52 = { class: "section-body" };
function render5(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock4(), _createElementBlock4("section", {
    id: $props.id,
    class: "paper-section",
    style: _normalizeStyle($props.sectionIndex != null ? { "--_section-color": `var(--section-color-${$props.sectionIndex})` } : void 0)
  }, [
    _createElementVNode5(
      "div",
      {
        class: _normalizeClass2(["section-header", {
          "section-header--chapter": ($props.depth ?? 0) === 0,
          "section-header--sub": ($props.depth ?? 0) > 0
        }])
      },
      [
        (_openBlock4(), _createBlock(_resolveDynamicComponent(($props.depth ?? 0) > 0 ? "h3" : "h2"), { class: "section-heading" }, {
          default: _withCtx(() => [
            $props.number ? (_openBlock4(), _createElementBlock4(
              "span",
              _hoisted_24,
              _toDisplayString3($props.number) + ".",
              1
              /* TEXT */
            )) : _createCommentVNode4("v-if", true),
            _createElementVNode5("span", {
              class: "section-title",
              innerHTML: $setup.ctx.renderTitle($props.title)
            }, null, 8, _hoisted_33)
          ]),
          _: 1
          /* STABLE */
        })),
        ($props.depth ?? 0) === 0 ? (_openBlock4(), _createElementBlock4("div", _hoisted_43)) : _createCommentVNode4("v-if", true)
      ],
      2
      /* CLASS */
    ),
    _createElementVNode5("div", _hoisted_52, [
      _renderSlot2(_ctx.$slots, "default")
    ])
  ], 12, _hoisted_14);
}

// src/vue/components/PaperSection.vue
PaperSection_default.render = render5;
PaperSection_default.__file = "src/vue/components/PaperSection.vue";
var PaperSection_default2 = PaperSection_default;

// sfc-script:/Users/mkbabb/Programming/latex-paper/src/vue/components/PaperSectionBlocks.vue?type=script
import { defineComponent as _defineComponent6 } from "vue";
import { inject as inject8, provide, useSlots, reactive } from "vue";

// src/vue/components/paperSectionSlots.ts
var CONTENT_SLOTS = /* @__PURE__ */ Symbol("content-slots");

// sfc-script:/Users/mkbabb/Programming/latex-paper/src/vue/components/PaperSectionBlocks.vue?type=script
var PaperSectionBlocks_default = /* @__PURE__ */ _defineComponent6({
  __name: "PaperSectionBlocks",
  props: {
    section: { type: Object, required: true }
  },
  setup(__props, { expose: __expose }) {
    __expose();
    const props = __props;
    const ownSlots = useSlots();
    const parentSlots = inject8(CONTENT_SLOTS, null);
    const effectiveSlots = parentSlots ?? ownSlots;
    provide(CONTENT_SLOTS, effectiveSlots);
    const ctx = inject8(PAPER_CONTEXT);
    const failedImages = reactive(/* @__PURE__ */ new Set());
    function onImageError(filename) {
      failedImages.add(filename);
    }
    function renderParagraph(text) {
      return ctx.renderTitle(text);
    }
    function isBlockHtml(text) {
      return /^<(ol|ul|dl|blockquote|div)\b/.test(text.trim());
    }
    function renderNestedText(text) {
      return ctx.renderTitle(text);
    }
    function nestedBlockKey(prefix, index, block) {
      if (typeof block === "string") return `${prefix}-text-${index}`;
      if ("figure" in block) return `${prefix}-figure-${block.figure.label ?? index}`;
      if ("code" in block) return `${prefix}-code-${index}`;
      const math = block;
      return `${prefix}-math-${math.anchorId ?? math.id ?? index}`;
    }
    function figureId(label) {
      return label ? label.replace(/:/g, "-") : void 0;
    }
    const __returned__ = { props, ownSlots, parentSlots, effectiveSlots, ctx, failedImages, onImageError, renderParagraph, isBlockHtml, renderNestedText, nestedBlockKey, figureId, CodeBlock: CodeBlock_default2, MathBlock: MathBlock_default2, Theorem: Theorem_default2 };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});

// sfc-template:/Users/mkbabb/Programming/latex-paper/src/vue/components/PaperSectionBlocks.vue?type=template
import { renderList as _renderList, Fragment as _Fragment2, openBlock as _openBlock5, createElementBlock as _createElementBlock5, createCommentVNode as _createCommentVNode5, resolveDynamicComponent as _resolveDynamicComponent2, createBlock as _createBlock2, toDisplayString as _toDisplayString4, withCtx as _withCtx2, createElementVNode as _createElementVNode6, createTextVNode as _createTextVNode2 } from "vue";
var _hoisted_15 = ["innerHTML"];
var _hoisted_25 = ["innerHTML"];
var _hoisted_34 = ["innerHTML"];
var _hoisted_44 = ["innerHTML"];
var _hoisted_53 = ["id"];
var _hoisted_6 = {
  key: 1,
  class: "paper-figure-placeholder"
};
var _hoisted_7 = ["src", "alt", "onError"];
var _hoisted_8 = { key: 3 };
var _hoisted_9 = { key: 0 };
var _hoisted_10 = ["innerHTML"];
var _hoisted_11 = ["id"];
var _hoisted_122 = {
  key: 1,
  class: "paper-figure-placeholder"
};
var _hoisted_132 = ["src", "alt", "onError"];
var _hoisted_142 = { key: 3 };
var _hoisted_152 = { key: 0 };
var _hoisted_16 = ["innerHTML"];
var _hoisted_17 = {
  key: 4,
  class: "paper-proof-block"
};
var _hoisted_18 = { class: "paper-proof-label" };
var _hoisted_19 = ["innerHTML"];
var _hoisted_20 = { class: "paper-proof-body" };
var _hoisted_21 = ["innerHTML"];
var _hoisted_222 = ["innerHTML"];
var _hoisted_232 = ["id"];
var _hoisted_242 = ["src", "alt"];
var _hoisted_252 = { key: 2 };
var _hoisted_26 = { key: 0 };
var _hoisted_27 = ["innerHTML"];
var _hoisted_28 = {
  key: 1,
  class: "paper-callout"
};
var _hoisted_29 = ["href"];
function render6(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock5(), _createElementBlock5(
    _Fragment2,
    null,
    [
      (_openBlock5(true), _createElementBlock5(
        _Fragment2,
        null,
        _renderList($props.section.content, (block, bi) => {
          return _openBlock5(), _createElementBlock5(
            _Fragment2,
            { key: bi },
            [
              typeof block === "string" ? (_openBlock5(), _createElementBlock5(
                _Fragment2,
                { key: 0 },
                [
                  $setup.isBlockHtml(block) ? (_openBlock5(), _createElementBlock5("div", {
                    key: 0,
                    innerHTML: $setup.renderParagraph(block)
                  }, null, 8, _hoisted_15)) : (_openBlock5(), _createElementBlock5("p", {
                    key: 1,
                    innerHTML: $setup.renderParagraph(block)
                  }, null, 8, _hoisted_25))
                ],
                64
                /* STABLE_FRAGMENT */
              )) : "theorem" in block ? (_openBlock5(), _createBlock2($setup["Theorem"], {
                key: 1,
                type: block.theorem.type,
                name: block.theorem.name,
                number: block.theorem.number,
                label: block.theorem.label
              }, {
                default: _withCtx2(() => [
                  (_openBlock5(true), _createElementBlock5(
                    _Fragment2,
                    null,
                    _renderList(block.theorem.content, (nested, ni) => {
                      return _openBlock5(), _createElementBlock5(
                        _Fragment2,
                        {
                          key: $setup.nestedBlockKey(`theorem-${bi}`, ni, nested)
                        },
                        [
                          typeof nested === "string" && $setup.isBlockHtml(nested) ? (_openBlock5(), _createElementBlock5("div", {
                            key: 0,
                            innerHTML: $setup.renderNestedText(nested)
                          }, null, 8, _hoisted_34)) : typeof nested === "string" ? (_openBlock5(), _createElementBlock5("p", {
                            key: 1,
                            innerHTML: $setup.renderNestedText(nested)
                          }, null, 8, _hoisted_44)) : "figure" in nested ? (_openBlock5(), _createElementBlock5("figure", {
                            key: 2,
                            id: $setup.figureId(nested.figure.label)
                          }, [
                            $setup.effectiveSlots.figure ? (_openBlock5(), _createBlock2(_resolveDynamicComponent2(() => $setup.effectiveSlots.figure({ figure: nested.figure, index: ni })), { key: 0 })) : $setup.failedImages.has(nested.figure.filename) ? (_openBlock5(), _createElementBlock5("div", _hoisted_6)) : (_openBlock5(), _createElementBlock5("img", {
                              key: 2,
                              src: `${$setup.ctx.assetBase}${nested.figure.filename}`,
                              alt: nested.figure.caption,
                              loading: "lazy",
                              onError: ($event) => $setup.onImageError(nested.figure.filename)
                            }, null, 40, _hoisted_7)),
                            nested.figure.caption || nested.figure.number ? (_openBlock5(), _createElementBlock5("figcaption", _hoisted_8, [
                              nested.figure.number ? (_openBlock5(), _createElementBlock5(
                                "strong",
                                _hoisted_9,
                                "Figure " + _toDisplayString4(nested.figure.number) + ": ",
                                1
                                /* TEXT */
                              )) : _createCommentVNode5("v-if", true),
                              nested.figure.caption ? (_openBlock5(), _createElementBlock5("span", {
                                key: 1,
                                innerHTML: $setup.renderNestedText(nested.figure.caption)
                              }, null, 8, _hoisted_10)) : _createCommentVNode5("v-if", true)
                            ])) : _createCommentVNode5("v-if", true)
                          ], 8, _hoisted_53)) : "code" in nested ? (_openBlock5(), _createBlock2($setup["CodeBlock"], {
                            key: 3,
                            code: nested.code.code,
                            caption: nested.code.caption,
                            language: nested.code.language
                          }, null, 8, ["code", "caption", "language"])) : (_openBlock5(), _createBlock2($setup["MathBlock"], {
                            key: 4,
                            tex: nested.tex,
                            id: nested.anchorId || nested.id,
                            number: nested.number,
                            numbered: nested.numbered
                          }, null, 8, ["tex", "id", "number", "numbered"]))
                        ],
                        64
                        /* STABLE_FRAGMENT */
                      );
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ]),
                _: 2
                /* DYNAMIC */
              }, 1032, ["type", "name", "number", "label"])) : "figure" in block ? (_openBlock5(), _createElementBlock5("figure", {
                key: 2,
                id: $setup.figureId(block.figure.label)
              }, [
                $setup.effectiveSlots.figure ? (_openBlock5(), _createBlock2(_resolveDynamicComponent2(() => $setup.effectiveSlots.figure({ figure: block.figure, index: bi })), { key: 0 })) : $setup.failedImages.has(block.figure.filename) ? (_openBlock5(), _createElementBlock5("div", _hoisted_122)) : (_openBlock5(), _createElementBlock5("img", {
                  key: 2,
                  src: `${$setup.ctx.assetBase}${block.figure.filename}`,
                  alt: block.figure.caption,
                  loading: "lazy",
                  onError: ($event) => $setup.onImageError(block.figure.filename)
                }, null, 40, _hoisted_132)),
                block.figure.caption || block.figure.number ? (_openBlock5(), _createElementBlock5("figcaption", _hoisted_142, [
                  block.figure.number ? (_openBlock5(), _createElementBlock5(
                    "strong",
                    _hoisted_152,
                    "Figure " + _toDisplayString4(block.figure.number) + ": ",
                    1
                    /* TEXT */
                  )) : _createCommentVNode5("v-if", true),
                  block.figure.caption ? (_openBlock5(), _createElementBlock5("span", {
                    key: 1,
                    innerHTML: $setup.renderParagraph(block.figure.caption)
                  }, null, 8, _hoisted_16)) : _createCommentVNode5("v-if", true)
                ])) : _createCommentVNode5("v-if", true)
              ], 8, _hoisted_11)) : "code" in block ? (_openBlock5(), _createBlock2($setup["CodeBlock"], {
                key: 3,
                code: block.code.code,
                caption: block.code.caption,
                language: block.code.language
              }, null, 8, ["code", "caption", "language"])) : "proof" in block ? (_openBlock5(), _createElementBlock5("div", _hoisted_17, [
                _createElementVNode6("div", _hoisted_18, [
                  _createElementVNode6("span", {
                    class: "paper-proof-title",
                    innerHTML: block.proof.name || "Proof"
                  }, null, 8, _hoisted_19),
                  _cache[0] || (_cache[0] = _createTextVNode2(
                    " . ",
                    -1
                    /* CACHED */
                  ))
                ]),
                _createElementVNode6("div", _hoisted_20, [
                  (_openBlock5(true), _createElementBlock5(
                    _Fragment2,
                    null,
                    _renderList(block.proof.content, (nested, ni) => {
                      return _openBlock5(), _createElementBlock5(
                        _Fragment2,
                        {
                          key: $setup.nestedBlockKey(`proof-${bi}`, ni, nested)
                        },
                        [
                          typeof nested === "string" && $setup.isBlockHtml(nested) ? (_openBlock5(), _createElementBlock5("div", {
                            key: 0,
                            innerHTML: $setup.renderNestedText(nested)
                          }, null, 8, _hoisted_21)) : typeof nested === "string" ? (_openBlock5(), _createElementBlock5("p", {
                            key: 1,
                            innerHTML: $setup.renderNestedText(nested)
                          }, null, 8, _hoisted_222)) : "figure" in nested ? (_openBlock5(), _createElementBlock5("figure", {
                            key: 2,
                            id: $setup.figureId(nested.figure.label)
                          }, [
                            $setup.effectiveSlots.figure ? (_openBlock5(), _createBlock2(_resolveDynamicComponent2(() => $setup.effectiveSlots.figure({ figure: nested.figure, index: ni })), { key: 0 })) : (_openBlock5(), _createElementBlock5("img", {
                              key: 1,
                              src: `${$setup.ctx.assetBase}${nested.figure.filename}`,
                              alt: nested.figure.caption,
                              loading: "lazy"
                            }, null, 8, _hoisted_242)),
                            nested.figure.caption || nested.figure.number ? (_openBlock5(), _createElementBlock5("figcaption", _hoisted_252, [
                              nested.figure.number ? (_openBlock5(), _createElementBlock5(
                                "strong",
                                _hoisted_26,
                                "Figure " + _toDisplayString4(nested.figure.number) + ": ",
                                1
                                /* TEXT */
                              )) : _createCommentVNode5("v-if", true),
                              nested.figure.caption ? (_openBlock5(), _createElementBlock5("span", {
                                key: 1,
                                innerHTML: $setup.renderNestedText(nested.figure.caption)
                              }, null, 8, _hoisted_27)) : _createCommentVNode5("v-if", true)
                            ])) : _createCommentVNode5("v-if", true)
                          ], 8, _hoisted_232)) : "code" in nested ? (_openBlock5(), _createBlock2($setup["CodeBlock"], {
                            key: 3,
                            code: nested.code.code,
                            caption: nested.code.caption,
                            language: nested.code.language
                          }, null, 8, ["code", "caption", "language"])) : (_openBlock5(), _createBlock2($setup["MathBlock"], {
                            key: 4,
                            tex: nested.tex,
                            id: nested.anchorId || nested.id,
                            number: nested.number,
                            numbered: nested.numbered
                          }, null, 8, ["tex", "id", "number", "numbered"]))
                        ],
                        64
                        /* STABLE_FRAGMENT */
                      );
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])
              ])) : (_openBlock5(), _createBlock2($setup["MathBlock"], {
                key: 5,
                tex: block.tex,
                id: block.anchorId || block.id,
                number: block.number,
                numbered: block.numbered
              }, null, 8, ["tex", "id", "number", "numbered"]))
            ],
            64
            /* STABLE_FRAGMENT */
          );
        }),
        128
        /* KEYED_FRAGMENT */
      )),
      $props.section.callout ? (_openBlock5(), _createElementBlock5(
        _Fragment2,
        { key: 0 },
        [
          $setup.effectiveSlots.callout ? (_openBlock5(), _createBlock2(_resolveDynamicComponent2(() => $setup.effectiveSlots.callout({ callout: $props.section.callout, section: $props.section })), { key: 0 })) : (_openBlock5(), _createElementBlock5("div", _hoisted_28, [
            _createElementVNode6("a", {
              href: $props.section.callout.link
            }, _toDisplayString4($props.section.callout.text), 9, _hoisted_29)
          ]))
        ],
        64
        /* STABLE_FRAGMENT */
      )) : _createCommentVNode5("v-if", true)
    ],
    64
    /* STABLE_FRAGMENT */
  );
}

// src/vue/components/PaperSectionBlocks.vue
PaperSectionBlocks_default.render = render6;
PaperSectionBlocks_default.__file = "src/vue/components/PaperSectionBlocks.vue";
var PaperSectionBlocks_default2 = PaperSectionBlocks_default;

// sfc-script:/Users/mkbabb/Programming/latex-paper/src/vue/components/PaperSectionContent.vue?type=script
import { defineComponent as _defineComponent7 } from "vue";
import { inject as inject9, provide as provide2, useSlots as useSlots2 } from "vue";
var PaperSectionContent_default = /* @__PURE__ */ _defineComponent7({
  __name: "PaperSectionContent",
  props: {
    section: { type: Object, required: true },
    depth: { type: Number, required: true },
    sectionIndex: { type: Number, required: true }
  },
  setup(__props, { expose: __expose }) {
    __expose();
    const props = __props;
    const ownSlots = useSlots2();
    const parentSlots = inject9(CONTENT_SLOTS, null);
    const effectiveSlots = parentSlots ?? ownSlots;
    provide2(CONTENT_SLOTS, effectiveSlots);
    const __returned__ = { props, ownSlots, parentSlots, effectiveSlots, PaperSectionBlocks: PaperSectionBlocks_default2, PaperSection: PaperSection_default2 };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});

// sfc-template:/Users/mkbabb/Programming/latex-paper/src/vue/components/PaperSectionContent.vue?type=template
import { createVNode as _createVNode, createCommentVNode as _createCommentVNode6, renderList as _renderList2, Fragment as _Fragment3, openBlock as _openBlock6, createElementBlock as _createElementBlock6, resolveComponent as _resolveComponent, createBlock as _createBlock3, withCtx as _withCtx3 } from "vue";
function render7(_ctx, _cache, $props, $setup, $data, $options) {
  const _component_PaperSectionContent = _resolveComponent("PaperSectionContent", true);
  return _openBlock6(), _createBlock3($setup["PaperSection"], {
    id: $props.section.id,
    number: $props.section.number,
    title: $props.section.title,
    depth: $props.depth,
    "section-index": $props.sectionIndex
  }, {
    default: _withCtx3(() => [
      _createVNode($setup["PaperSectionBlocks"], { section: $props.section }, null, 8, ["section"]),
      _createCommentVNode6(" Recursive subsections "),
      $props.section.subsections ? (_openBlock6(true), _createElementBlock6(
        _Fragment3,
        { key: 0 },
        _renderList2($props.section.subsections, (sub) => {
          return _openBlock6(), _createBlock3(_component_PaperSectionContent, {
            key: sub.id,
            section: sub,
            depth: $props.depth + 1,
            "section-index": $props.sectionIndex
          }, null, 8, ["section", "depth", "section-index"]);
        }),
        128
        /* KEYED_FRAGMENT */
      )) : _createCommentVNode6("v-if", true)
    ]),
    _: 1
    /* STABLE */
  }, 8, ["id", "number", "title", "depth", "section-index"]);
}

// src/vue/components/PaperSectionContent.vue
PaperSectionContent_default.render = render7;
PaperSectionContent_default.__file = "src/vue/components/PaperSectionContent.vue";
var PaperSectionContent_default2 = PaperSectionContent_default;
export {
  CodeBlock_default2 as CodeBlock,
  MathBlock_default2 as MathBlock,
  MathInline_default2 as MathInline,
  PAPER_CONTEXT,
  PaperSection_default2 as PaperSection,
  PaperSectionBlocks_default2 as PaperSectionBlocks,
  PaperSectionContent_default2 as PaperSectionContent,
  Theorem_default2 as Theorem,
  createRenderTitle,
  flattenPaperSections,
  useClickDelegate,
  useKatex,
  useLazyLoader,
  usePaperReader,
  useScrollTo,
  useScrollTracker,
  useSidebarFollow,
  useTreeIndex,
  useVirtualSectionWindow
};
//# sourceMappingURL=vue.js.map