import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseLatex } from "../src/grammar/document";
import { transformDocument } from "../src/transform/html";
import { parseBibToMap } from "../src/bibtex/parser";
import type { LatexNode } from "../src/types/ast";
import type { PaperSectionData } from "../src/types/output";

const fixturesDir = resolve(import.meta.dirname, "fixtures");

function loadFixture(name: string): string {
    return readFileSync(resolve(fixturesDir, name), "utf-8");
}

/** Recursively collect all nodes of a given type from the AST. */
function collectNodes(nodes: LatexNode[], type: string): LatexNode[] {
    const result: LatexNode[] = [];
    for (const node of nodes) {
        if (node.type === type) result.push(node);
        // Recurse into children
        if ("body" in node && Array.isArray(node.body)) {
            result.push(...collectNodes(node.body, type));
        }
        if ("items" in node && Array.isArray(node.items)) {
            for (const item of node.items) {
                if (Array.isArray(item)) {
                    result.push(...collectNodes(item, type));
                }
            }
        }
        if ("title" in node && Array.isArray(node.title)) {
            result.push(...collectNodes(node.title, type));
        }
    }
    return result;
}

describe("integration: fixtures → PaperSectionData", () => {
    it("parses minimal.tex", () => {
        const ast = parseLatex(loadFixture("minimal.tex"));
        expect(ast.length).toBeGreaterThan(0);
    });

    it("parses sections.tex into hierarchy", () => {
        const ast = parseLatex(loadFixture("sections.tex"));
        const { sections } = transformDocument(ast);
        expect(sections.length).toBe(2); // 2 chapters
        expect(sections[0].title).toBe("First Chapter");
        expect(sections[0].subsections).toBeDefined();
        expect(sections[1].title).toBe("Second Chapter");
    });

    it("parses theorems.tex", () => {
        const ast = parseLatex(loadFixture("theorems.tex"));
        const { sections } = transformDocument(ast);
        // Chapter "Theorems" should have theorem data
        const ch = sections[0];
        expect(ch.theorems).toBeDefined();
        expect(ch.theorems!.length).toBeGreaterThanOrEqual(2);
        // Check theorem types
        const types = ch.theorems!.map((t) => t.type);
        expect(types).toContain("theorem");
        expect(types).toContain("definition");
    });

    it("parses math-envs.tex", () => {
        const ast = parseLatex(loadFixture("math-envs.tex"));
        const allMath = collectNodes(ast, "math") as any[];
        const inlineMath = allMath.filter((n) => !n.display);
        const displayMath = allMath.filter((n) => n.display);
        expect(inlineMath.length).toBeGreaterThanOrEqual(1);
        expect(displayMath.length).toBeGreaterThanOrEqual(2);
    });

    it("parses lists.tex", () => {
        const ast = parseLatex(loadFixture("lists.tex"));
        const lists = collectNodes(ast, "list");
        expect(lists.length).toBe(2); // enumerate + itemize

        const descriptions = collectNodes(ast, "description");
        expect(descriptions.length).toBe(1);
    });

    it("parses figures.tex", () => {
        const ast = parseLatex(loadFixture("figures.tex"));
        const figures = collectNodes(ast, "figure");
        expect(figures.length).toBe(1);
        if (figures[0].type === "figure") {
            expect(figures[0].filename).toBe("fourier_series.png");
            expect(figures[0].label).toBe("fig:fourier");
        }
    });

    it("resolves citations with bib data", () => {
        const bibSource = loadFixture("sample.bib");
        const bibEntries = parseBibToMap(bibSource);
        const ast = parseLatex(
            "\\begin{document}\n\\chapter{Ch}\nAs shown by \\cite{fourier1822}, heat conducts.\n\\end{document}",
        );
        const { sections } = transformDocument(ast, { bibEntries });
        // The paragraph should contain the citation
        const allText = sections[0].paragraphs.join(" ");
        expect(allText).toContain("Fourier");
        expect(allText).toContain("1822");
    });
});
