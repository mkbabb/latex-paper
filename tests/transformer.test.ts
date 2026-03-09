import { describe, it, expect } from "vitest";
import { Transformer, transformDocument } from "../src/transform/html";
import { parseLatex } from "../src/grammar/document";
import { parseBibToMap } from "../src/bibtex/parser";
import type { LatexNode } from "../src/types/ast";

describe("Transformer", () => {
    it("renders text nodes as-is", () => {
        const t = new Transformer();
        const html = t.nodeToHtml({ type: "text", value: "hello" });
        expect(html).toBe("hello");
    });

    it("renders inline math with delimiters", () => {
        const t = new Transformer();
        const html = t.nodeToHtml({
            type: "math",
            value: "x^2",
            display: false,
        });
        expect(html).toBe("$x^2$");
    });

    it("renders textbf as strong", () => {
        const t = new Transformer();
        const html = t.nodeToHtml({
            type: "command",
            name: "textbf",
            args: [[{ type: "text", value: "bold" }]],
        });
        expect(html).toBe("<strong>bold</strong>");
    });

    it("renders emph as em", () => {
        const t = new Transformer();
        const html = t.nodeToHtml({
            type: "command",
            name: "emph",
            args: [[{ type: "text", value: "italic" }]],
        });
        expect(html).toBe("<em>italic</em>");
    });

    it("renders texttt as code", () => {
        const t = new Transformer();
        const html = t.nodeToHtml({
            type: "command",
            name: "texttt",
            args: [[{ type: "text", value: "code" }]],
        });
        expect(html).toContain("<code");
        expect(html).toContain("code");
    });

    it("renders href as link", () => {
        const t = new Transformer();
        const html = t.nodeToHtml({
            type: "command",
            name: "href",
            args: [
                [{ type: "text", value: "https://example.com" }],
                [{ type: "text", value: "click" }],
            ],
        });
        expect(html).toContain('href="https://example.com"');
        expect(html).toContain("click");
    });

    it("renders cite with bib entries", () => {
        const bibEntries = parseBibToMap(
            `@article{key1,
  author = {John Smith},
  title = {A Paper},
  year = {2020}
}`,
        );

        const t = new Transformer({ bibEntries });
        const html = t.nodeToHtml({
            type: "command",
            name: "cite",
            args: [[{ type: "text", value: "key1" }]],
        });
        expect(html).toContain("Smith");
        expect(html).toContain("2020");
    });

    it("renders list as HTML list", () => {
        const t = new Transformer();
        const html = t.nodeToHtml({
            type: "list",
            ordered: true,
            items: [
                [{ type: "text", value: "First" }],
                [{ type: "text", value: "Second" }],
            ],
        });
        expect(html).toContain("<ol");
        expect(html).toContain("<li>First</li>");
        expect(html).toContain("<li>Second</li>");
    });

    it("renders quote as blockquote", () => {
        const t = new Transformer();
        const html = t.nodeToHtml({
            type: "quote",
            body: [{ type: "text", value: "A wise saying." }],
        });
        expect(html).toContain("<blockquote");
        expect(html).toContain("A wise saying.");
    });

    it("renders paragraph command as strong", () => {
        const t = new Transformer();
        const html = t.nodeToHtml({
            type: "command",
            name: "paragraph",
            args: [[{ type: "text", value: "Title" }]],
        });
        expect(html).toContain("<strong>Title</strong>");
    });
});

describe("transformDocument", () => {
    it("transforms a simple document into sections", () => {
        const ast = parseLatex(
            "\\begin{document}\n\\chapter{Intro}\nHello world paragraph text here.\n\\end{document}",
        );
        const { sections } = transformDocument(ast);
        expect(sections.length).toBeGreaterThanOrEqual(1);
        expect(sections[0].title).toBe("Intro");
    });

    it("nests sections within chapters", () => {
        const ast = parseLatex(
            "\\begin{document}\n\\chapter{Ch1}\n\\section{Sec1}\nContent.\n\\end{document}",
        );
        const { sections } = transformDocument(ast);
        expect(sections.length).toBe(1);
        expect(sections[0].subsections).toBeDefined();
        expect(sections[0].subsections!.length).toBe(1);
    });

    it("extracts theorems from sections", () => {
        const ast = parseLatex(
            "\\begin{document}\n\\chapter{Ch}\n\\begin{theorem}\nA theorem statement here.\n\\end{theorem}\n\\end{document}",
        );
        const { sections } = transformDocument(ast);
        expect(sections[0].theorems).toBeDefined();
        expect(sections[0].theorems!.length).toBe(1);
    });

    it("applies callouts", () => {
        const ast = parseLatex(
            "\\begin{document}\n\\chapter{Applications}\nSome text about apps.\n\\end{document}",
        );
        const { sections } = transformDocument(ast, {
            callouts: {
                applications: {
                    text: "Try it!",
                    link: "/app",
                },
            },
        });
        expect(sections[0].callout).toEqual({
            text: "Try it!",
            link: "/app",
        });
    });
});
