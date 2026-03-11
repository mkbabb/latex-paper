import { Plugin } from 'vite';
import { f as flattenPaperSections } from './flattenPaperSections-jzNipltq.js';
export { P as PaperFigureData, a as PaperSectionData, b as PaperTheoremData } from './flattenPaperSections-jzNipltq.js';

/**
 * @mkbabb/latex-paper/vite — Vite plugin entry point.
 *
 * Configurable Vite plugin that parses LaTeX at build time and exposes
 * structured paper content as a virtual module.
 */

interface TocPageEntry {
    type: "chapter" | "section" | "subsection";
    page: number;
}
/**
 * Extract ordered TOC page numbers from LaTeX .aux output.
 * We only rely on entry order + page numbers, which is robust to inline math,
 * braces, and escaped symbols in section titles.
 */
declare function parseLatexTocPages(auxSource: string): TocPageEntry[];
declare function buildPageMapFromTocEntries(sections: Parameters<typeof flattenPaperSections>[0], tocEntries: readonly TocPageEntry[], warn?: (message: string) => void): Record<string, number>;
interface LatexPaperPluginOptions {
    /** Path to the .tex file (absolute or relative to project root). */
    texPath: string;
    /** Path to the .bib file. Defaults to texPath with .bib extension. */
    bibPath?: string;
    /** KaTeX macros. */
    macros?: Record<string, string>;
    /** Section callout mapping. */
    callouts?: Record<string, {
        text: string;
        link: string;
    }>;
    /** Virtual module ID. Defaults to "virtual:paper-content". */
    virtualModuleId?: string;
}
declare function latexPaperPlugin(options: LatexPaperPluginOptions): Plugin;

export { type LatexPaperPluginOptions, type TocPageEntry, buildPageMapFromTocEntries, latexPaperPlugin as default, parseLatexTocPages };
