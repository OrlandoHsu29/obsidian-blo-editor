import Prism, { getCodeGrammar } from "./languages"
const { tokenize } = Prism
const decorations=new WeakMap<object,{relative:Range[];path:string;absolute:Range[]}>()
export function decorate(entry:[CodeBlockElement|CodeBlockLineElement,Path]):Range[] {
 const [node,path]=entry
 if(!Element.isElement(node)||node.type!=='code-block')return []
 let cached=decorations.get(node)
 if(!cached){cached={relative:decorateCodeBlock([node,[]]),path:'',absolute:[]};decorations.set(node,cached)}
 const key=path.join('.')
 if(cached.path!==key||!cached.absolute.length&&cached.relative.length) {
  cached.path=key;cached.absolute=cached.relative.map(range=>({...range,anchor:{...range.anchor,path:[...path,...range.anchor.path]},focus:{...range.focus,path:[...path,...range.focus.path]}}))
 }
 return cached.absolute
}
import { Element, Node, Path, Range } from "slate"

import { CodeBlockElement, CodeBlockLineElement } from "./types"
import { tokenStyles } from './prism-theme'

/**
 * Decorate Overview:
 *
 * We decorate the entire `code-block` at once because if we do it by line,
 * code that continues through multiple lines is not higlighted correctly.
 *
 * In order to higlight the entire `code-block` at once, we need to add a
 * newline to the end of each `code-line`. We cannot use `Node.string` on the
 * entire `code-block`.
 *
 * Once we receive the Prism tokens back, we need to create the ranges.
 *
 * The important part is that we track the offsets from the start. With the
 * offsets, we need to map those back to a `path` and `offset` of each
 * `code-line`. We also need to take into consideration that we have added
 * newlines to the end of each line so the algorithm needs to account for that.
 */

/**
 * Takes an array of text lines and returns an array with the offset
 * in characters of the start of each line.
 */

function getLineOffsets(lines: string[]) {
  let offset = 0
  const lineOffsets: number[] = []
  for (const line of lines) {
    lineOffsets.push(offset)
    offset = offset + line.length
  }
  return lineOffsets
}

/**
 * `decorate` method passed to `Editable`
 */

function decorateCodeBlock(
  nodeEntry: [CodeBlockElement | CodeBlockLineElement, Path]
): Range[] {
  const [node, path] = nodeEntry

  if (!Element.isElement(node)) return []
  if (node.type !== "code-block") return []

  const lang = getCodeGrammar(node.language)

  if (lang === undefined) return []

  /**
   * To decorate a code-block, we need to look at all the code in a code-block.
   *
   * We can't `Node.string` the entire block because it will join lines
   * together without newlines.
   *
   * For this reason, we create an array of `textLines` which is the text of
   * each codeLine plus a newline on the end of it.
   *
   * Then we join all of those together to get the text that was pass into
   * Prism.
   *
   * We need to keep `textLines` around so that we can extract the
   * `linePositions`
   */

  const codeLineElements = node.children

  const textLines = codeLineElements.map((node) => `${Node.string(node)}\n`)

  const text = textLines.join("")

  const lineOffsets: number[] = getLineOffsets(textLines)

  /**
   * Takes a character offset from the beginning of the `code-block` and
   * returns the `path` to the `code-line` and the `offset` within the
   * `code-line` which Slate needs to make the decoration.
   */

  function getPointFromOffset(offset: number) {
    for (let i = lineOffsets.length - 1; i >= 0; i--) {
      const lineOffset = lineOffsets[i]
      if (lineOffset <= offset) {
        let remaining = Math.min(offset - lineOffset, Node.string(codeLineElements[i]).length)
        const leaves = Array.from(Node.texts(codeLineElements[i]))
        for (let j = 0; j < leaves.length; j++) {
          const [leaf, relativePath] = leaves[j]
          if (remaining <= leaf.text.length || j === leaves.length - 1) return { path: [...path, i, ...relativePath], offset: Math.min(remaining, leaf.text.length) }
          remaining -= leaf.text.length
        }
      }
    }
    throw new Error("This shouldn't happen and indicates a bug in the logic")
  }

  const ranges: (Range & { prismToken: string })[] = []

  const tokens = tokenize(text, lang)

  /**
   * Track current character offset from beginning of `textLines` joined
   * together.
   */

  let offset = 0

  /**
   * Tokens are either:
   *
   * - string: which means it is not syntax highlighted
   * - { type: string, content: string, length: number }: the highlight and content
   */
  const walk = (content: string | Prism.Token | (string | Prism.Token)[], kind?: string) => {
    if (typeof content === 'string') {
      if (kind && content.length) ranges.push({ anchor: getPointFromOffset(offset), focus: getPointFromOffset(offset + content.length), prismToken: kind })
      offset += content.length
    } else if (Array.isArray(content)) content.forEach(token => walk(token, kind))
    else {
      const aliases=typeof content.alias==='string'?[content.alias]:content.alias||[]
      const kind=tokenStyles[content.type]?content.type:aliases.find(alias=>tokenStyles[alias])||content.type
      walk(content.content, kind)
    }
  }
  walk(tokens)

  return ranges
}
