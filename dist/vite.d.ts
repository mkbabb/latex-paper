import { Plugin } from 'vite';
import { f as flattenPaperSections, C as CompiledTocEntry } from './flattenPaperSections-CN98CCOQ.js';
export { P as PaperFigureData, a as PaperSectionData, b as PaperTheoremData, p as parseLatexTocPages, c as parseTotalPages } from './flattenPaperSections-CN98CCOQ.js';

/**
 * @mkbabb/latex-paper/vite — Vite plugin entry point.
 *
 * Configurable Vite plugin that parses LaTeX at build time and exposes
 * structured paper content as a virtual module.
 */

declare function buildPageMapFromTocEntries(sections: Parameters<typeof flattenPaperSections>[0], tocEntries: readonly CompiledTocEntry[], warn?: (message: string) => void): Record<string, number>;
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

export { type LatexPaperPluginOptions, buildPageMapFromTocEntries, latexPaperPlugin as default };
