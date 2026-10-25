import type { Code, List, Root } from "mdast"
import remarkParse from "remark-parse"
import remarkMath from "remark-math"
import { unified } from "unified"
import { visit } from "unist-util-visit"

import { Element } from "../types"
import { InternalLinkOptions, restoreEscapedWikiLinks } from "../obsidian-links"
import { customRemarkGfm } from "./custom-gfm"
import { parseList } from "./parse-list"

const listParser = unified().use(remarkParse).use(customRemarkGfm()).use(remarkMath)

function isExportedList(content: Code): boolean {
  return !content.lang && !content.meta && /^\s*(?:[-+*]|\d+[.)])\s+/.test(content.value) &&
    /[\u3400-\u9fff]|<font\b/i.test(content.value)
}

/** Ignore font examples inside inline code when repairing exported prose. */
export function hasUnclosedExportedFont(content: Code): boolean {
  if (!isExportedList(content)) return false
  let depth = 0
  visit(listParser.parse(content.value) as Root, 'html', node => {
    if (/^<font\b[^>]*>$/i.test(node.value)) depth++
    else if (/^<\/font\s*>$/i.test(node.value)) depth = Math.max(0, depth - 1)
  })
  return depth > 0
}

/** Yuque exports standalone child lists with code-block indentation. An older
 * save may already have wrapped those in an unlabelled code fence. Recover only
 * complete prose lists; explicit languages, mixed content, and real code stay code.
 */
function recoverExportedList(content: Code, options: InternalLinkOptions): Element[] | null {
  if (!isExportedList(content)) return null
  const depth = Math.min(32, Math.max(1, Math.floor(((content.position?.start.column ?? 1) - 1) / 4)))
  const recovered = parseExportedListSource(content.value, depth, options)
  if (!recovered) return null
  return recovered.map(node => ({
    ...node,
    __blockDepth: 'depth' in node ? node.depth : depth,
  })) as Element[]
}

/** Retry a complete exported list independently of the preceding broken block. */
export function parseExportedListSource(source: string, depth: number, options: InternalLinkOptions): Element[] | null {
  const root = listParser.parse(source) as Root
  if (!root.children.length || !root.children.every(node => node.type === 'list')) return null
  return root.children.flatMap(list => parseList(list as List, depth, options))
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
