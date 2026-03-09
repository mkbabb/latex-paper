/**
 * @mkbabb/latex-paper/vite — Vite plugin entry point.
 *
 * Configurable Vite plugin that parses LaTeX at build time and exposes
 * structured paper content as a virtual module.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { parseLatex } from "./grammar/document";
import { parseBibToMap } from "./bibtex/parser";
import { Transformer } from "./transform/html";
import type { TransformOptions } from "./transform/html";

export interface LatexPaperPluginOptions {
    /** Path to the .tex file (absolute or relative to project root). */
    texPath: string;
    /** Path to the .bib file. Defaults to texPath with .bib extension. */
    bibPath?: string;
    /** KaTeX macros. */
    macros?: Record<string, string>;
    /** Section callout mapping. */
    callouts?: Record<string, { text: string; link: string }>;
    /** Virtual module ID. Defaults to "virtual:paper-content". */
    virtualModuleId?: string;
}

export default function latexPaperPlugin(
    options: LatexPaperPluginOptions,
): Plugin {
    const virtualId = options.virtualModuleId ?? "virtual:paper-content";
    const resolvedVirtualId = "\0" + virtualId;
    let resolvedTexPath: string;
    let resolvedBibPath: string;

    return {
        name: "vite-plugin-latex-paper",

        configResolved(config) {
            resolvedTexPath = resolve(config.root, options.texPath);
            resolvedBibPath = options.bibPath
                ? resolve(config.root, options.bibPath)
                : resolvedTexPath.replace(/\.tex$/, ".bib");
        },

        resolveId(id) {
            if (id === virtualId) return resolvedVirtualId;
        },

        load(id) {
            if (id !== resolvedVirtualId) return;

            // Watch files for HMR
            this.addWatchFile(resolvedTexPath);
            this.addWatchFile(resolvedBibPath);

            // Parse bibliography
            let bibSource: string;
            try {
                bibSource = readFileSync(resolvedBibPath, "utf-8");
            } catch {
                bibSource = "";
            }
            const bibEntries = parseBibToMap(bibSource);

            // Parse LaTeX
            const texSource = readFileSync(resolvedTexPath, "utf-8");
            const ast = parseLatex(texSource);

            // Transform to sections
            const transformOpts: TransformOptions = {
                macros: options.macros,
                callouts: options.callouts,
                bibEntries,
            };
            const transformer = new Transformer(transformOpts);
            const sections = transformer.transform(ast);
            const labelMap = transformer.labelMap;

            return [
                `// Auto-generated from ${resolvedTexPath} — do not edit manually`,
                `export const paperSections = ${JSON.stringify(sections, null, 2)};`,
                `export const labelMap = ${JSON.stringify(labelMap, null, 2)};`,
            ].join("\n");
        },

        handleHotUpdate({ file, server }) {
            if (
                file === resolvedTexPath ||
                file === resolvedBibPath
            ) {
                const mod =
                    server.moduleGraph.getModuleById(resolvedVirtualId);
                if (mod) {
                    server.moduleGraph.invalidateModule(mod);
                    return [mod];
                }
            }
        },
    };
}

// Re-export types that consumers of the plugin might need
export type {
    PaperSectionData,
    PaperTheoremData,
    PaperFigureData,
} from "./types/output";
