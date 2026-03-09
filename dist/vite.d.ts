import { Plugin } from 'vite';
export { P as PaperFigureData, a as PaperSectionData, b as PaperTheoremData } from './output-zFciSIqc.js';

/**
 * @mkbabb/latex-paper/vite — Vite plugin entry point.
 *
 * Configurable Vite plugin that parses LaTeX at build time and exposes
 * structured paper content as a virtual module.
 */

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

export { type LatexPaperPluginOptions, latexPaperPlugin as default };
