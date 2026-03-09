<script lang="ts">
import type { InjectionKey, Slots } from "vue";
/** Injection key for propagating consumer slots through recursive instances.
 *  Must be module-scoped so all instances share the same Symbol. */
const CONTENT_SLOTS: InjectionKey<Slots> = Symbol("content-slots");
</script>

<script setup lang="ts">
import { inject, provide, useSlots } from "vue";
import type { PaperSectionData } from "../../types/output";
import { PAPER_CONTEXT } from "../context";
import MathBlock from "./MathBlock.vue";
import PaperSection from "./PaperSection.vue";
import Theorem from "./Theorem.vue";

const props = defineProps<{
    section: PaperSectionData;
    depth: number;
    sectionIndex: number;
}>();

const ownSlots = useSlots();
// Root instance captures consumer slots; children inherit via inject.
const parentSlots = inject(CONTENT_SLOTS, null);
const effectiveSlots = parentSlots ?? ownSlots;
provide(CONTENT_SLOTS, effectiveSlots);

const ctx = inject(PAPER_CONTEXT)!;

function renderParagraph(text: string): string {
    return ctx.renderTitle(text);
}

/** Block-level HTML can't be nested inside <p> tags. */
function isBlockHtml(text: string): boolean {
    return /^<(ol|ul|dl|blockquote|div)\b/.test(text.trim());
}
</script>

<template>
    <PaperSection
        :id="section.id"
        :number="section.number"
        :title="section.title"
        :depth="depth"
        :section-index="sectionIndex"
    >
        <!-- Paragraphs with inline math -->
        <template v-for="(para, pi) in section.paragraphs" :key="pi">
            <div
                v-if="isBlockHtml(para)"
                v-html="renderParagraph(para)"
            />
            <p v-else v-html="renderParagraph(para)" />
        </template>

        <!-- Figures -->
        <template v-if="section.figures">
            <figure
                v-for="(fig, fi) in section.figures"
                :key="fi"
                :id="fig.label ? fig.label.replace(/:/g, '-') : undefined"
            >
                <component
                    v-if="effectiveSlots.figure"
                    :is="() => effectiveSlots.figure!({ figure: fig, index: fi })"
                />
                <img
                    v-else
                    :src="`${ctx.assetBase}${fig.filename}`"
                    :alt="fig.caption"
                    loading="lazy"
                />
                <figcaption
                    v-if="fig.caption"
                    v-html="renderParagraph(fig.caption)"
                />
            </figure>
        </template>

        <!-- Theorems -->
        <template v-if="section.theorems">
            <Theorem
                v-for="(thm, ti) in section.theorems"
                :key="ti"
                :type="thm.type"
                :name="thm.name"
                :number="thm.number"
                :label="thm.label"
            >
                <p v-if="thm.body.trim()" v-html="renderParagraph(thm.body)" />
                <MathBlock
                    v-for="(eq, ei) in thm.math"
                    :key="ei"
                    :tex="eq"
                />
            </Theorem>
        </template>

        <!-- Recursive subsections -->
        <template v-if="section.subsections">
            <PaperSectionContent
                v-for="sub in section.subsections"
                :key="sub.id"
                :section="sub"
                :depth="depth + 1"
                :section-index="sectionIndex"
            />
        </template>

        <!-- Callout -->
        <template v-if="section.callout">
            <component
                v-if="effectiveSlots.callout"
                :is="() => effectiveSlots.callout!({ callout: section.callout!, section })"
            />
            <div v-else class="paper-callout">
                <a :href="section.callout.link">{{
                    section.callout.text
                }}</a>
            </div>
        </template>
    </PaperSection>
</template>
