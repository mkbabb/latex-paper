import {
  ACCENT_MAPS,
  LabelRegistry,
  SYMBOL_MAP,
  astToText
} from "./chunk-DF6BX5MT.js";

// src/transform/html.ts
var DEFAULT_MACROS = {};
function replaceAccents(text) {
  for (const [cmd, map] of Object.entries(ACCENT_MAPS)) {
    if (Object.keys(map).length === 0) continue;
    const escaped = cmd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(
      new RegExp(`\\\\${escaped}\\{([a-zA-Z])\\}`, "g"),
      (_, ch) => map[ch] ?? ch
    );
    text = text.replace(
      new RegExp(`\\\\${escaped}([a-zA-Z])`, "g"),
      (_, ch) => map[ch] ?? ch
    );
  }
  return text;
}
function replaceSymbols(text) {
  const names = Object.keys(SYMBOL_MAP).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(
      new RegExp(`\\\\${escaped}(?![a-zA-Z])`, "g"),
      SYMBOL_MAP[name]
    );
  }
  return text;
}
function cleanRawLatex(text, labelResolver) {
  const parts = text.split(/(\$[^$]*\$)/g);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) continue;
    parts[i] = cleanProseSegment(parts[i], labelResolver);
  }
  return parts.join("").replace(/  +/g, " ");
}
function cleanProseSegment(text, labelResolver) {
  text = replaceAccents(text);
  text = text.replace(/---/g, "\u2014");
  text = text.replace(/--/g, "\u2013");
  text = text.replace(/``/g, "\u201C");
  text = text.replace(/''/g, "\u201D");
  text = replaceSymbols(text);
  const resolveRef = (key) => labelResolver?.(key) ?? "";
  const refLink = (key, display) => `<a class="paper-ref" data-ref="${key}">${display}</a>`;
  text = text.replace(
    /(Chapters?|Sections?|Theorem|Figure|Lemma|Definition|Proposition|Corollary)[~\s]+\\ref\{([^}]*)\}/g,
    (_, prefix, key) => {
      const num = resolveRef(key);
      return num ? refLink(key, `${prefix} ${num}`) : prefix;
    }
  );
  text = text.replace(/\\S\s*\\ref\{([^}]*)\}/g, (_, key) => {
    const num = resolveRef(key);
    return num ? refLink(key, `\xA7${num}`) : "\xA7";
  });
  text = text.replace(/\\eqref\{([^}]*)\}/g, (_, key) => {
    const num = resolveRef(key);
    return num ? refLink(key, `(${num})`) : "";
  });
  text = text.replace(
    /\\hyperref\[([^\]]*)\]\{([^}]*)\}/g,
    (_, key, display) => refLink(key, display)
  );
  text = text.replace(/\\ref\{([^}]*)\}/g, (_, key) => {
    const num = resolveRef(key);
    return num ? refLink(key, num) : "";
  });
  text = text.replace(/\\label\{[^}]*\}/g, "");
  text = text.replace(/~/g, " ");
  text = text.replace(/\\[,;:!]/g, " ");
  text = text.replace(/\\q?quad/g, " ");
  text = text.replace(/\\\\/g, " ");
  text = text.replace(/\\(?:newline|thinspace)(?![a-zA-Z])/g, " ");
  text = text.replace(/\\(?:noindent|hfill|centering)\s*/g, "");
  text = text.replace(/\\(?:medskip|smallskip|bigskip|vfill)\s*/g, "");
  text = text.replace(/\\vspace\*?\{[^}]*\}/g, "");
  text = text.replace(/\\@/g, "");
  text = text.replace(/\\&/g, "&amp;");
  text = text.replace(/\\([#$%_{}])/g, "$1");
  text = text.replace(/[{}]/g, "");
  return text;
}
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
var SUSPICIOUS_PATTERNS = [
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
  { pattern: /(?<![- ])---(?![ -])/, description: "Unprocessed em-dash" }
];
function validateOutput(sections) {
  const issues = [];
  function scanText(text, path) {
    const prose = text.replace(/\$[^$]*\$/g, "");
    for (const { pattern, description } of SUSPICIOUS_PATTERNS) {
      const match = prose.match(pattern);
      if (match) {
        issues.push({
          path,
          text: prose.substring(
            Math.max(0, match.index - 20),
            Math.min(prose.length, match.index + match[0].length + 20)
          ),
          pattern: description,
          match: match[0]
        });
      }
    }
  }
  function scanSection(section, prefix) {
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
var Transformer = class {
  options;
  bibEntries;
  labels;
  /** After transform(), contains label key → location mapping. */
  labelMap = {};
  constructor(options = {}) {
    this.options = options;
    this.bibEntries = options.bibEntries ?? /* @__PURE__ */ new Map();
    this.labels = new LabelRegistry();
  }
  /** Transform a full AST (typically from parseLatex) into sections. */
  transform(nodes) {
    this.labels.collectLabels(nodes);
    let bodyNodes = nodes;
    for (const node of nodes) {
      if (node.type === "environment" && node.name === "document") {
        bodyNodes = node.body;
        break;
      }
    }
    return this.buildSectionHierarchy(bodyNodes);
  }
  buildSectionHierarchy(nodes) {
    const ranges = [];
    const levelMap = { chapter: 0, section: 1, subsection: 2, subsubsection: 3 };
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type === "section") {
        ranges.push({
          level: levelMap[node.level],
          title: cleanRawLatex(
            astToText(node.title),
            (key) => this.labels.resolve(key)?.number
          ),
          startIdx: i + 1,
          endIdx: nodes.length
        });
      }
    }
    for (let i = 0; i < ranges.length - 1; i++) {
      ranges[i].endIdx = ranges[i + 1].startIdx - 1;
    }
    const topLevel = [];
    let chapterNum = 0;
    let sectionNum = 0;
    let subsectionNum = 0;
    let currentChapter = null;
    let currentSection = null;
    const callouts = this.options.callouts ?? {};
    for (const range of ranges) {
      const bodyNodes = nodes.slice(range.startIdx, range.endIdx);
      const id = slugify(range.title);
      const paragraphs = this.extractParagraphs(bodyNodes);
      const theorems = this.extractTheorems(bodyNodes);
      const figures = this.extractFigures(bodyNodes);
      const callout = callouts[id];
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
          ...theorems.length > 0 && { theorems },
          ...figures.length > 0 && { figures },
          subsections: [],
          ...callout && { callout }
        };
        currentSection = null;
        topLevel.push(currentChapter);
      } else if (range.level === 1) {
        if (!currentChapter) {
          chapterNum++;
          sectionNum = 0;
          topLevel.push({
            id,
            number: String(chapterNum),
            title: range.title,
            paragraphs,
            ...theorems.length > 0 && { theorems },
            ...figures.length > 0 && { figures },
            ...callout && { callout }
          });
        } else {
          sectionNum++;
          subsectionNum = 0;
          currentSection = {
            id,
            number: `${chapterNum}.${sectionNum}`,
            title: range.title,
            paragraphs,
            ...theorems.length > 0 && { theorems },
            ...figures.length > 0 && { figures },
            subsections: [],
            ...callout && { callout }
          };
          currentChapter.subsections.push(currentSection);
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
            ...theorems.length > 0 && { theorems },
            ...figures.length > 0 && { figures },
            subsections: [],
            ...callout && { callout }
          };
          currentChapter.subsections.push(currentSection);
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
              ...theorems.length > 0 && { theorems },
              ...figures.length > 0 && { figures },
              ...callout && { callout }
            });
          }
        }
      }
    }
    this.generateSummaries(topLevel);
    this.cleanEmpty(topLevel);
    this.buildLabelMap();
    return topLevel;
  }
  /** Recursively tag labels found in AST nodes with a section ID. */
  tagLabelsInNodes(nodes, sectionId) {
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
  buildLabelMap() {
    for (const [key, info] of this.labels.all()) {
      const elementId = info.type === "section" ? void 0 : key.replace(/:/g, "-");
      this.labelMap[key] = {
        number: info.number,
        type: info.type,
        sectionId: info.sectionId ?? "",
        ...elementId && { elementId }
      };
    }
  }
  /** Generate content summary strings for each section (recursive). */
  generateSummaries(sections) {
    for (const section of sections) {
      let countItems2 = function(s) {
        for (const t of s.theorems ?? []) {
          counts[t.type] = (counts[t.type] ?? 0) + 1;
        }
        for (const sub of s.subsections ?? []) countItems2(sub);
      };
      var countItems = countItems2;
      if (section.subsections) this.generateSummaries(section.subsections);
      const counts = {};
      countItems2(section);
      const parts = Object.entries(counts).map(([type, n]) => `${n} ${type}${n > 1 ? "s" : ""}`).join(", ");
      if (parts) section.summary = parts;
    }
  }
  cleanEmpty(sections) {
    for (const s of sections) {
      if (s.subsections && s.subsections.length === 0) {
        delete s.subsections;
      } else if (s.subsections) {
        this.cleanEmpty(s.subsections);
      }
    }
  }
  /** Extract paragraphs from body nodes (text between theorem/figure/math envs). */
  extractParagraphs(nodes) {
    const paragraphs = [];
    let current = [];
    const flush = () => {
      const text = current.join("").replace(/  +/g, " ").trim();
      if (text.length > 10) {
        paragraphs.push(text);
      }
      current = [];
    };
    for (const node of nodes) {
      if (node.type === "theorem" || node.type === "figure" || node.type === "proof" || node.type === "math" && node.display || node.type === "section") {
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
  extractTheorems(nodes) {
    const theorems = [];
    for (const node of nodes) {
      if (node.type === "theorem") {
        const thm = this.transformTheorem(node);
        if (thm) theorems.push(thm);
      }
    }
    return theorems;
  }
  /** Extract figures from body nodes. */
  extractFigures(nodes) {
    const figures = [];
    for (const node of nodes) {
      if (node.type === "figure" && node.filename) {
        figures.push({
          filename: node.filename,
          caption: node.caption ? this.nodesToHtml(node.caption) : "",
          ...node.label && { label: node.label }
        });
      }
    }
    return figures;
  }
  transformTheorem(node) {
    const validTypes = /* @__PURE__ */ new Set([
      "theorem",
      "definition",
      "lemma",
      "proposition",
      "corollary",
      "aside",
      "example"
    ]);
    if (!validTypes.has(node.envType)) return null;
    const bodyParts = [];
    const mathBlocks = [];
    for (const child of node.body) {
      if (child.type === "math" && child.display) {
        mathBlocks.push(child.value);
      } else if (child.type === "proof") {
      } else {
        bodyParts.push(this.nodeToHtml(child));
      }
    }
    const body = bodyParts.join("").replace(/  +/g, " ").trim();
    if (!body && mathBlocks.length === 0) return null;
    let label;
    for (const child of node.body) {
      if (child.type === "label") {
        label = child.key;
        break;
      }
    }
    const number = label ? this.labels.resolve(label)?.number : void 0;
    return {
      type: node.envType,
      ...node.name && { name: this.nodesToHtml(node.name) },
      ...number && { number },
      body,
      ...mathBlocks.length > 0 && { math: mathBlocks },
      ...label && { label }
    };
  }
  /** Convert a single AST node to HTML string. */
  nodeToHtml(node) {
    switch (node.type) {
      case "text":
        return cleanRawLatex(
          node.value,
          (key) => this.labels.resolve(key)?.number
        );
      case "math":
        if (node.display) {
          return "";
        }
        return `$${node.value}$`;
      case "command":
        return this.commandToHtml(node);
      case "section":
        return "";
      // Sections are structural, not inline
      case "theorem":
      case "figure":
      case "proof":
        return "";
      // Extracted separately
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
        return "";
      // Labels don't render
      case "comment":
        return "";
      case "paragraphBreak":
        return "";
      // Handled by paragraph extraction
      default:
        return "";
    }
  }
  commandToHtml(node) {
    const arg = (i) => node.args[i] ? this.nodesToHtml(node.args[i]) : "";
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
        const parts = keys.map((k) => {
          const entry = this.bibEntries.get(k);
          return entry ? `${entry.shortAuthor}, ${entry.year}` : null;
        }).filter(Boolean);
        return parts.length > 0 ? `<cite class="paper-cite">[${parts.join("; ")}]</cite>` : "";
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
        const hKey = node.optArgs?.[0] ? this.nodesToHtml(node.optArgs[0]).trim() : "";
        const hText = arg(0);
        if (hKey) {
          return `<a class="paper-ref" data-ref="${hKey}">${hText}</a>`;
        }
        return hText;
      }
      case "footnote":
        return `<span class="paper-footnote">(${arg(0)})</span>`;
      case "item":
        return "";
      // Handled by list extraction
      case "includegraphics":
      case "caption":
        return "";
      // Handled by figure extraction
      default:
        return node.args.length > 0 ? arg(0) : "";
    }
  }
  listToHtml(node) {
    const tag = node.ordered ? "ol" : "ul";
    const items = node.items.map((item) => `<li>${this.nodesToHtml(item)}</li>`).join("");
    return `<${tag} class="paper-list">${items}</${tag}>`;
  }
  descriptionToHtml(node) {
    let html = '<dl class="paper-description">';
    for (const item of node.items) {
      html += `<dt>${this.nodesToHtml(item.term)}</dt>`;
      html += `<dd>${this.nodesToHtml(item.body)}</dd>`;
    }
    html += "</dl>";
    return html;
  }
  /** Convert an array of nodes to HTML. */
  nodesToHtml(nodes) {
    return nodes.map((n) => this.nodeToHtml(n)).join("").replace(/  +/g, " ").trim();
  }
};
function transformDocument(nodes, options) {
  const transformer = new Transformer(options);
  const sections = transformer.transform(nodes);
  return { sections, labelMap: transformer.labelMap };
}

export {
  DEFAULT_MACROS,
  cleanRawLatex,
  validateOutput,
  Transformer,
  transformDocument
};
//# sourceMappingURL=chunk-QVXCDP6U.js.map