// src/grammar/document.ts
import { regex as regex6, any as any4, ParserState as ParserState2 } from "@mkbabb/parse-that";

// src/grammar/primitives.ts
import { Parser, regex } from "@mkbabb/parse-that";
var _inlineNode = null;
function setInlineNode(p) {
  _inlineNode = p;
}
function getInlineNode() {
  if (!_inlineNode) throw new Error("inlineNode not registered yet");
  return _inlineNode;
}
var lazyInlineNode = Parser.lazy(
  () => getInlineNode()
);
var ws = regex(/\s*/);
var ws1 = regex(/\s+/);
function braceBalanced() {
  return new Parser((state) => {
    if (state.src[state.offset] !== "{") {
      state.isError = true;
      return state;
    }
    let depth = 1;
    let i = state.offset + 1;
    while (i < state.src.length && depth > 0) {
      if (state.src[i] === "{") depth++;
      else if (state.src[i] === "}") depth--;
      i++;
    }
    if (depth !== 0) {
      state.isError = true;
      return state;
    }
    state.value = state.src.slice(state.offset + 1, i - 1);
    state.offset = i;
    state.isError = false;
    return state;
  });
}
function braceContent() {
  return new Parser((state) => {
    if (state.src[state.offset] !== "{") {
      state.isError = true;
      return state;
    }
    state.offset++;
    const nodes = [];
    const nodeParser = getInlineNode();
    while (state.offset < state.src.length) {
      if (state.src[state.offset] === "}") {
        state.offset++;
        state.value = nodes;
        state.isError = false;
        return state;
      }
      const saved = state.offset;
      state.isError = false;
      nodeParser.parser(state);
      if (state.isError || state.offset === saved) {
        state.offset = saved + 1;
        state.isError = false;
      } else if (state.value != null) {
        nodes.push(state.value);
      }
    }
    state.value = nodes;
    state.isError = false;
    return state;
  });
}
function bracketBalanced() {
  return new Parser((state) => {
    if (state.src[state.offset] !== "[") {
      state.isError = true;
      return state;
    }
    let depth = 1;
    let braceDepth = 0;
    let i = state.offset + 1;
    while (i < state.src.length && depth > 0) {
      const ch = state.src[i];
      if (ch === "{") braceDepth++;
      else if (ch === "}") braceDepth--;
      else if (braceDepth === 0) {
        if (ch === "[") depth++;
        else if (ch === "]") depth--;
      }
      i++;
    }
    if (depth !== 0) {
      state.isError = true;
      return state;
    }
    state.value = state.src.slice(state.offset + 1, i - 1);
    state.offset = i;
    state.isError = false;
    return state;
  });
}
function rawUntilEnd(envName) {
  return new Parser((state) => {
    const target = `\\end{${envName}}`;
    const idx = state.src.indexOf(target, state.offset);
    if (idx === -1) {
      state.isError = true;
      return state;
    }
    state.value = state.src.slice(state.offset, idx);
    state.offset = idx + target.length;
    return state;
  });
}
function nodesUntilEnd(envName) {
  return new Parser((state) => {
    const endTag = `\\end{${envName}}`;
    const nodes = [];
    const nodeParser = getInlineNode();
    while (state.offset < state.src.length) {
      if (state.src.startsWith(endTag, state.offset)) {
        state.offset += endTag.length;
        state.value = nodes;
        state.isError = false;
        return state;
      }
      const saved = state.offset;
      state.isError = false;
      nodeParser.parser(state);
      if (state.isError || state.offset === saved) {
        state.offset = saved + 1;
        state.isError = false;
        continue;
      }
      if (state.value != null) {
        nodes.push(state.value);
      }
    }
    state.isError = true;
    return state;
  });
}
function splitOnItem(body) {
  const items = [];
  let current = [];
  for (const node of body) {
    if (node.type === "command" && node.name === "item") {
      if (current.length > 0) {
        items.push(current);
      }
      current = [];
    } else {
      current.push(node);
    }
  }
  if (current.length > 0) {
    items.push(current);
  }
  return items.filter(
    (item) => item.some(
      (node) => node.type !== "text" || node.value.trim().length > 0
    )
  );
}

// src/grammar/text.ts
import { Parser as Parser2, regex as regex2, string as string2, any } from "@mkbabb/parse-that";

// src/utils/accents.ts
var UMLAUT_MAP = {
  a: "\xE4",
  o: "\xF6",
  u: "\xFC",
  e: "\xEB",
  i: "\xEF",
  y: "\xFF",
  A: "\xC4",
  O: "\xD6",
  U: "\xDC",
  E: "\xCB",
  I: "\xCF",
  Y: "\u0178"
};
var ACUTE_MAP = {
  a: "\xE1",
  e: "\xE9",
  i: "\xED",
  o: "\xF3",
  u: "\xFA",
  A: "\xC1",
  E: "\xC9",
  I: "\xCD",
  O: "\xD3",
  U: "\xDA"
};
var GRAVE_MAP = {
  a: "\xE0",
  e: "\xE8",
  i: "\xEC",
  o: "\xF2",
  u: "\xF9",
  A: "\xC0",
  E: "\xC8",
  I: "\xCC",
  O: "\xD2",
  U: "\xD9"
};
var CIRCUMFLEX_MAP = {
  a: "\xE2",
  e: "\xEA",
  i: "\xEE",
  o: "\xF4",
  u: "\xFB",
  A: "\xC2",
  E: "\xCA",
  I: "\xCE",
  O: "\xD4",
  U: "\xDB"
};
var TILDE_MAP = {
  a: "\xE3",
  n: "\xF1",
  o: "\xF5",
  A: "\xC3",
  N: "\xD1",
  O: "\xD5"
};
var CEDILLA_MAP = {
  c: "\xE7",
  C: "\xC7"
};
var ACCENT_MAPS = {
  '"': UMLAUT_MAP,
  "'": ACUTE_MAP,
  "`": GRAVE_MAP,
  "^": CIRCUMFLEX_MAP,
  "~": TILDE_MAP,
  c: CEDILLA_MAP,
  H: {},
  // Hungarian umlaut (rare)
  u: {},
  // Breve (rare)
  v: {}
  // Háček (rare)
};
var SYMBOL_MAP = {
  "implies": "\u21D2",
  "iff": "\u21D4",
  "Rightarrow": "\u21D2",
  "Leftarrow": "\u21D0",
  "rightarrow": "\u2192",
  "leftarrow": "\u2190",
  "leftrightarrow": "\u2194",
  "to": "\u2192",
  "infty": "\u221E",
  "ldots": "\u2026",
  "cdots": "\u22EF",
  "dots": "\u2026",
  "S": "\xA7",
  "aa": "\xE5",
  "AA": "\xC5",
  "ae": "\xE6",
  "AE": "\xC6",
  "oe": "\u0153",
  "OE": "\u0152",
  "ss": "\xDF",
  "i": "\u0131",
  "j": "\u0237",
  "o": "\xF8",
  "O": "\xD8",
  "l": "\u0142",
  "L": "\u0141"
};

// src/grammar/text.ts
function textNode(value) {
  return { type: "text", value };
}
var plainText = regex2(/[^\\{}$%~\[\]\n`'-]+/).map(textNode);
var singleQuote = new Parser2((state) => {
  if (state.src[state.offset] === "'" && state.src[state.offset + 1] !== "'") {
    state.value = textNode("'");
    state.offset += 1;
    state.isError = false;
    return state;
  }
  state.isError = true;
  return state;
});
var singleBacktick = new Parser2((state) => {
  if (state.src[state.offset] === "`" && state.src[state.offset + 1] !== "`") {
    state.value = textNode("`");
    state.offset += 1;
    state.isError = false;
    return state;
  }
  state.isError = true;
  return state;
});
var singleNewline = regex2(/\n(?![ \t]*\n)/).map(
  () => textNode(" ")
);
var singleHyphen = new Parser2((state) => {
  if (state.src[state.offset] === "-" && state.src[state.offset + 1] !== "-") {
    state.value = textNode("-");
    state.offset += 1;
    state.isError = false;
    return state;
  }
  state.isError = true;
  return state;
});
var emDash = string2("---").map(() => textNode("\u2014"));
var enDash = new Parser2((state) => {
  if (state.src[state.offset] === "-" && state.src[state.offset + 1] === "-" && state.src[state.offset + 2] !== "-") {
    state.value = textNode("\u2013");
    state.offset += 2;
    state.isError = false;
    return state;
  }
  state.isError = true;
  return state;
});
var leftDoubleQuote = string2("``").map(
  () => textNode("\u201C")
);
var rightDoubleQuote = string2("''").map(
  () => textNode("\u201D")
);
var tilde = string2("~").map(() => textNode(" "));
var comment = regex2(/%[^\n]*\n?/).map(() => null);
var escapedSpecial = string2("\\").then(regex2(/[#$%&_{}]/)).map(([_, ch]) => textNode(ch === "&" ? "&amp;" : ch));
var escapedSpace = string2("\\ ").map(() => textNode(" "));
var lineBreak = string2("\\\\").skip(regex2(/\s*/)).map(() => textNode(" "));
var spacingCmd = string2("\\").then(regex2(/[,;:!]/)).map(() => textNode(" "));
var quadCmd = regex2(/\\q?quad/).map(() => textNode(" "));
var bracedAccent = string2("\\").then(regex2(/['"`^~]/)).then(braceBalanced()).map(([[_, cmd2], inner]) => {
  const char = inner.replace(/[{}]/g, "");
  const map = ACCENT_MAPS[cmd2];
  return textNode(map?.[char] ?? char);
});
var unbracedAccent = string2("\\").then(regex2(/['"`^~]/)).then(regex2(/[a-zA-Z]/)).map(([[_, cmd2], char]) => {
  const map = ACCENT_MAPS[cmd2];
  return textNode(map?.[char] ?? char);
});
var namedAccent = string2("\\").then(regex2(/[Hcuv]/)).then(braceBalanced()).map(([[_, cmd2], inner]) => {
  const char = inner.replace(/[{}]/g, "");
  const map = ACCENT_MAPS[cmd2];
  return textNode(map?.[char] ?? char);
});
var accent = any(bracedAccent, unbracedAccent, namedAccent);
function symbolCommand() {
  const names = Object.keys(SYMBOL_MAP).sort((a, b) => b.length - a.length);
  const alts = names.map(
    (name) => regex2(new RegExp(`\\\\${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-zA-Z])`)).map(() => textNode(SYMBOL_MAP[name]))
  );
  return any(...alts);
}

// src/grammar/math.ts
import { Parser as Parser3, regex as regex3, string as string3 } from "@mkbabb/parse-that";
var inlineMath = new Parser3((state) => {
  if (state.src[state.offset] !== "$" || state.src[state.offset + 1] === "$") {
    state.isError = true;
    return state;
  }
  const start = state.offset + 1;
  const end = state.src.indexOf("$", start);
  if (end === -1) {
    state.isError = true;
    return state;
  }
  state.value = {
    type: "math",
    value: state.src.slice(start, end),
    display: false
  };
  state.offset = end + 1;
  state.isError = false;
  return state;
});
var displayMathDollar = string3("$$").next(regex3(/[^$]+/)).skip(string3("$$")).map((value) => ({
  type: "math",
  value: value.trim(),
  display: true
}));
var displayMathBracket = string3("\\[").next(regex3(/[\s\S]*?(?=\\\])/)).skip(string3("\\]")).map((value) => ({
  type: "math",
  value: value.trim(),
  display: true
}));
var inlineMathParen = string3("\\(").next(regex3(/[\s\S]*?(?=\\\))/)).skip(string3("\\)")).map((value) => ({
  type: "math",
  value: value.trim(),
  display: false
}));
function mathEnvBody(envName) {
  return rawUntilEnd(envName).map((raw) => {
    const rawValue = raw.trim();
    let value = rawValue.replace(/\\label\{[^}]*\}/g, "").trim();
    if (envName === "align" || envName === "align*") {
      value = `\\begin{aligned} ${value} \\end{aligned}`;
    }
    return {
      type: "math",
      value,
      display: true,
      rawValue
    };
  });
}
var MATH_ENVS = [
  "equation",
  "equation*",
  "align",
  "align*",
  "gather",
  "gather*",
  "multline",
  "multline*",
  "flalign",
  "flalign*",
  "split"
];
function isMathEnv(name) {
  return MATH_ENVS.includes(name);
}

// src/grammar/commands.ts
import { regex as regex4, string as string4 } from "@mkbabb/parse-that";
function cmd(name) {
  return regex4(new RegExp(`\\\\${name}(?![a-zA-Z])`)).map(() => name);
}
var sectionCommand = regex4(
  /\\(chapter|section|subsection|subsubsection)\*?(?![a-zA-Z])/
).skip(ws).then(braceContent()).map(([cmdMatch, titleNodes]) => {
  const starred = cmdMatch.includes("*");
  const level = cmdMatch.replace(/^\\/, "").replace("*", "");
  return {
    type: "section",
    level,
    starred,
    title: titleNodes
  };
});
var formattingCommand = regex4(
  /\\(textit|textbf|emph|texttt|text|mathit|mathrm|mathbf|underline)(?![a-zA-Z])/
).skip(ws).then(braceContent()).map(([cmdMatch, argNodes]) => {
  const name = cmdMatch.replace(/^\\/, "");
  return {
    type: "command",
    name,
    args: [argNodes]
  };
});
var refCommand = regex4(
  /\\(eqref|ref)(?![a-zA-Z])/
).skip(ws).then(braceBalanced()).map(([cmdMatch, arg]) => ({
  type: "command",
  name: cmdMatch.replace(/^\\/, ""),
  args: [[{ type: "text", value: arg }]]
}));
var labelCommand = cmd("label").skip(ws).next(braceBalanced()).map((key) => ({
  type: "label",
  key
}));
var hyperrefCommand = string4("\\hyperref").skip(ws).next(bracketBalanced()).skip(ws).then(braceContent()).map(([target, textNodes]) => ({
  type: "command",
  name: "hyperref",
  args: [textNodes],
  optArgs: [[{ type: "text", value: target }]]
}));
var citeCommand = cmd("cite").skip(ws).then(bracketBalanced().opt()).skip(ws).then(braceBalanced()).map(([[_, opt], key]) => ({
  type: "command",
  name: "cite",
  args: [[{ type: "text", value: key }]],
  ...opt != null && {
    optArgs: [[{ type: "text", value: opt }]]
  }
}));
var urlCommand = cmd("url").skip(ws).next(braceBalanced()).map((url) => ({
  type: "command",
  name: "url",
  args: [[{ type: "text", value: url }]]
}));
var hrefCommand = string4("\\href").skip(ws).next(braceBalanced()).skip(ws).then(braceContent()).map(([url, textNodes]) => ({
  type: "command",
  name: "href",
  args: [
    [{ type: "text", value: url }],
    textNodes
  ]
}));
var paragraphCommand = cmd("paragraph").skip(ws).next(braceContent()).map((titleNodes) => ({
  type: "command",
  name: "paragraph",
  args: [titleNodes]
}));
var skipCommand = regex4(
  /\\(medskip|smallskip|bigskip|vfill|hfill|noindent|newline|centering|newpage|clearpage|cleardoublepage|maketitle|tableofcontents|bibliographystyle|bibliography|appendix|frontmatter|mainmatter|backmatter)(?![a-zA-Z])/
).skip(ws).skip(braceBalanced().opt()).map(() => null);
var vspaceCommand = regex4(/\\[vh]space\*?/).skip(ws).skip(braceBalanced()).map(() => null);
var newtheoremCommand = string4("\\newtheorem").skip(ws).skip(braceBalanced()).skip(ws).skip(bracketBalanced().opt()).skip(ws).skip(braceBalanced()).skip(ws).skip(bracketBalanced().opt()).map(() => null);
var inputCommand = regex4(
  /\\(input|include)(?![a-zA-Z])/
).skip(ws).skip(braceBalanced()).map(() => null);
var preambleCommand = regex4(
  /\\(usepackage|documentclass|RequirePackage|PassOptionsToPackage|newcommand|renewcommand|providecommand|DeclareMathOperator|DeclarePairedDelimiter|theoremstyle|numberwithin|setcounter|definecolor|hypersetup|geometry|fancyhf|fancyhead|fancyfoot|pagestyle|thispagestyle|setlength|addtolength|title|author|date|thanks)(?![a-zA-Z])/
).skip(regex4(/[^\n]*/)).map(() => null);
var footnoteCommand = cmd("footnote").skip(ws).next(braceContent()).map((nodes) => ({
  type: "command",
  name: "footnote",
  args: [nodes]
}));
var atCommand = string4("\\@").map(() => null);
var itemCommand = cmd("item").skip(ws).then(bracketBalanced().opt()).map(([_, opt]) => ({
  type: "command",
  name: "item",
  args: [],
  ...opt != null && {
    optArgs: [[{ type: "text", value: opt }]]
  }
}));
var includegraphicsCommand = string4(
  "\\includegraphics"
).skip(ws).then(bracketBalanced().opt()).skip(ws).then(braceBalanced()).map(([[_, opts], file]) => ({
  type: "command",
  name: "includegraphics",
  args: [[{ type: "text", value: file }]],
  ...opts != null && {
    optArgs: [[{ type: "text", value: opts }]]
  }
}));
var captionCommand = cmd("caption").skip(ws).next(braceContent()).map((nodes) => ({
  type: "command",
  name: "caption",
  args: [nodes]
}));
var unknownCommand = string4("\\").next(regex4(/[a-zA-Z@]+\*?/)).skip(ws).then(bracketBalanced().opt()).skip(ws).then(braceContent().opt()).map(([[name, opt], argNodes]) => ({
  type: "command",
  name,
  args: argNodes != null ? [argNodes] : [],
  ...opt != null && {
    optArgs: [[{ type: "text", value: opt }]]
  }
}));

// src/grammar/environments.ts
import { string as string5 } from "@mkbabb/parse-that";
var THEOREM_TYPES = /* @__PURE__ */ new Set([
  "theorem",
  "definition",
  "lemma",
  "proposition",
  "corollary",
  "aside",
  "example",
  "remark",
  "notation"
]);
function parseTheoremEnv(envName) {
  return ws.next(bracketBalanced().opt()).skip(ws).then(nodesUntilEnd(envName)).map(([name, body]) => ({
    type: "theorem",
    envType: envName,
    ...name != null && {
      name: [{ type: "text", value: name }]
    },
    body
  }));
}
function parseListEnv(envName, ordered) {
  return nodesUntilEnd(envName).map((body) => ({
    type: "list",
    ordered,
    items: splitOnItem(body)
  }));
}
function parseDescriptionEnv() {
  return nodesUntilEnd("description").map((body) => {
    const rawItems = splitOnItem(body);
    const items = [];
    for (const itemNodes of rawItems) {
      const term = [];
      const bodyNodes = [];
      let foundTerm = false;
      for (const node of itemNodes) {
        if (!foundTerm && node.type === "command" && node.name === "item" && node.optArgs?.length) {
          term.push(...node.optArgs[0]);
          foundTerm = true;
        } else {
          bodyNodes.push(node);
        }
      }
      items.push({ term, body: bodyNodes });
    }
    return {
      type: "description",
      items
    };
  });
}
function parseFigureEnv() {
  return nodesUntilEnd("figure").map((body) => {
    let filename;
    let caption;
    let label;
    let options;
    for (const node of body) {
      if (node.type === "command") {
        if (node.name === "includegraphics") {
          let f = node.args[0]?.[0];
          if (f && f.type === "text") {
            filename = f.value.replace(/^.*\//, "");
            if (!filename.includes(".")) filename += ".png";
            filename = filename.replace(/\.pdf$/, ".png");
          }
          if (node.optArgs?.[0]?.[0]?.type === "text") {
            options = node.optArgs[0][0].value;
          }
        } else if (node.name === "caption") {
          caption = node.args[0];
        }
      } else if (node.type === "label") {
        label = node.key;
      }
    }
    return {
      type: "figure",
      filename,
      caption,
      label,
      options
    };
  });
}
function parseProofEnv() {
  return nodesUntilEnd("proof").map((body) => ({
    type: "proof",
    body
  }));
}
function parseQuoteEnv() {
  return nodesUntilEnd("quote").map((body) => ({
    type: "quote",
    body
  }));
}
var SKIP_ENVS = /* @__PURE__ */ new Set([
  "tabular",
  "tabular*",
  "table",
  "table*",
  "tikzpicture",
  "abstract",
  "titlepage",
  "minipage",
  "verbatim",
  "lstlisting"
]);
var environment = string5("\\begin").skip(ws).next(braceBalanced()).chain((envName) => {
  if (isMathEnv(envName)) {
    return mathEnvBody(envName);
  }
  if (THEOREM_TYPES.has(envName)) {
    return parseTheoremEnv(envName);
  }
  if (envName === "enumerate") return parseListEnv(envName, true);
  if (envName === "itemize") return parseListEnv(envName, false);
  if (envName === "description") return parseDescriptionEnv();
  if (envName === "figure" || envName === "figure*") return parseFigureEnv();
  if (envName === "proof") return parseProofEnv();
  if (envName === "quote" || envName === "quotation") return parseQuoteEnv();
  if (envName === "center") {
    return nodesUntilEnd(envName).map((body) => ({
      type: "environment",
      name: envName,
      body
    }));
  }
  if (envName === "document") {
    return nodesUntilEnd(envName).map((body) => ({
      type: "environment",
      name: envName,
      body
    }));
  }
  if (SKIP_ENVS.has(envName)) {
    return rawUntilEnd(envName).map(() => null);
  }
  return nodesUntilEnd(envName).map((body) => ({
    type: "environment",
    name: envName,
    body
  }));
});

// src/grammar/document.ts
var paragraphBreak = regex6(/\n[ \t]*\n\s*/).map(
  () => ({ type: "paragraphBreak" })
);
var braceGroup = braceContent().map((nodes) => ({
  type: "group",
  body: nodes
}));
var inlineNode = any4(
  // Comments (stripped)
  comment,
  // Paragraph breaks
  paragraphBreak,
  // Math (display before inline to match $$ before $)
  displayMathDollar,
  displayMathBracket,
  inlineMathParen,
  inlineMath,
  // Multi-char specials (before single-char parsers)
  emDash,
  enDash,
  leftDoubleQuote,
  rightDoubleQuote,
  // Environments (\begin before other \commands)
  environment,
  // Sectioning commands
  sectionCommand,
  // Accents (before formatting commands to avoid ambiguity)
  accent,
  // Known commands with arguments
  formattingCommand,
  labelCommand,
  citeCommand,
  urlCommand,
  hrefCommand,
  hyperrefCommand,
  refCommand,
  paragraphCommand,
  footnoteCommand,
  itemCommand,
  includegraphicsCommand,
  captionCommand,
  // Symbols (\implies, \infty, etc.)
  symbolCommand(),
  // Skip/spacing commands (return null)
  skipCommand,
  vspaceCommand,
  newtheoremCommand,
  inputCommand,
  preambleCommand,
  atCommand,
  // Escaped chars
  escapedSpecial,
  escapedSpace,
  lineBreak,
  spacingCmd,
  quadCmd,
  // Unknown \command (catch-all for backslash commands)
  unknownCommand,
  // Tilde
  tilde,
  // Brace group (bare {})
  braceGroup,
  // Plain text and newlines
  plainText,
  singleHyphen,
  singleQuote,
  singleBacktick,
  singleNewline,
  // Last resort: skip one character
  regex6(/./).map((ch) => textNode(ch))
);
setInlineNode(inlineNode);
function parseLatex(source) {
  const nodes = [];
  const state = new ParserState2(source);
  while (state.offset < source.length) {
    const saved = state.offset;
    state.isError = false;
    inlineNode.parser(state);
    if (state.isError || state.offset === saved) {
      state.offset = saved + 1;
      state.isError = false;
      continue;
    }
    if (state.value != null) {
      nodes.push(state.value);
    }
  }
  return nodes;
}
function parseInlineString(source) {
  return parseLatex(source);
}
function astToText(nodes) {
  const parts = [];
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        parts.push(node.value);
        break;
      case "math":
        parts.push(node.display ? "" : `$${node.value}$`);
        break;
      case "command":
        if (node.name === "paragraph") {
          parts.push(astToText(node.args[0] ?? []));
        } else if (["textit", "textbf", "emph", "texttt", "text"].includes(
          node.name
        )) {
          parts.push(astToText(node.args[0] ?? []));
        }
        break;
      case "section":
        parts.push(astToText(node.title));
        break;
      case "group":
        parts.push(astToText(node.body));
        break;
      case "paragraphBreak":
        parts.push("\n\n");
        break;
      default:
        break;
    }
  }
  return parts.join("").replace(/  +/g, " ").trim();
}

// src/bibtex/parser.ts
import "@mkbabb/parse-that";
function cleanAccents(text) {
  text = text.replace(
    /\\(['"`^~])\{(\w)\}/g,
    (_, cmd2, ch) => ACCENT_MAPS[cmd2]?.[ch] ?? ch
  );
  text = text.replace(
    /\\(['"`^~])(\w)/g,
    (_, cmd2, ch) => ACCENT_MAPS[cmd2]?.[ch] ?? ch
  );
  text = text.replace(
    /\\([Hcuv])\{(\w)\}/g,
    (_, cmd2, ch) => ACCENT_MAPS[cmd2]?.[ch] ?? ch
  );
  text = text.replace(/[{}]/g, "");
  return text.trim();
}
function extractShortAuthor(author) {
  const multiAuthor = author.includes(" and ");
  let short = author;
  if (multiAuthor) {
    short = author.split(" and ")[0].trim();
  }
  if (short.includes(",")) {
    short = short.split(",")[0].trim();
  } else {
    const parts = short.split(/\s+/);
    const suffixes = /* @__PURE__ */ new Set(["Jr.", "Sr.", "Jr", "Sr", "II", "III", "IV"]);
    let lastIdx = parts.length - 1;
    while (lastIdx > 0 && suffixes.has(parts[lastIdx])) lastIdx--;
    short = parts[lastIdx];
  }
  if (multiAuthor) {
    short += " et al.";
  }
  return short;
}
function parseBibString(source) {
  const entries = [];
  const entryRe = /@(\w+)\{\s*([^\s,]+)\s*,([\s\S]*?)(?=\n@|\n*$)/g;
  let m;
  while ((m = entryRe.exec(source)) !== null) {
    const type = m[1].toLowerCase();
    const key = m[2];
    const body = m[3];
    const fields = {};
    const fieldRe = /(\w+)\s*=\s*\{([^{}]*(?:\{[^}]*\}[^{}]*)*)\}/gi;
    let fm;
    while ((fm = fieldRe.exec(body)) !== null) {
      fields[fm[1].toLowerCase()] = cleanAccents(fm[2]);
    }
    const author = fields.author ?? "";
    const shortAuthor = extractShortAuthor(author);
    entries.push({
      key,
      type,
      author,
      shortAuthor,
      year: fields.year ?? "",
      title: fields.title ?? "",
      fields
    });
  }
  return entries;
}
function parseBibToMap(source) {
  const entries = parseBibString(source);
  const map = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    map.set(entry.key, entry);
  }
  return map;
}

// src/transform/labels.ts
var LabelRegistry = class {
  labels = /* @__PURE__ */ new Map();
  sectionCounters = { chapter: 0, section: 0, subsection: 0, subsubsection: 0 };
  theoremCounter = 0;
  figureCounter = 0;
  equationCounter = 0;
  /** Current section number string — standalone \label nodes inherit this. */
  currentSectionNumber = "";
  /** Current section type for standalone labels. */
  currentSectionType = "section";
  /** Collect all labels from an AST (pass 1). */
  collectLabels(nodes) {
    for (const node of nodes) {
      this.visitNode(node);
    }
  }
  /** Resolve a label key to its info. Returns undefined if not found. */
  resolve(key) {
    return this.labels.get(key);
  }
  /** Get all collected labels. */
  all() {
    return new Map(this.labels);
  }
  visitNode(node) {
    switch (node.type) {
      case "section":
        this.visitSection(node);
        break;
      case "theorem":
        this.visitTheorem(node);
        break;
      case "figure":
        this.visitFigure(node);
        break;
      case "math":
        if (node.display) this.visitMath(node);
        break;
      case "label":
        if (this.currentSectionNumber && !this.labels.has(node.key)) {
          this.labels.set(node.key, {
            key: node.key,
            number: this.currentSectionNumber,
            type: this.currentSectionType
          });
        }
        break;
      case "environment":
        if (node.body) this.collectLabels(node.body);
        break;
      case "proof":
        this.collectLabels(node.body);
        break;
      case "quote":
        this.collectLabels(node.body);
        break;
      case "list":
        for (const item of node.items) this.collectLabels(item);
        break;
      case "description":
        for (const item of node.items) {
          this.collectLabels(item.term);
          this.collectLabels(item.body);
        }
        break;
      default:
        break;
    }
  }
  visitSection(node) {
    const level = node.level;
    this.sectionCounters[level]++;
    if (level === "chapter") {
      this.sectionCounters.section = 0;
      this.sectionCounters.subsection = 0;
      this.sectionCounters.subsubsection = 0;
      this.theoremCounter = 0;
      this.figureCounter = 0;
      this.equationCounter = 0;
    } else if (level === "section") {
      this.sectionCounters.subsection = 0;
      this.sectionCounters.subsubsection = 0;
    } else if (level === "subsection") {
      this.sectionCounters.subsubsection = 0;
    }
    let number;
    if (level === "chapter") {
      number = String(this.sectionCounters.chapter);
    } else if (level === "section") {
      number = `${this.sectionCounters.chapter}.${this.sectionCounters.section}`;
    } else if (level === "subsection") {
      number = `${this.sectionCounters.chapter}.${this.sectionCounters.section}.${this.sectionCounters.subsection}`;
    } else {
      number = `${this.sectionCounters.chapter}.${this.sectionCounters.section}.${this.sectionCounters.subsection}.${this.sectionCounters.subsubsection}`;
    }
    this.currentSectionNumber = number;
    for (const child of node.title) {
      if (child.type === "label") {
        this.labels.set(child.key, {
          key: child.key,
          number,
          type: "section"
        });
      }
    }
  }
  visitTheorem(node) {
    this.theoremCounter++;
    const chNum = this.sectionCounters.chapter || 1;
    const number = `${chNum}.${this.theoremCounter}`;
    for (const child of node.body) {
      if (child.type === "label") {
        this.labels.set(child.key, {
          key: child.key,
          number,
          type: "theorem"
        });
      }
    }
  }
  visitFigure(node) {
    this.figureCounter++;
    const chNum = this.sectionCounters.chapter || 1;
    const number = `${chNum}.${this.figureCounter}`;
    if (node.label) {
      this.labels.set(node.label, {
        key: node.label,
        number,
        type: "figure"
      });
    }
  }
  visitMath(node) {
    const chNum = this.sectionCounters.chapter || 1;
    const source = node.rawValue ?? node.value;
    const matches = [...source.matchAll(/\\label\{([^}]+)\}/g)];
    if (matches.length > 0) {
      for (const m of matches) {
        this.equationCounter++;
        const number = `${chNum}.${this.equationCounter}`;
        this.labels.set(m[1], {
          key: m[1],
          number,
          type: "equation"
        });
      }
    } else {
      this.equationCounter++;
    }
  }
};

// src/paper/flattenPaperSections.ts
function stripMarkup(text) {
  return text.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\$[^$]*\$/g, " ").replace(/\s+/g, " ").trim();
}
function estimateTextHeight(text) {
  const clean = stripMarkup(text);
  if (!clean) return 40;
  const lines = Math.ceil(clean.length / 180);
  return 40 + lines * 26;
}
function estimateBlockHeight(block) {
  if (typeof block === "string") {
    return estimateTextHeight(block);
  }
  if ("figure" in block) {
    const figure = block.figure;
    return 300 + estimateTextHeight(figure.caption);
  }
  if ("theorem" in block) {
    const theorem = block.theorem;
    const mathCount = theorem.math?.length ?? 0;
    return 140 + estimateTextHeight(theorem.body) + mathCount * 96;
  }
  const math = block;
  return 104 + Math.min(120, Math.ceil(math.tex.length / 120) * 16);
}
function estimatePaperSectionHeight(section, depth) {
  const headingHeight = depth === 0 ? 124 : depth === 1 ? 88 : 72;
  const depthPadding = Math.max(0, 24 - depth * 4);
  const contentHeight = section.content.reduce(
    (sum, block) => sum + estimateBlockHeight(block),
    0
  );
  const calloutHeight = section.callout ? 148 : 0;
  return Math.max(
    depth === 0 ? 320 : 220,
    Math.round(headingHeight + depthPadding + contentHeight + calloutHeight)
  );
}
function flattenPaperSections(sections) {
  const flat = [];
  function walk(nodes, depth, parentId, rootId, rootIndex) {
    for (const [nodeIndex, section] of nodes.entries()) {
      const nextRootId = depth === 0 ? section.id : rootId;
      const nextRootIndex = depth === 0 ? nodeIndex : rootIndex;
      flat.push({
        id: section.id,
        index: flat.length,
        depth,
        sourceLevel: section.sourceLevel ?? depth,
        starred: section.starred ?? false,
        parentId,
        rootId: nextRootId,
        rootIndex: nextRootIndex,
        section,
        estimatedHeight: estimatePaperSectionHeight(section, depth)
      });
      if (section.subsections?.length) {
        walk(
          section.subsections,
          depth + 1,
          section.id,
          nextRootId,
          nextRootIndex
        );
      }
    }
  }
  walk(sections, 0, null, "", 0);
  return flat;
}

export {
  ACCENT_MAPS,
  SYMBOL_MAP,
  parseLatex,
  parseInlineString,
  astToText,
  parseBibString,
  parseBibToMap,
  LabelRegistry,
  estimatePaperSectionHeight,
  flattenPaperSections
};
//# sourceMappingURL=chunk-H5ZLAB63.js.map