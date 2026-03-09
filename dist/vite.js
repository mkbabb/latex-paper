import {
  Transformer
} from "./chunk-RDKNT5AC.js";
import {
  parseBibToMap,
  parseLatex
} from "./chunk-O3YJJZOY.js";

// src/vite.ts
import { readFileSync } from "fs";
import { resolve } from "path";
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
      return [
        `// Auto-generated from ${resolvedTexPath} \u2014 do not edit manually`,
        `export const paperSections = ${JSON.stringify(sections, null, 2)};`,
        `export const labelMap = ${JSON.stringify(labelMap, null, 2)};`
      ].join("\n");
    },
    handleHotUpdate({ file, server }) {
      if (file === resolvedTexPath || file === resolvedBibPath) {
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
  latexPaperPlugin as default
};
//# sourceMappingURL=vite.js.map