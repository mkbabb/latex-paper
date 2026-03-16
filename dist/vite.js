import {
  Transformer
} from "./chunk-A7GY23HR.js";
import {
  createCompiledPaperMetadata,
  flattenPaperSections,
  parseBibToMap,
  parseLatex,
  parseLatexLogTotalPages,
  parseLatexTocEntries
} from "./chunk-5VAEDP55.js";

// src/vite.ts
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
function buildPageMapFromTocEntries(sections, tocEntries, warn) {
  const flatSections = flattenPaperSections(sections);
  const pageMap = {};
  const pageByNumber = /* @__PURE__ */ new Map();
  for (const entry of tocEntries) {
    if (entry.number) pageByNumber.set(entry.number, entry.page);
  }
  const trackedSections = flatSections.filter(
    (section) => !section.starred && Boolean(section.section.number) && pageByNumber.has(section.section.number)
  );
  if (trackedSections.length !== tocEntries.length) {
    warn?.(
      `latex-paper: TOC page entry mismatch (tracked=${trackedSections.length}, toc=${tocEntries.length}); carrying forward last known page where needed.`
    );
  }
  let lastPage = tocEntries[0]?.page ?? 1;
  for (let index = 0; index < flatSections.length; index++) {
    const section = flatSections[index];
    const number = section.section.number;
    if (section.starred) {
      pageMap[section.id] = lastPage;
      continue;
    }
    if (!number) {
      const previousPage = lastPage;
      let nextPage = previousPage;
      for (let nextIndex = index + 1; nextIndex < flatSections.length; nextIndex++) {
        const nextNumber = flatSections[nextIndex].section.number;
        if (!nextNumber || flatSections[nextIndex].starred) continue;
        const mappedPage = pageByNumber.get(nextNumber);
        if (mappedPage != null) {
          nextPage = mappedPage;
          break;
        }
      }
      pageMap[section.id] = nextPage > previousPage ? Math.max(previousPage, nextPage - 1) : previousPage;
      continue;
    }
    const page = pageByNumber.get(number);
    if (page != null) {
      lastPage = page;
    }
    pageMap[section.id] = lastPage;
  }
  return pageMap;
}
function extractTexMacros(texSource) {
  const macros = {};
  for (const m of texSource.matchAll(
    /\\DeclareMathOperator\s*\*?\s*\{\\(\w+)\}\s*\{([^}]*)\}/g
  )) {
    macros[`\\${m[1]}`] = `\\operatorname{${m[2]}}`;
  }
  for (const m of texSource.matchAll(
    /\\(?:re)?newcommand\s*\{\\(\w+)\}\s*(?:\[\d+\]\s*)?\{([^}]*)\}/g
  )) {
    if (macros[`\\${m[1]}`] || /#\d/.test(m[2])) continue;
    macros[`\\${m[1]}`] = m[2];
  }
  return macros;
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
      const tocPath = resolvedTexPath.replace(/\.tex$/, ".toc");
      const bblPath = resolvedTexPath.replace(/\.tex$/, ".bbl");
      if (existsSync(logPath)) this.addWatchFile(logPath);
      if (existsSync(auxPath)) this.addWatchFile(auxPath);
      if (existsSync(tocPath)) this.addWatchFile(tocPath);
      if (existsSync(bblPath)) this.addWatchFile(bblPath);
      let bibSource;
      try {
        bibSource = readFileSync(resolvedBibPath, "utf-8");
      } catch {
        bibSource = "";
      }
      const bibEntries = parseBibToMap(bibSource);
      const texSource = readFileSync(resolvedTexPath, "utf-8");
      const texMacros = extractTexMacros(texSource);
      const allMacros = { ...texMacros, ...options.macros };
      const ast = parseLatex(texSource);
      const requiredArtifacts = [logPath, auxPath, tocPath, bblPath].filter(
        (path) => !existsSync(path)
      );
      if (requiredArtifacts.length > 0) {
        throw new Error(
          `latex-paper: missing required compiled artifacts for ${resolvedTexPath}: ${requiredArtifacts.join(", ")}`
        );
      }
      const compiledMetadata = createCompiledPaperMetadata({
        texSource,
        logSource: readFileSync(logPath, "utf-8"),
        auxSource: readFileSync(auxPath, "utf-8"),
        tocSource: readFileSync(tocPath, "utf-8"),
        bblSource: readFileSync(bblPath, "utf-8")
      });
      if (compiledMetadata.tocEntries.length === 0) {
        throw new Error(`latex-paper: ${tocPath} did not contain any TOC entries.`);
      }
      if (compiledMetadata.totalPages <= 0) {
        throw new Error(`latex-paper: ${logPath} did not yield a valid page count.`);
      }
      const transformOpts = {
        macros: options.macros,
        callouts: options.callouts,
        bibEntries,
        compiledMetadata
      };
      const transformer = new Transformer(transformOpts);
      const sections = transformer.transform(ast);
      const labelMap = transformer.labelMap;
      const pageWarnings = [];
      const pageMap = buildPageMapFromTocEntries(
        sections,
        compiledMetadata.tocEntries,
        (message) => pageWarnings.push(message)
      );
      if (pageWarnings.length > 0) {
        throw new Error(pageWarnings.join(" "));
      }
      return [
        `// Auto-generated from ${resolvedTexPath} \u2014 do not edit manually`,
        `export const paperSections = ${JSON.stringify(sections, null, 2)};`,
        `export const labelMap = ${JSON.stringify(labelMap, null, 2)};`,
        `export const totalPages = ${compiledMetadata.totalPages};`,
        `export const pageMap = ${JSON.stringify(pageMap)};`,
        `export const extractedMacros = ${JSON.stringify(allMacros)};`
      ].join("\n");
    },
    handleHotUpdate({ file, server }) {
      const logPath = resolvedTexPath.replace(/\.tex$/, ".log");
      const auxPath = resolvedTexPath.replace(/\.tex$/, ".aux");
      const tocPath = resolvedTexPath.replace(/\.tex$/, ".toc");
      const bblPath = resolvedTexPath.replace(/\.tex$/, ".bbl");
      if (file === resolvedTexPath || file === resolvedBibPath || file === logPath || file === auxPath || file === tocPath || file === bblPath) {
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
  parseLatexTocEntries as parseLatexTocPages,
  parseLatexLogTotalPages as parseTotalPages
};
//# sourceMappingURL=vite.js.map