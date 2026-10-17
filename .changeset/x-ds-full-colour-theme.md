---
"@mkbabb/latex-paper": minor
---

theme: read colour tokens as full colours (`var(--primary)`, `color-mix(in srgb, var(--border) 50%, transparent)`), not `hsl(var(--token))` over bare `H S% L%` triples. Glass 8+ consumers ship full colour values, against which every `hsl(var(--x))` was invalid (theorem rules fell back to ink, sticky section headers went transparent). The display equation's hover rule-bar is removed, and a sub-section heading's space before is 2.5rem (X-DS DS-F7-C1, DS-F7-C4). With the flat theorem block, straight theorem rule and flat section rule already on master (DS-F-C3, DS-F3-C9/C10, DS-F5-C6). Breaking for a consumer that still defines bare triples.

Also (X-DS DS-F8-C1, C3, C5): the theorem, proposition and corollary rule and label read an optional `--theorem-accent` (defaulting to `--primary`), for consumers whose `--primary` is an ink in one theme; an equation number is upright inside a theorem's italic; and below a 40rem viewport the equation number drops under its display so the equation takes the full width.

Also (X-DS DS-F9-C2, C3, C6): `\item[term]` in a `description` environment is parsed into `DescriptionNode.term` (the item command's optional argument was dropped by the item split, so every `<dt>` rendered empty); `ol.paper-list` and `ul.paper-list` restate their `decimal` and `disc` markers (muted `::marker`) against a host's CSS reset; and in the below-40rem arm a display's block-end margin and padding are zeroed so the stacked number hugs its last line.

Also (X-DS DS-F4-C1): a description term (`<dt>`) sits on the semibold rung (600, was 700), flush, its definition hanging under it.

Also (X-DS DS-F7C-C2): a proof's label sets its period against its word ("Proof."); the Vue template's line breaks rendered it as "Proof . ".
