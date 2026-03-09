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
  function collectIds(list, out = []) {
    for (const node of list) {
      out.push(node.id);
      const children = getChildren(node);
      if (children) collectIds(children, out);
    }
    return out;
  }
  let rafId = 0;
  function onScroll() {
    if (rafId) return;
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
  return { activeId, activeRootId };
}

// src/vue/tracking/useScrollTo.ts
import { nextTick as nextTick3 } from "vue";
function useScrollTo(options) {
  const { scrollContainer, totalCount, visibleCount } = options;
  const scrollOffset = options.scrollOffset ?? 16;
  const maxAttempts = options.maxAttempts ?? 60;
  function scrollTo(id) {
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
  const { activeId, activeRootId } = useScrollTracker(
    treeNodes,
    treeIndex,
    visibleCount,
    { sidebarEl: options?.sidebarEl, scrollContainer }
  );
  const { scrollTo } = useScrollTo({
    scrollContainer,
    totalCount: sections.length,
    visibleCount
  });
  useClickDelegate({
    container: scrollContainer,
    selector: ".paper-ref",
    attribute: "data-ref",
    resolve: (refKey) => {
      const info = labelMap[refKey];
      if (!info) return null;
      return info.elementId ?? info.sectionId;
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
    renderInline,
    renderDisplay,
    renderTitle
  };
}

// sfc-script:/Users/mkbabb/Programming/latex-paper/src/vue/components/MathBlock.vue?type=script
import { defineComponent as _defineComponent } from "vue";
import { inject as inject3 } from "vue";
var MathBlock_default = /* @__PURE__ */ _defineComponent({
  __name: "MathBlock",
  props: {
    tex: { type: String, required: true },
    id: { type: String, required: false }
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
import { setBlockTracking as _setBlockTracking, createElementVNode as _createElementVNode } from "vue";
function render(_ctx, _cache, $props, $setup, $data, $options) {
  return _cache[0] || (_setBlockTracking(-1, true), (_cache[0] = _createElementVNode("div", {
    class: "math-block",
    id: $props.id,
    innerHTML: $setup.html
  }, null, 8, ["id", "innerHTML"])).cacheIndex = 0, _setBlockTracking(1), _cache[0]);
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
import { toDisplayString as _toDisplayString, createElementVNode as _createElementVNode3, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, createTextVNode as _createTextVNode, Fragment as _Fragment, renderSlot as _renderSlot, normalizeClass as _normalizeClass } from "vue";
var _hoisted_1 = ["id"];
var _hoisted_2 = { class: "theorem-label" };
var _hoisted_3 = { class: "theorem-type" };
var _hoisted_4 = {
  key: 0,
  class: "theorem-number"
};
var _hoisted_5 = ["innerHTML"];
function render3(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("div", {
    id: $props.label ? $props.label.replace(/:/g, "-") : void 0,
    class: _normalizeClass(["theorem-block", `theorem-block--${$props.type}`])
  }, [
    _createElementVNode3("p", _hoisted_2, [
      _createElementVNode3(
        "span",
        _hoisted_3,
        _toDisplayString($setup.labels[$props.type]),
        1
        /* TEXT */
      ),
      $props.number ? (_openBlock(), _createElementBlock(
        "span",
        _hoisted_4,
        "\xA0" + _toDisplayString($props.number),
        1
        /* TEXT */
      )) : _createCommentVNode("v-if", true),
      $props.name ? (_openBlock(), _createElementBlock(
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
      )) : _createCommentVNode("v-if", true)
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
  ], 10, _hoisted_1);
}

// src/vue/components/Theorem.vue
Theorem_default.render = render3;
Theorem_default.__file = "src/vue/components/Theorem.vue";
var Theorem_default2 = Theorem_default;

// sfc-script:/Users/mkbabb/Programming/latex-paper/src/vue/components/PaperSection.vue?type=script
import { defineComponent as _defineComponent4 } from "vue";
import { inject as inject6 } from "vue";
var PaperSection_default = /* @__PURE__ */ _defineComponent4({
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
    const ctx = inject6(PAPER_CONTEXT);
    const __returned__ = { ctx };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});

// sfc-template:/Users/mkbabb/Programming/latex-paper/src/vue/components/PaperSection.vue?type=template
import { toDisplayString as _toDisplayString2, createElementVNode as _createElementVNode4, resolveDynamicComponent as _resolveDynamicComponent, withCtx as _withCtx, openBlock as _openBlock2, createBlock as _createBlock, createElementBlock as _createElementBlock2, createCommentVNode as _createCommentVNode2, normalizeClass as _normalizeClass2, renderSlot as _renderSlot2, normalizeStyle as _normalizeStyle } from "vue";
var _hoisted_12 = ["id"];
var _hoisted_22 = { class: "section-number" };
var _hoisted_32 = ["innerHTML"];
var _hoisted_42 = {
  key: 0,
  class: "section-divider"
};
var _hoisted_52 = { class: "section-body" };
function render4(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock2(), _createElementBlock2("section", {
    id: $props.id,
    class: "paper-section",
    style: _normalizeStyle(($props.depth ?? 0) === 0 && $props.sectionIndex != null ? { "--_section-color": `var(--section-color-${$props.sectionIndex})` } : void 0)
  }, [
    _createElementVNode4(
      "div",
      {
        class: _normalizeClass2(["section-header", {
          "section-header--chapter": ($props.depth ?? 0) === 0,
          "section-header--sub": ($props.depth ?? 0) > 0
        }])
      },
      [
        (_openBlock2(), _createBlock(_resolveDynamicComponent(($props.depth ?? 0) > 0 ? "h3" : "h2"), { class: "section-heading" }, {
          default: _withCtx(() => [
            _createElementVNode4(
              "span",
              _hoisted_22,
              _toDisplayString2($props.number) + ".",
              1
              /* TEXT */
            ),
            _createElementVNode4("span", {
              class: "section-title",
              innerHTML: $setup.ctx.renderTitle($props.title)
            }, null, 8, _hoisted_32)
          ]),
          _: 1
          /* STABLE */
        })),
        ($props.depth ?? 0) === 0 ? (_openBlock2(), _createElementBlock2("div", _hoisted_42)) : _createCommentVNode2("v-if", true)
      ],
      2
      /* CLASS */
    ),
    _createElementVNode4("div", _hoisted_52, [
      _renderSlot2(_ctx.$slots, "default")
    ])
  ], 12, _hoisted_12);
}

// src/vue/components/PaperSection.vue
PaperSection_default.render = render4;
PaperSection_default.__file = "src/vue/components/PaperSection.vue";
var PaperSection_default2 = PaperSection_default;

// sfc-script:/Users/mkbabb/Programming/latex-paper/src/vue/components/PaperSectionContent.vue?type=script
import { defineComponent as _defineComponent5 } from "vue";
import { inject as inject7, provide, useSlots } from "vue";
var CONTENT_SLOTS = /* @__PURE__ */ Symbol("content-slots");
var PaperSectionContent_default = /* @__PURE__ */ _defineComponent5({
  __name: "PaperSectionContent",
  props: {
    section: { type: Object, required: true },
    depth: { type: Number, required: true },
    sectionIndex: { type: Number, required: true }
  },
  setup(__props, { expose: __expose }) {
    __expose();
    const props = __props;
    const ownSlots = useSlots();
    const parentSlots = inject7(CONTENT_SLOTS, null);
    const effectiveSlots = parentSlots ?? ownSlots;
    provide(CONTENT_SLOTS, effectiveSlots);
    const ctx = inject7(PAPER_CONTEXT);
    function renderParagraph(text) {
      return ctx.renderTitle(text);
    }
    function isBlockHtml(text) {
      return /^<(ol|ul|dl|blockquote|div)\b/.test(text.trim());
    }
    const __returned__ = { CONTENT_SLOTS, props, ownSlots, parentSlots, effectiveSlots, ctx, renderParagraph, isBlockHtml, MathBlock: MathBlock_default2, PaperSection: PaperSection_default2, Theorem: Theorem_default2 };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});

// sfc-template:/Users/mkbabb/Programming/latex-paper/src/vue/components/PaperSectionContent.vue?type=template
import { createCommentVNode as _createCommentVNode3, renderList as _renderList, Fragment as _Fragment2, openBlock as _openBlock3, createElementBlock as _createElementBlock3, createBlock as _createBlock2, resolveDynamicComponent as _resolveDynamicComponent2, withCtx as _withCtx2, resolveComponent as _resolveComponent, toDisplayString as _toDisplayString3, createElementVNode as _createElementVNode5 } from "vue";
var _hoisted_13 = ["innerHTML"];
var _hoisted_23 = ["innerHTML"];
var _hoisted_33 = ["id"];
var _hoisted_43 = ["src", "alt"];
var _hoisted_53 = ["innerHTML"];
var _hoisted_6 = ["innerHTML"];
var _hoisted_7 = {
  key: 1,
  class: "paper-callout"
};
var _hoisted_8 = ["href"];
function render5(_ctx, _cache, $props, $setup, $data, $options) {
  const _component_PaperSectionContent = _resolveComponent("PaperSectionContent", true);
  return _openBlock3(), _createBlock2($setup["PaperSection"], {
    id: $props.section.id,
    number: $props.section.number,
    title: $props.section.title,
    depth: $props.depth,
    "section-index": $props.sectionIndex
  }, {
    default: _withCtx2(() => [
      _createCommentVNode3(" Interleaved paragraphs and display math "),
      (_openBlock3(true), _createElementBlock3(
        _Fragment2,
        null,
        _renderList($props.section.content, (block, bi) => {
          return _openBlock3(), _createElementBlock3(
            _Fragment2,
            { key: bi },
            [
              typeof block === "string" ? (_openBlock3(), _createElementBlock3(
                _Fragment2,
                { key: 0 },
                [
                  $setup.isBlockHtml(block) ? (_openBlock3(), _createElementBlock3("div", {
                    key: 0,
                    innerHTML: $setup.renderParagraph(block)
                  }, null, 8, _hoisted_13)) : (_openBlock3(), _createElementBlock3("p", {
                    key: 1,
                    innerHTML: $setup.renderParagraph(block)
                  }, null, 8, _hoisted_23))
                ],
                64
                /* STABLE_FRAGMENT */
              )) : (_openBlock3(), _createBlock2($setup["MathBlock"], {
                key: 1,
                tex: block.tex,
                id: block.id
              }, null, 8, ["tex", "id"]))
            ],
            64
            /* STABLE_FRAGMENT */
          );
        }),
        128
        /* KEYED_FRAGMENT */
      )),
      _createCommentVNode3(" Figures "),
      $props.section.figures ? (_openBlock3(true), _createElementBlock3(
        _Fragment2,
        { key: 0 },
        _renderList($props.section.figures, (fig, fi) => {
          return _openBlock3(), _createElementBlock3("figure", {
            key: fi,
            id: fig.label ? fig.label.replace(/:/g, "-") : void 0
          }, [
            $setup.effectiveSlots.figure ? (_openBlock3(), _createBlock2(_resolveDynamicComponent2(() => $setup.effectiveSlots.figure({ figure: fig, index: fi })), { key: 0 })) : (_openBlock3(), _createElementBlock3("img", {
              key: 1,
              src: `${$setup.ctx.assetBase}${fig.filename}`,
              alt: fig.caption,
              loading: "lazy"
            }, null, 8, _hoisted_43)),
            fig.caption ? (_openBlock3(), _createElementBlock3("figcaption", {
              key: 2,
              innerHTML: $setup.renderParagraph(fig.caption)
            }, null, 8, _hoisted_53)) : _createCommentVNode3("v-if", true)
          ], 8, _hoisted_33);
        }),
        128
        /* KEYED_FRAGMENT */
      )) : _createCommentVNode3("v-if", true),
      _createCommentVNode3(" Theorems "),
      $props.section.theorems ? (_openBlock3(true), _createElementBlock3(
        _Fragment2,
        { key: 1 },
        _renderList($props.section.theorems, (thm, ti) => {
          return _openBlock3(), _createBlock2($setup["Theorem"], {
            key: ti,
            type: thm.type,
            name: thm.name,
            number: thm.number,
            label: thm.label
          }, {
            default: _withCtx2(() => [
              thm.body.trim() ? (_openBlock3(), _createElementBlock3("p", {
                key: 0,
                innerHTML: $setup.renderParagraph(thm.body)
              }, null, 8, _hoisted_6)) : _createCommentVNode3("v-if", true),
              (_openBlock3(true), _createElementBlock3(
                _Fragment2,
                null,
                _renderList(thm.math, (eq, ei) => {
                  return _openBlock3(), _createBlock2($setup["MathBlock"], {
                    key: ei,
                    tex: eq
                  }, null, 8, ["tex"]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ]),
            _: 2
            /* DYNAMIC */
          }, 1032, ["type", "name", "number", "label"]);
        }),
        128
        /* KEYED_FRAGMENT */
      )) : _createCommentVNode3("v-if", true),
      _createCommentVNode3(" Recursive subsections "),
      $props.section.subsections ? (_openBlock3(true), _createElementBlock3(
        _Fragment2,
        { key: 2 },
        _renderList($props.section.subsections, (sub) => {
          return _openBlock3(), _createBlock2(_component_PaperSectionContent, {
            key: sub.id,
            section: sub,
            depth: $props.depth + 1,
            "section-index": $props.sectionIndex
          }, null, 8, ["section", "depth", "section-index"]);
        }),
        128
        /* KEYED_FRAGMENT */
      )) : _createCommentVNode3("v-if", true),
      _createCommentVNode3(" Callout "),
      $props.section.callout ? (_openBlock3(), _createElementBlock3(
        _Fragment2,
        { key: 3 },
        [
          $setup.effectiveSlots.callout ? (_openBlock3(), _createBlock2(_resolveDynamicComponent2(() => $setup.effectiveSlots.callout({ callout: $props.section.callout, section: $props.section })), { key: 0 })) : (_openBlock3(), _createElementBlock3("div", _hoisted_7, [
            _createElementVNode5("a", {
              href: $props.section.callout.link
            }, _toDisplayString3($props.section.callout.text), 9, _hoisted_8)
          ]))
        ],
        64
        /* STABLE_FRAGMENT */
      )) : _createCommentVNode3("v-if", true)
    ]),
    _: 1
    /* STABLE */
  }, 8, ["id", "number", "title", "depth", "section-index"]);
}

// src/vue/components/PaperSectionContent.vue
PaperSectionContent_default.render = render5;
PaperSectionContent_default.__file = "src/vue/components/PaperSectionContent.vue";
var PaperSectionContent_default2 = PaperSectionContent_default;
export {
  MathBlock_default2 as MathBlock,
  MathInline_default2 as MathInline,
  PAPER_CONTEXT,
  PaperSection_default2 as PaperSection,
  PaperSectionContent_default2 as PaperSectionContent,
  Theorem_default2 as Theorem,
  createRenderTitle,
  useClickDelegate,
  useKatex,
  useLazyLoader,
  usePaperReader,
  useScrollTo,
  useScrollTracker,
  useTreeIndex
};
//# sourceMappingURL=vue.js.map