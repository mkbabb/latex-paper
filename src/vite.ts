/**
 * @mkbabb/latex-paper/vite — Vite plugin entry point.
 *
 * Configurable Vite plugin that parses LaTeX at build time and exposes
 * structured paper content as a virtual module.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { parseLatex } from "./grammar/document";
import { parseBibToMap } from "./bibtex/parser";
import { flattenPaperSections } from "./paper/flattenPaperSections";
import { Transformer } from "./transform/html";
import type { TransformOptions } from "./transform/html";

/** Extract total page count from pdflatex .log output. */
function parseTotalPages(logSource: string): number | null {
    const m = logSource.match(/Output written on .+\((\d+) pages/);
    return m ? parseInt(m[1], 10) : null;
}

export interface TocPageEntry {
    type: "chapter" | "section" | "subsection";
    page: number;
}

/**
 * Extract ordered TOC page numbers from LaTeX .aux output.
 * We only rely on entry order + page numbers, which is robust to inline math,
 * braces, and escaped symbols in section titles.
 */
export function parseLatexTocPages(auxSource: string): TocPageEntry[] {
    const entries: TocPageEntry[] = [];
    for (const line of auxSource.split(/\r?\n/)) {
        const match = line.match(
            /\\contentsline\s*\{(chapter|section|subsection)\}\{.*\}\{(\d+)\}\{/,
        );
        if (!match) continue;
        entries.push({
            type: match[1] as TocPageEntry["type"],
            page: parseInt(match[2], 10),
        });
    }
    return entries;
}

export function buildPageMapFromTocEntries(
    sections: Parameters<typeof flattenPaperSections>[0],
    tocEntries: readonly TocPageEntry[],
    warn?: (message: string) => void,
): Record<string, number> {
    const flatSections = flattenPaperSections(sections);
    const pageMap: Record<string, number> = {};
    let lastPage = tocEntries[0]?.page ?? 1;
    let tocIndex = 0;
    const trackedSections = flatSections.filter(
        (section) => section.sourceLevel <= 2 && !section.starred,
    );

    if (trackedSections.length !== tocEntries.length) {
        warn?.(
            `latex-paper: TOC page entry mismatch (tracked=${trackedSections.length}, toc=${tocEntries.length}); using ordered fallback pages where needed.`,
        );
    }

    for (const section of flatSections) {
        if (section.sourceLevel <= 2 && !section.starred) {
            lastPage = tocEntries[tocIndex]?.page ?? lastPage;
            tocIndex += 1;
        }
        pageMap[section.id] = lastPage;
    }

    return pageMap;
}

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

            // Also watch .log and .aux for page data
            const logPath = resolvedTexPath.replace(/\.tex$/, ".log");
            const auxPath = resolvedTexPath.replace(/\.tex$/, ".aux");
            if (existsSync(logPath)) this.addWatchFile(logPath);
            if (existsSync(auxPath)) this.addWatchFile(auxPath);

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

            // Parse page data from LaTeX compilation artifacts
            let totalPages = 0;
            let pageMap: Record<string, number> = {};
            try {
                const logSource = readFileSync(logPath, "utf-8");
                totalPages = parseTotalPages(logSource) ?? 0;
            } catch { /* .log not available */ }
            try {
                const auxSource = readFileSync(auxPath, "utf-8");
                const tocEntries = parseLatexTocPages(auxSource);
                pageMap = buildPageMapFromTocEntries(
                    sections,
                    tocEntries,
                    (message) => this.warn(message),
                );
            } catch { /* .aux not available */ }

            return [
                `// Auto-generated from ${resolvedTexPath} — do not edit manually`,
                `export const paperSections = ${JSON.stringify(sections, null, 2)};`,
                `export const labelMap = ${JSON.stringify(labelMap, null, 2)};`,
                `export const totalPages = ${totalPages};`,
                `export const pageMap = ${JSON.stringify(pageMap)};`,
            ].join("\n");
        },

        handleHotUpdate({ file, server }) {
            const logPath = resolvedTexPath.replace(/\.tex$/, ".log");
            const auxPath = resolvedTexPath.replace(/\.tex$/, ".aux");
            if (
                file === resolvedTexPath ||
                file === resolvedBibPath ||
                file === logPath ||
                file === auxPath
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
