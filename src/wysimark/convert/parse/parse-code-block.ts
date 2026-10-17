import type { Code, List, Root } from "mdast"
import remarkParse from "remark-parse"
import { unified } from "unified"

import { Element } from "../types"
import { InternalLinkOptions, restoreEscapedWikiLinks } from "../obsidian-links"
import { customRemarkGfm } from "./custom-gfm"
import { parseList } from "./parse-list"

const listParser = unified().use(remarkParse).use(customRemarkGfm())

/** Yuque exports standalone child lists with code-block indentation. An older
 * save may already have wrapped those in an unlabelled code fence. Recover only
 * complete prose lists; explicit languages, mixed content, and real code stay code.
 */
function recoverExportedList(content: Code, options: InternalLinkOptions): Element[] | null {
  if (content.lang || content.meta || !/^\s*(?:[-+*]|\d+[.)])\s+/.test(content.value)) return null
  if (!/[\u3400-\u9fff]|<font\b/i.test(content.value)) return null
  const root = listParser.parse(content.value) as Root
  if (!root.children.length || !root.children.every(node => node.type === 'list')) return null
  const depth = Math.min(32, Math.max(1, Math.floor(((content.position?.start.column ?? 1) - 1) / 4)))
  return root.children.flatMap(list => parseList(list as List, depth, options)).map(node => ({
    ...node,
    __blockDepth: 'depth' in node ? node.depth : depth,
  })) as Element[]
}

export function parseCodeBlock(content: Code, options: InternalLinkOptions = {}): Element[] {
  const recovered = recoverExportedList(content, options)
  if (recovered) return recovered
  const codeLines = restoreEscapedWikiLinks(content.value, true).split("\n")
  return [
    {
      type: "code-block",
      language: content.lang || "",
      ...(content.meta ? { meta: content.meta } : {}),
      children: codeLines.map((codeLine) => ({
        type: "code-block-line",
        children: [{ text: codeLine }],
      })),
    },
  ]
}