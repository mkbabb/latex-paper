/**
 * AST → HTML transformer with configurable macros and callouts.
 *
 * Text nodes from braceBalanced() contain raw LaTeX (accents, dashes,
 * nested commands, etc.). cleanRawLatex() processes these patterns,
 * mirroring the old regex-based parser's cleanProseSegment().
 */

import type {
    LatexNode,
    SectionNode,
    TheoremNode,
    ListNode,
    DescriptionNode,
    FigureNode,
    ProofNode,
    QuoteNode,
    MathNode,
    CommandNode,
} from "../types/ast";
import type {
    PaperSectionData,
    PaperTheoremData,
    PaperFigureData,
    PaperLabelInfo,
} from "../types/output";
import type { BibEntry } from "../types/bibtex";
import { ACCENT_MAPS, SYMBOL_MAP } from "../utils/accents";
import { LabelRegistry } from "./labels";
import { astToText } from "../grammar/document";

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

// ── Raw LaTeX text cleanup ──────────────────────────────────────────

/**
 * Apply accent command replacements to raw text.
 * Handles braced (\"{a}) and unbraced (\"a) forms.
 */
function replaceAccents(text: string): string {
    for (const [cmd, map] of Object.entries(ACCENT_MAPS)) {
        if (Object.keys(map).length === 0) continue;
        const escaped = cmd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Braced form: \cmd{char}
        text = text.replace(
            new RegExp(`\\\\${escaped}\\{([a-zA-Z])\\}`, "g"),
            (_, ch: string) => map[ch] ?? ch,
        );
        // Unbraced form: \cmd char
        text = text.replace(
            new RegExp(`\\\\${escaped}([a-zA-Z])`, "g"),
            (_, ch: string) => map[ch] ?? ch,
        );
    }
    return text;
}

/**
 * Replace symbol commands (\infty, \implies, etc.) in raw text.
 */
function replaceSymbols(text: string): string {
    // Sort by length descending to match longest first
    const names = Object.keys(SYMBOL_MAP).sort((a, b) => b.length - a.length);
    for (const name of names) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        text = text.replace(
            new RegExp(`\\\\${escaped}(?![a-zA-Z])`, "g"),
            SYMBOL_MAP[name],
        );
    }
    return text;
}

/**
 * Clean residual LaTeX patterns from text node content.
 *
 * With braceContent() parsing command arguments through the inline parser,
 * most LaTeX (accents, dashes, quotes, formatting, refs) is properly handled
 * in the AST. This function catches residual patterns that may appear in
 * text nodes from opaque sources (e.g. braceBalanced() for keys/filenames)
 * or edge cases the parser doesn't cover.
 *
 * Math segments ($...$) are preserved verbatim.
 *
 * @param labelResolver Optional function to resolve \ref{key} → number string.
 */
export function cleanRawLatex(
    text: string,
    labelResolver?: (key: string) => string | undefined,
): string {
    // Split on $...$ boundaries. Odd-indexed segments are math.
    const parts = text.split(/(\$[^$]*\$)/g);
    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 1) continue; // skip math segments
        parts[i] = cleanProseSegment(parts[i], labelResolver);
    }
    return parts.join("").replace(/  +/g, " ");
}

/**
 * Clean residual LaTeX patterns from a prose (non-math) text segment.
 *
 * Most patterns are now handled by the combinator parser (braceContent).
 * This only processes patterns that may still appear in text nodes:
 * - Escaped specials (\&, \#, etc.) from the plainText parser
 * - Residual braces from brace-balanced content
 * - Tilde → space (if not caught by tilde parser)
 * - Spacing commands that might appear in raw text
 */
function cleanProseSegment(
    text: string,
    labelResolver?: (key: string) => string | undefined,
): string {
    // Accents → Unicode (fallback for any unprocessed accents)
    text = replaceAccents(text);

    // Dashes (fallback — parser handles these, but raw text may still have them)
    text = text.replace(/---/g, "\u2014");
    text = text.replace(/--/g, "\u2013");

    // Smart quotes (fallback)
    text = text.replace(/``/g, "\u201C");
    text = text.replace(/''/g, "\u201D");

    // Symbols → Unicode (fallback)
    text = replaceSymbols(text);

    // Refs: resolve \ref{key} via label registry, producing clickable links
    const resolveRef = (key: string) => labelResolver?.(key) ?? "";
    const refLink = (key: string, display: string) =>
        `<a class="paper-ref" data-ref="${key}">${display}</a>`;

    text = text.replace(
        /(Chapters?|Sections?|Theorem|Figure|Lemma|Definition|Proposition|Corollary)[~\s]+\\ref\{([^}]*)\}/g,
        (_, prefix: string, key: string) => {
            const num = resolveRef(key);
            return num ? refLink(key, `${prefix} ${num}`) : prefix;
        },
    );
    text = text.replace(/\\S\s*\\ref\{([^}]*)\}/g, (_, key: string) => {
        const num = resolveRef(key);
        return num ? refLink(key, `\u00a7${num}`) : "\u00a7";
    });
    text = text.replace(/\\eqref\{([^}]*)\}/g, (_, key: string) => {
        const num = resolveRef(key);
        return num ? refLink(key, `(${num})`) : "";
    });
    text = text.replace(
        /\\hyperref\[([^\]]*)\]\{([^}]*)\}/g,
        (_, key: string, display: string) => refLink(key, display),
    );
    text = text.replace(/\\ref\{([^}]*)\}/g, (_, key: string) => {
        const num = resolveRef(key);
        return num ? refLink(key, num) : "";
    });
    text = text.replace(/\\label\{[^}]*\}/g, "");

    // Tilde → non-breaking space
    text = text.replace(/~/g, " ");

    // Spacing commands → space
    text = text.replace(/\\[,;:!]/g, " ");
    text = text.replace(/\\q?quad/g, " ");
    text = text.replace(/\\\\/g, " ");
    text = text.replace(/\\(?:newline|thinspace)(?![a-zA-Z])/g, " ");

    // Skip/strip commands
    text = text.replace(/\\(?:noindent|hfill|centering)\s*/g, "");
    text = text.replace(/\\(?:medskip|smallskip|bigskip|vfill)\s*/g, "");
    text = text.replace(/\\vspace\*?\{[^}]*\}/g, "");

    // Escaped specials
    text = text.replace(/\\@/g, "");
    text = text.replace(/\\&/g, "&amp;");
    text = text.replace(/\\([#$%_{}])/g, "$1");

    // Strip remaining braces (after all command processing)
    text = text.replace(/[{}]/g, "");

    return text;
}

/** Slugify a string for HTML id generation. */
function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

// ── Validation ──────────────────────────────────────────────────────

/** Patterns that indicate unprocessed LaTeX in output. */
const SUSPICIOUS_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
    { pattern: /\\['"` ^~]\{[a-zA-Z]\}/, description: "Unprocessed braced accent" },
    { pattern: /\\['"` ^~][a-zA-Z]/, description: "Unprocessed unbraced accent" },
    { pattern: /\\c\{[a-zA-Z]\}/, description: "Unprocessed cedilla" },
    { pattern: /\\text(?:it|bf|tt)\{/, description: "Unprocessed formatting command" },
    { pattern: /\\emph\{/, description: "Unprocessed \\emph" },
    { pattern: /\\(?:section|chapter|subsection)\*?\{/, description: "Unprocessed sectioning command" },
    { pattern: /\\begin\{/, description: "Unprocessed \\begin" },
    { pattern: /\\end\{/, description: "Unprocessed \\end" },
    { pattern: /(?<!\$[^$]*)\\(?:implies|iff|infty|ldots|cdots|dots|Rightarrow|Leftarrow|rightarrow|leftrightarrow)(?![a-zA-Z])(?![^$]*\$)/, description: "Unprocessed symbol command in prose" },
    { pattern: /``/, description: "Unprocessed left double quote" },
    { pattern: /''/, description: "Unprocessed right double quote" },
    { pattern: /(?<![- ])---(?![ -])/, description: "Unprocessed em-dash" },
];

export interface ValidationIssue {
    path: string;
    text: string;
    pattern: string;
    match: string;
}

/**
 * Scan transformed output for suspicious unprocessed LaTeX patterns.
 * Returns a list of issues found.
 */
export function validateOutput(sections: PaperSectionData[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    function scanText(text: string, path: string): void {
        // Strip math segments ($...$) before scanning — LaTeX inside math is valid
        const prose = text.replace(/\$[^$]*\$/g, "");
        for (const { pattern, description } of SUSPICIOUS_PATTERNS) {
            const match = prose.match(pattern);
            if (match) {
                issues.push({
                    path,
                    text: prose.substring(
                        Math.max(0, match.index! - 20),
                        Math.min(prose.length, match.index! + match[0].length + 20),
                    ),
                    pattern: description,
                    match: match[0],
                });
            }
        }
    }

    function scanSection(section: PaperSectionData, prefix: string): void {
        const path = `${prefix}/${section.id}`;
        scanText(section.title, `${path}/title`);
        for (let i = 0; i < section.paragraphs.length; i++) {
            scanText(section.paragraphs[i], `${path}/paragraph[${i}]`);
        }
        if (section.theorems) {
            for (let i = 0; i < section.theorems.length; i++) {
                const thm = section.theorems[i];
                if (thm.name) scanText(thm.name, `${path}/theorem[${i}]/name`);
                scanText(thm.body, `${path}/theorem[${i}]/body`);
            }
        }
        if (section.figures) {
            for (let i = 0; i < section.figures.length; i++) {
                scanText(section.figures[i].caption, `${path}/figure[${i}]/caption`);
            }
        }
        if (section.subsections) {
            for (const sub of section.subsections) {
                scanSection(sub, path);
            }
        }
    }

    for (const section of sections) {
        scanSection(section, "");
    }

    return issues;
}

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
            const paragraphs = this.extractParagraphs(bodyNodes);
            const theorems = this.extractTheorems(bodyNodes);
            const figures = this.extractFigures(bodyNodes);
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
                    paragraphs,
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
                        paragraphs,
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
                        paragraphs,
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
                        paragraphs,
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
                            paragraphs,
                            ...(theorems.length > 0 && { theorems }),
                            ...(figures.length > 0 && { figures }),
                            ...(callout && { callout }),
                        });
                    }
                }
            }
        }

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
                // Check for \label{...} in math content
                const m = node.value.match(/\\label\{([^}]+)\}/);
                if (m) {
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
            this.labelMap[key] = {
                number: info.number,
                type: info.type,
                sectionId: info.sectionId ?? "",
            };
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

    /** Extract paragraphs from body nodes (text between theorem/figure/math envs). */
    private extractParagraphs(nodes: LatexNode[]): string[] {
        const paragraphs: string[] = [];
        let current: string[] = [];

        const flush = () => {
            const text = current.join("").replace(/  +/g, " ").trim();
            if (text.length > 10) {
                paragraphs.push(text);
            }
            current = [];
        };

        for (const node of nodes) {
            // Skip nodes that are extracted separately
            if (
                node.type === "theorem" ||
                node.type === "figure" ||
                node.type === "proof" ||
                (node.type === "math" && node.display) ||
                node.type === "section"
            ) {
                continue;
            }

            if (node.type === "paragraphBreak") {
                flush();
                continue;
            }

            current.push(this.nodeToHtml(node));
        }

        flush();
        return paragraphs;
    }

    /** Extract theorems from body nodes. */
    private extractTheorems(nodes: LatexNode[]): PaperTheoremData[] {
        const theorems: PaperTheoremData[] = [];

        for (const node of nodes) {
            if (node.type === "theorem") {
                const thm = this.transformTheorem(node);
                if (thm) theorems.push(thm);
            }
        }

        return theorems;
    }

    /** Extract figures from body nodes. */
    private extractFigures(nodes: LatexNode[]): PaperFigureData[] {
        const figures: PaperFigureData[] = [];

        for (const node of nodes) {
            if (node.type === "figure" && node.filename) {
                figures.push({
                    filename: node.filename,
                    caption: node.caption
                        ? this.nodesToHtml(node.caption)
                        : "",
                    ...(node.label && { label: node.label }),
                });
            }
        }

        return figures;
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

        return {
            type: node.envType as PaperTheoremData["type"],
            ...(node.name && { name: this.nodesToHtml(node.name) }),
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
                // \hyperref[key]{text} — the key is in arg(0), text in arg(1)
                // But our parser may put the optional arg differently
                const hKey = node.args[0] ? arg(0).trim() : "";
                const hText = node.args[1] ? arg(1) : arg(0);
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
