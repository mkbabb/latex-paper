<script setup lang="ts">
import { inject } from "vue";
import { PAPER_CONTEXT } from "../context";

const props = defineProps<{ tex: string; id?: string }>();
const ctx = inject(PAPER_CONTEXT)!;
const html = ctx.renderDisplay(props.tex);
</script>

<template>
    <div class="math-block" :id="id" v-once v-html="html" />
</template>
