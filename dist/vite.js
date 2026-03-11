import {
  Transformer
} from "./chunk-C32DNXCE.js";
import {
  flattenPaperSections,
  parseBibToMap,
  parseLatex
} from "./chunk-H5ZLAB63.js";

// src/vite.ts
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
function parseTotalPages(logSource) {
  const m = logSource.match(/Output written on .+\((\d+) pages/);
  return m ? parseInt(m[1], 10) : null;
}
function parseLatexTocPages(auxSource) {
  const entries = [];
  for (const line of auxSource.split(/\r?\n/)) {
    const match = line.match(
      /\\contentsline\s*\{(chapter|section|subsection)\}\{.*\}\{(\d+)\}\{/
    );
    if (!match) continue;
    entries.push({
      type: match[1],
      page: parseInt(match[2], 10)
    });
  }
  return entries;
}
function buildPageMapFromTocEntries(sections, tocEntries, warn) {
  const flatSections = flattenPaperSections(sections);
  const pageMap = {};
  let lastPage = tocEntries[0]?.page ?? 1;
  let tocIndex = 0;
  const trackedSections = flatSections.filter(
    (section) => section.sourceLevel <= 2 && !section.starred
  );
  if (trackedSections.length !== tocEntries.length) {
    warn?.(
      `latex-paper: TOC page entry mismatch (tracked=${trackedSections.length}, toc=${tocEntries.length}); using ordered fallback pages where needed.`
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
function latexPaperPlugin(options) {
  const virtualId = options.virtualModuleId ?? "virtual:paper-content";
  const resolvedVirtualId = "\0" + virtualId;
  let resolvedTexPath;
  let resolvedBibPath;
  return {
    name: "vite-plugin-latex-paper",
    configResolved(config) {
      resolvedTexPath = resolve(config.root, options.texPath);
      resolvedBibPath = options.bibPath ? resolve(config.root, options.bibPath) : resolvedTexPath.replace(/\.tex$/, ".bib");
    },
    resolveId(id) {
      if (id === virtualId) return resolvedVirtualId;
    },
    load(id) {
      if (id !== resolvedVirtualId) return;
      this.addWatchFile(resolvedTexPath);
      this.addWatchFile(resolvedBibPath);
      const logPath = resolvedTexPath.replace(/\.tex$/, ".log");
      const auxPath = resolvedTexPath.replace(/\.tex$/, ".aux");
      if (existsSync(logPath)) this.addWatchFile(logPath);
      if (existsSync(auxPath)) this.addWatchFile(auxPath);
      let bibSource;
      try {
        bibSource = readFileSync(resolvedBibPath, "utf-8");
      } catch {
        bibSource = "";
      }
      const bibEntries = parseBibToMap(bibSource);
      const texSource = readFileSync(resolvedTexPath, "utf-8");
      const ast = parseLatex(texSource);
      const transformOpts = {
        macros: options.macros,
        callouts: options.callouts,
        bibEntries
      };
      const transformer = new Transformer(transformOpts);
      const sections = transformer.transform(ast);
      const labelMap = transformer.labelMap;
      let totalPages = 0;
      let pageMap = {};
      try {
        const logSource = readFileSync(logPath, "utf-8");
        totalPages = parseTotalPages(logSource) ?? 0;
      } catch {
      }
      try {
        const auxSource = readFileSync(auxPath, "utf-8");
        const tocEntries = parseLatexTocPages(auxSource);
        pageMap = buildPageMapFromTocEntries(
          sections,
          tocEntries,
          (message) => this.warn(message)
        );
      } catch {
      }
      return [
        `// Auto-generated from ${resolvedTexPath} \u2014 do not edit manually`,
        `export const paperSections = ${JSON.stringify(sections, null, 2)};`,
        `export const labelMap = ${JSON.stringify(labelMap, null, 2)};`,
        `export const totalPages = ${totalPages};`,
        `export const pageMap = ${JSON.stringify(pageMap)};`
      ].join("\n");
    },
    handleHotUpdate({ file, server }) {
      const logPath = resolvedTexPath.replace(/\.tex$/, ".log");
      const auxPath = resolvedTexPath.replace(/\.tex$/, ".aux");
      if (file === resolvedTexPath || file === resolvedBibPath || file === logPath || file === auxPath) {
        const mod = server.moduleGraph.getModuleById(resolvedVirtualId);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
          return [mod];
        }
      }
    }
  };
}
export {
  buildPageMapFromTocEntries,
  latexPaperPlugin as default,
  parseLatexTocPages
};
//# sourceMappingURL=vite.js.map