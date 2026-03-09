/**
 * KaTeX rendering with module-level cache and configurable macros.
 * If no macros are provided, attempts to use macros from injected PaperContext.
 */
export declare function useKatex(macros?: Record<string, string>): {
    renderInline: (tex: string) => string;
    renderDisplay: (tex: string) => string;
    renderTitle: (text: string) => string;
};
//# sourceMappingURL=useKatex.d.ts.map