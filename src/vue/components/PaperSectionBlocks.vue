<script setup lang="ts">
import { inject, provide, useSlots } from "vue";
import type { PaperSectionData } from "../../types/output";
import { PAPER_CONTEXT } from "../context";
import { CONTENT_SLOTS } from "./paperSectionSlots";
import MathBlock from "./MathBlock.vue";
import Theorem from "./Theorem.vue";

const props = defineProps<{
    section: PaperSectionData;
}>();

const ownSlots = useSlots();
const parentSlots = inject(CONTENT_SLOTS, null);
const effectiveSlots = parentSlots ?? ownSlots;
provide(CONTENT_SLOTS, effectiveSlots);

const ctx = inject(PAPER_CONTEXT)!;

function renderParagraph(text: string): string {
    return ctx.renderTitle(text);
}

function isBlockHtml(text: string): boolean {
    return /^<(ol|ul|dl|blockquote|div)\b/.test(text.trim());
}
</script>

<template>
    <template v-for="(block, bi) in section.content" :key="bi">
        <template v-if="typeof block === 'string'">
            <div
                v-if="isBlockHtml(block)"
                v-html="renderParagraph(block)"
            />
            <p v-else v-html="renderParagraph(block)" />
        </template>

        <Theorem
            v-else-if="'theorem' in block"
            :type="block.theorem.type"
            :name="block.theorem.name"
            :number="block.theorem.number"
            :label="block.theorem.label"
        >
            <p v-if="block.theorem.body.trim()" v-html="renderParagraph(block.theorem.body)" />
            <MathBlock
                v-for="(eq, ei) in block.theorem.math"
                :key="ei"
                :tex="eq"
            />
        </Theorem>

        <figure
            v-else-if="'figure' in block"
            :id="block.figure.label ? block.figure.label.replace(/:/g, '-') : undefined"
        >
            <component
                v-if="effectiveSlots.figure"
                :is="() => effectiveSlots.figure!({ figure: block.figure, index: bi })"
            />
            <img
                v-else
                :src="`${ctx.assetBase}${block.figure.filename}`"
                :alt="block.figure.caption"
                loading="lazy"
            />
            <figcaption
                v-if="block.figure.caption"
                v-html="renderParagraph(block.figure.caption)"
            />
        </figure>

        <MathBlock v-else :tex="block.tex" :id="block.id" />
    </template>

    <template v-if="section.callout">
        <component
            v-if="effectiveSlots.callout"
            :is="() => effectiveSlots.callout!({ callout: section.callout!, section })"
        />
        <div v-else class="paper-callout">
            <a :href="section.callout.link">{{ section.callout.text }}</a>
        </div>
    </template>
</template>
