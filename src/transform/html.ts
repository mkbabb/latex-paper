/**
 * AST → HTML transformer with configurable macros and callouts.
 */

import type {
    LatexNode,
    TheoremNode,
    ListNode,
    DescriptionNode,
    CommandNode,
} from "../types/ast";
import type {
    PaperSectionData,
    PaperTheoremData,
    PaperFigureData,
    PaperLabelInfo,
    ContentBlock,
    TheoremBlock,
    FigureBlock,
} from "../types/output";
import type { BibEntry } from "../types/bibtex";
import { LabelRegistry } from "./labels";
import { astToText } from "../grammar/document";
import { cleanRawLatex, slugify } from "./clean";

// Re-export sub-modules for backwards compatibility
export { cleanRawLatex } from "./clean";
export { validateOutput } from "./validate";
export type { ValidationIssue } from "./validate";

export interface TransformOptions {
    /** KaTeX macros (merged with defaults). */
    macros?: Record<string, string>;
    /** Section callout mapping: section id → { text, link }. */
    callouts?: Record<string, { text: string; link: string }>;
    /** Custom math renderer. Default: KaTeX if available. */
    renderMath?: (tex: string, displayMode: boolean) => string;
    /** Bibliography entries for \cite resolution. */
    bibEntries?: Map<string, BibEntry>;
}

/** Default KaTeX macros used in the fourier_paper. */
export const DEFAULT_MACROS: Record<string, string> = {};

// ── Transformer ─────────────────────────────────────────────────────

/**
 * Transform a LaTeX AST into structured PaperSectionData[].
 */
export class Transformer {
    private options: TransformOptions;
    private bibEntries: Map<string, BibEntry>;
    private labels: LabelRegistry;
    /** After transform(), contains label key → location mapping. */
    labelMap: Record<string, PaperLabelInfo> = {};

    constructor(options: TransformOptions = {}) {
        this.options = options;
        this.bibEntries = options.bibEntries ?? new Map();
        this.labels = new LabelRegistry();
    }

    /** Transform a full AST (typically from parseLatex) into sections. */
    transform(nodes: LatexNode[]): PaperSectionData[] {
        // Pass 1: collect labels
        this.labels.collectLabels(nodes);

        // Extract the document body (inside \begin{document}...\end{document})
        let bodyNodes = nodes;
        for (const node of nodes) {
            if (
                node.type === "environment" &&
                node.name === "document"
            ) {
                bodyNodes = node.body;
                break;
            }
        }

        // Find all section nodes and build hierarchy
        return this.buildSectionHierarchy(bodyNodes);
    }

    private buildSectionHierarchy(nodes: LatexNode[]): PaperSectionData[] {
        // Find section boundaries
        interface SectionRange {
            level: number; // 0=chapter, 1=section, 2=subsection
            title: string;
            starred: boolean;
            startIdx: number;
            endIdx: number;
        }

        const ranges: SectionRange[] = [];
        const levelMap = { chapter: 0, section: 1, subsection: 2, subsubsection: 3 };

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (node.type === "section") {
                ranges.push({
                    level: levelMap[node.level],
                    title: cleanRawLatex(astToText(node.title), (key) =>
                        this.labels.resolve(key)?.number,
                    ),
                    starred: node.starred,
                    startIdx: i + 1,
                    endIdx: nodes.length,
                });
            }
        }

        // Set end indices
        for (let i = 0; i < ranges.length - 1; i++) {
            ranges[i].endIdx = ranges[i + 1].startIdx - 1;
        }

        // Build hierarchy
        const topLevel: PaperSectionData[] = [];
        let chapterNum = 0;
        let sectionNum = 0;
        let subsectionNum = 0;
        let currentChapter: PaperSectionData | null = null;
        let currentSection: PaperSectionData | null = null;
        const callouts = this.options.callouts ?? {};

        for (const range of ranges) {
            const bodyNodes = nodes.slice(range.startIdx, range.endIdx);
            const id = slugify(range.title);
            const content = this.extractContent(bodyNodes);
            // Derive theorems/figures arrays from the unified content stream
            const theorems = content
                .filter((b): b is TheoremBlock => typeof b === "object" && b !== null && "theorem" in b)
                .map(b => b.theorem);
            const figures = content
                .filter((b): b is FigureBlock => typeof b === "object" && b !== null && "figure" in b)
                .map(b => b.figure);
            const callout = callouts[id];

            // Tag all labels in this section's body with the section ID
            this.tagLabelsInNodes(bodyNodes, id);

            if (range.level === 0) {
                chapterNum++;
                sectionNum = 0;
                subsectionNum = 0;

                currentChapter = {
                    id,
                    number: String(chapterNum),
                    title: range.title,
                    sourceLevel: range.level,
                    starred: range.starred,
                    content,
                    ...(theorems.length > 0 && { theorems }),
                    ...(figures.length > 0 && { figures }),
                    subsections: [],
                    ...(callout && { callout }),
                };
                currentSection = null;
                topLevel.push(currentChapter);
            } else if (range.level === 1) {
                if (!currentChapter) {
                    // Pre-chapter section
                    chapterNum++;
                    sectionNum = 0;
                    topLevel.push({
                        id,
                        number: String(chapterNum),
                        title: range.title,
                        sourceLevel: range.level,
                        starred: range.starred,
                        content,
                        ...(theorems.length > 0 && { theorems }),
                        ...(figures.length > 0 && { figures }),
                        ...(callout && { callout }),
                    });
                } else {
                    sectionNum++;
                    subsectionNum = 0;
                    currentSection = {
                        id,
                        number: `${chapterNum}.${sectionNum}`,
                        title: range.title,
                        sourceLevel: range.level,
                        starred: range.starred,
                        content,
                        ...(theorems.length > 0 && { theorems }),
                        ...(figures.length > 0 && { figures }),
                        subsections: [],
                        ...(callout && { callout }),
                    };
                    currentChapter.subsections!.push(currentSection);
                }
            } else if (range.level === 2) {
                if (currentChapter && !currentSection) {
                    sectionNum++;
                    subsectionNum = 0;
                    currentSection = {
                        id,
                        number: `${chapterNum}.${sectionNum}`,
                        title: range.title,
                        sourceLevel: range.level,
                        starred: range.starred,
                        content,
                        ...(theorems.length > 0 && { theorems }),
                        ...(figures.length > 0 && { figures }),
                        subsections: [],
                        ...(callout && { callout }),
                    };
                    currentChapter.subsections!.push(currentSection);
                } else {
                    subsectionNum++;
                    const parent = currentSection || currentChapter;
                    if (parent) {
                        if (!parent.subsections) parent.subsections = [];
                        parent.subsections.push({
                            id,
                            number: `${chapterNum}.${sectionNum}.${subsectionNum}`,
                            title: range.title,
                            sourceLevel: range.level,
                            starred: range.starred,
                            content,
                            ...(theorems.length > 0 && { theorems }),
                            ...(figures.length > 0 && { figures }),
                            ...(callout && { callout }),
                        });
                    }
                }
            }
        }

        // Generate summaries
        this.generateSummaries(topLevel);

        // Clean empty subsections
        this.cleanEmpty(topLevel);

        // Build the label map from registry + section tags
        this.buildLabelMap();

        return topLevel;
    }

    /** Recursively tag labels found in AST nodes with a section ID. */
    private tagLabelsInNodes(nodes: LatexNode[], sectionId: string): void {
        for (const node of nodes) {
            if (node.type === "label") {
                const info = this.labels.resolve(node.key);
                if (info) info.sectionId = sectionId;
            } else if (node.type === "theorem") {
                this.tagLabelsInNodes(node.body, sectionId);
            } else if (node.type === "figure") {
                if (node.label) {
                    const info = this.labels.resolve(node.label);
                    if (info) info.sectionId = sectionId;
                }
            } else if (node.type === "math" && node.display) {
                // Check for \label{...} in math content (use rawValue to find stripped labels)
                const source = node.rawValue ?? node.value;
                for (const m of source.matchAll(/\\label\{([^}]+)\}/g)) {
                    const info = this.labels.resolve(m[1]);
                    if (info) info.sectionId = sectionId;
                }
            } else if (node.type === "environment") {
                this.tagLabelsInNodes(node.body, sectionId);
            } else if (node.type === "proof") {
                this.tagLabelsInNodes(node.body, sectionId);
            } else if (node.type === "list") {
                for (const item of node.items) this.tagLabelsInNodes(item, sectionId);
            }
        }
    }

    /** Build the public labelMap from the registry. */
    private buildLabelMap(): void {
        for (const [key, info] of this.labels.all()) {
            // Generate element-level IDs for precise scroll targeting
            const elementId =
                info.type === "section"
                    ? undefined // sections already have their own IDs
                    : key.replace(/:/g, "-"); // thm:sturm_proof → thm-sturm_proof
            this.labelMap[key] = {
                number: info.number,
                type: info.type,
                sectionId: info.sectionId ?? "",
                ...(elementId && { elementId }),
            };
        }
    }

    /** Generate content summary strings for each section (recursive). */
    private generateSummaries(sections: PaperSectionData[]): void {
        for (const section of sections) {
            if (section.subsections) this.generateSummaries(section.subsections);

            const counts: Record<string, number> = {};
            function countItems(s: PaperSectionData) {
                for (const t of s.theorems ?? []) {
                    counts[t.type] = (counts[t.type] ?? 0) + 1;
                }
                for (const sub of s.subsections ?? []) countItems(sub);
            }
            countItems(section);

            const parts = Object.entries(counts)
                .map(([type, n]) => `${n} ${type}${n > 1 ? "s" : ""}`)
                .join(", ");
            if (parts) section.summary = parts;
        }
    }

    private cleanEmpty(sections: PaperSectionData[]): void {
        for (const s of sections) {
            if (s.subsections && s.subsections.length === 0) {
                delete s.subsections;
            } else if (s.subsections) {
                this.cleanEmpty(s.subsections);
            }
        }
    }

    /**
     * Extract all content blocks in document order: paragraphs, display math,
     * theorems, and figures interleaved as they appear in the source.
     */
    private extractContent(nodes: LatexNode[]): ContentBlock[] {
        const content: ContentBlock[] = [];
        let current: string[] = [];

        const flush = () => {
            const text = current.join("").replace(/  +/g, " ").trim();
            if (text.length > 10) {
                content.push(text);
            }
            current = [];
        };

        for (const node of nodes) {
            // Skip structural nodes
            if (node.type === "section" || node.type === "proof") {
                continue;
            }

            // Theorem → flush text, emit inline
            if (node.type === "theorem") {
                flush();
                const thm = this.transformTheorem(node as TheoremNode);
                if (thm) content.push({ theorem: thm });
                continue;
            }

            // Figure → flush text, emit inline
            if (node.type === "figure" && (node as any).filename) {
                flush();
                const fig: PaperFigureData = {
                    filename: (node as any).filename,
                    caption: (node as any).caption
                        ? this.nodesToHtml((node as any).caption)
                        : "",
                    ...((node as any).label && { label: (node as any).label }),
                };
                content.push({ figure: fig });
                continue;
            }

            // Display math → flush text, emit math block with label ID
            if (node.type === "math" && node.display) {
                flush();
                const source = node.rawValue ?? node.value;
                const labelMatch = source.match(/\\label\{([^}]+)\}/);
                let id: string | undefined;
                if (labelMatch) {
                    id = labelMatch[1].replace(/:/g, "-");
                }
                content.push({ tex: node.value, ...(id && { id }) });
                continue;
            }

            if (node.type === "paragraphBreak") {
                flush();
                continue;
            }

            current.push(this.nodeToHtml(node));
        }

        flush();
        return content;
    }

    private transformTheorem(node: TheoremNode): PaperTheoremData | null {
        const validTypes = new Set([
            "theorem", "definition", "lemma", "proposition",
            "corollary", "aside", "example",
        ]);

        if (!validTypes.has(node.envType)) return null;

        // Separate display math and proof from body
        const bodyParts: string[] = [];
        const mathBlocks: string[] = [];

        for (const child of node.body) {
            if (child.type === "math" && child.display) {
                mathBlocks.push(child.value);
            } else if (child.type === "proof") {
                // Skip proofs in theorem body
            } else {
                bodyParts.push(this.nodeToHtml(child));
            }
        }

        const body = bodyParts.join("").replace(/  +/g, " ").trim();
        if (!body && mathBlocks.length === 0) return null;

        // Find label key in theorem body
        let label: string | undefined;
        for (const child of node.body) {
            if (child.type === "label") {
                label = child.key;
                break;
            }
        }

        // Look up theorem number from label registry
        const number = label ? this.labels.resolve(label)?.number : undefined;

        return {
            type: node.envType as PaperTheoremData["type"],
            ...(node.name && { name: this.nodesToHtml(node.name) }),
            ...(number && { number }),
            body,
            ...(mathBlocks.length > 0 && { math: mathBlocks }),
            ...(label && { label }),
        };
    }

    /** Convert a single AST node to HTML string. */
    nodeToHtml(node: LatexNode): string {
        switch (node.type) {
            case "text":
                // Text nodes from braceBalanced() may contain raw LaTeX.
                // cleanRawLatex handles accents, dashes, quotes, symbols, etc.
                return cleanRawLatex(node.value, (key) =>
                    this.labels.resolve(key)?.number,
                );

            case "math":
                if (node.display) {
                    return ""; // Display math extracted separately
                }
                return `$${node.value}$`;

            case "command":
                return this.commandToHtml(node);

            case "section":
                return ""; // Sections are structural, not inline

            case "theorem":
            case "figure":
            case "proof":
                return ""; // Extracted separately

            case "quote":
                return `<blockquote class="paper-quote">${this.nodesToHtml(node.body)}</blockquote>`;

            case "list":
                return this.listToHtml(node);

            case "description":
                return this.descriptionToHtml(node);

            case "environment":
                return this.nodesToHtml(node.body);

            case "group":
                return this.nodesToHtml(node.body);

            case "label":
                return ""; // Labels don't render

            case "comment":
                return "";

            case "paragraphBreak":
                return ""; // Handled by paragraph extraction

            default:
                return "";
        }
    }

    private commandToHtml(node: CommandNode): string {
        const arg = (i: number) =>
            node.args[i] ? this.nodesToHtml(node.args[i]) : "";

        switch (node.name) {
            case "textit":
            case "emph":
            case "mathit":
                return `<em>${arg(0)}</em>`;
            case "textbf":
            case "mathbf":
                return `<strong>${arg(0)}</strong>`;
            case "texttt":
                return `<code class="paper-code">${arg(0)}</code>`;
            case "text":
            case "mathrm":
                return arg(0);
            case "underline":
                return `<u>${arg(0)}</u>`;
            case "paragraph":
                return `<strong>${arg(0)}</strong> `;
            case "url": {
                const url = arg(0);
                return `<a href="${url}" target="_blank" rel="noopener" class="text-primary hover:underline">${url}</a>`;
            }
            case "href":
                return `<a href="${arg(0)}" target="_blank" rel="noopener" class="text-primary hover:underline">${arg(1)}</a>`;
            case "cite": {
                const keys = arg(0).trim().split(/\s*,\s*/);
                const parts = keys
                    .map((k) => {
                        const entry = this.bibEntries.get(k);
                        return entry ? `${entry.shortAuthor}, ${entry.year}` : null;
                    })
                    .filter(Boolean);
                return parts.length > 0
                    ? `<cite class="paper-cite">[${parts.join("; ")}]</cite>`
                    : "";
            }
            case "ref": {
                const refKey = arg(0).trim();
                const refInfo = this.labels.resolve(refKey);
                if (!refInfo) return "";
                return `<a class="paper-ref" data-ref="${refKey}">${refInfo.number}</a>`;
            }
            case "eqref": {
                const eqKey = arg(0).trim();
                const eqInfo = this.labels.resolve(eqKey);
                if (!eqInfo) return "";
                return `<a class="paper-ref" data-ref="${eqKey}">(${eqInfo.number})</a>`;
            }
            case "hyperref": {
                // \hyperref[key]{text} — parser puts key in optArgs[0], text in args[0]
                const hKey = node.optArgs?.[0]
                    ? this.nodesToHtml(node.optArgs[0]).trim()
                    : "";
                const hText = arg(0);
                if (hKey) {
                    return `<a class="paper-ref" data-ref="${hKey}">${hText}</a>`;
                }
                return hText;
            }
            case "footnote":
                return `<span class="paper-footnote">(${arg(0)})</span>`;
            case "item":
                return ""; // Handled by list extraction
            case "includegraphics":
            case "caption":
                return ""; // Handled by figure extraction
            default:
                // Unknown command: try to render first arg
                return node.args.length > 0 ? arg(0) : "";
        }
    }

    private listToHtml(node: ListNode): string {
        const tag = node.ordered ? "ol" : "ul";
        const items = node.items
            .map((item) => `<li>${this.nodesToHtml(item)}</li>`)
            .join("");
        return `<${tag} class="paper-list">${items}</${tag}>`;
    }

    private descriptionToHtml(node: DescriptionNode): string {
        let html = '<dl class="paper-description">';
        for (const item of node.items) {
            html += `<dt>${this.nodesToHtml(item.term)}</dt>`;
            html += `<dd>${this.nodesToHtml(item.body)}</dd>`;
        }
        html += "</dl>";
        return html;
    }

    /** Convert an array of nodes to HTML. */
    nodesToHtml(nodes: LatexNode[]): string {
        return nodes
            .map((n) => this.nodeToHtml(n))
            .join("")
            .replace(/  +/g, " ")
            .trim();
    }
}

/** Result of transformDocument including label map for cross-references. */
export interface TransformResult {
    sections: PaperSectionData[];
    labelMap: Record<string, PaperLabelInfo>;
}

/**
 * Full pipeline: parse LaTeX AST → PaperSectionData[] + label map.
 */
export function transformDocument(
    nodes: LatexNode[],
    options?: TransformOptions,
): TransformResult {
    const transformer = new Transformer(options);
    const sections = transformer.transform(nodes);
    return { sections, labelMap: transformer.labelMap };
}
