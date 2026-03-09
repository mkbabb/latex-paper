import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        transform: "src/transform.ts",
        vite: "src/vite.ts",
    },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ["katex", "vite"],
    loader: {
        ".bbnf": "text",
    },
});
