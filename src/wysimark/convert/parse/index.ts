import type { Root, TopLevelContent } from "mdast"
import remarkParse from "remark-parse"
import remarkMath from "remark-math"
import { unified } from "unified"
import { visit } from "unist-util-visit"

import { Element } from "../types"
import { customRemarkGfm } from "./custom-gfm"
import {
  InternalLinkOptions,
  protectEscapedWikiLinks,
} from "../obsidian-links"
import { parseContents } from "./parse-content"
import { transformInlineLinks } from "./transform-inline-links"
import { getLineEnding, withLineEnding } from "../line-endings"
import { parseBlockDocument } from '../../../blocks/persistence'
import { hasUnclosedExportedFont } from './parse-code-block'

const parser = unified().use(remarkParse).use(customRemarkGfm()).use(remarkMath)

/** Yuque can put a closing font tag at column zero inside an indented list.
 * Restore only those continuations so Markdown can recover the complete list.
 */
function repairYuqueListContinuations(source: string, ast: Root): string {
  const lines = source.split('\n')
  let changed = false
  const listPrefix = /^([ \t]*)(?:[-+*]|\d+[.)])[ \t]+/
  visit(ast, 'code', node => {
    if (!node.position || !hasUnclosedExportedFont(node)) return
    const start = node.position.start.line - 1, end = node.position.end.line
    const first = lines[start].match(listPrefix)
    // A real fenced code block must remain literal, including an unlabelled one.
    if (!first || first[1].length < 4) return
    const base = first[1].length
    let continuation = first[0].replace(/\S/g, ' '), value = node.value
    for (let line = start; line < end; line++) {
      const prefix = lines[line].match(listPrefix)
      if (prefix) continuation = prefix[0].replace(/\S/g, ' ')
    }
    for (let line = end; line < lines.length && lines[line].trim(); line++) {
      const indent = lines[line].match(/^[ \t]*/)![0].length
      if (indent < base) {
        if (!/^\s*<\/font\s*>/i.test(lines[line]) || !hasUnclosedExportedFont({ ...node, value })) break
        lines[line] = continuation + lines[line].trimStart()
        changed = true
      }
      const prefix = lines[line].match(listPrefix)
      if (prefix) continuation = prefix[0].replace(/\S/g, ' ')
      value += '\n' + lines[line].slice(base)
    }
  })
  return changed ? lines.join('\n') : source
}

function repairYuqueStrong(source:string,ast:Root):string {
  if(!source.includes('**')||!/<font\b/i.test(source))return source
  const codeRanges:{start:number;end:number}[]=[]
  visit(ast,node=>{
    if(node.type!=='code'&&node.type!=='inlineCode'&&node.type!=='math'&&node.type!=='inlineMath')return
    const start=node.position?.start.offset,end=node.position?.end.offset
    if(start!==undefined&&end!==undefined)codeRanges.push({start,end})
  })
  codeRanges.sort((a,b)=>a.start-b.start)
  // Hide literal code delimiters while finding Yuque's presentation wrappers.
  // Keep offsets unchanged, including newlines, so replacements use the source.
  let cursor=0
  const parts:string[]=[]
  for(const range of codeRanges){
    if(range.start<cursor)continue
    parts.push(source.slice(cursor,range.start),source.slice(range.start,range.end).replace(/[^\n]/g,' '))
    cursor=range.end
  }
  parts.push(source.slice(cursor))
  const masked=parts.join(''),result:string[]=[]
  cursor=0
  for(const match of masked.matchAll(/\*\*((?:(?!\*\*)[^\n])+)\*\*/g)){
    const start=match.index!,end=start+match[0].length,wrapped=source.slice(start+2,end-2)
    let escapes=0
    for(let i=start-1;i>=0&&source[i]==='\\';i--)escapes++
    if(escapes%2||!/<font\b/i.test(wrapped))continue
    // HTML strong tags avoid Markdown delimiter ambiguity at adjacent bold
    // runs, nested underline tags, and font/code boundaries (including spaces).
    result.push(source.slice(cursor,start),'<strong>',wrapped,'</strong>')
    cursor=end
  }
  return cursor?result.join('')+source.slice(cursor):source
}

export function parseToAst(
  markdown: string,
  options: InternalLinkOptions = { enableInternalLinks: true }
) {
  let source = options.enableInternalLinks ? protectEscapedWikiLinks(markdown) : markdown
  let ast = parser.parse(source) as Root
  if(options.yuqueFormatting){
    const continued = repairYuqueListContinuations(source, ast)
    if (continued !== source) { source = continued; ast = parser.parse(source) as Root }
    const repaired=repairYuqueStrong(source,ast)
    if(repaired!==source){source=repaired;ast=parser.parse(source) as Root}
  }
  visit(ast, 'paragraph', node => {
    const start=node.position?.start.offset
    if(start!==undefined&&/^\d{1,6}\\\. /.test(source.slice(start)))node.data={...node.data,escapedOrderedPrefix:true}
    const end = node.position?.end.offset
    if (options.yuqueFormatting && start !== undefined && end !== undefined) {
      const raw = source.slice(start, end)
      if (/^(?:[-+*]|\d+[.)])\s+/.test(raw) && /\n[ \t]+(?:[-+*]|\d+[.)])\s+/.test(raw)) {
        node.data = { ...node.data, yuqueListSource: raw }
      }
    }
  })
  visit(ast, "definition", (node) => {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start !== undefined && end !== undefined) {
      node.data = { ...node.data, rawMarkdown: source.slice(start, end) }
    }
  })
  visit(ast, "link", (node) => {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start === undefined || end === undefined) return
    const raw = source.slice(start, end)
    if (!raw.startsWith("[") && node.children.length === 1 && node.children[0].type === "text") {
      node.data = { ...node.data, markdownSyntax: raw.startsWith("<") ? "autolink" : "literal" }
    }
  })
  /**
   * Takes linkReference and imageReference and turns them into link and image.
   */
  transformInlineLinks(ast)
  return ast
}

/**
 * Takes a Markdown string as input and returns a remarkParse AST
 */
export function parse(
  markdown: string,
  options: InternalLinkOptions = { enableInternalLinks: true }
): Element[] {
  if(options.yuqueFormatting===undefined)options={...options,yuqueFormatting:/<font\b[^>]*\b(?:style|color)\s*=/i.test(markdown)}
  const blockDocument=parseBlockDocument(markdown, text=>parse(text,options))
  if(blockDocument)return blockDocument
  const lineEnding = getLineEnding(markdown)
  markdown = withLineEnding(markdown, "\n")
  const ast = parseToAst(markdown, options)
  /**
   * If there is no content, remark returns a root ast with no children (i.e.
   * no paragraphs) but for Slate, we need it to return an empty paragraph.
   *
   * So when this happens, we just generate an empty paragraph and return that
   * s he result.
   */
  if (ast.children.length === 0) {
    const empty = Array.from({ length: (markdown.match(/\n/g)?.length || 0) + 1 }, () => ({
      type: "paragraph", children: [{ text: "" }],
    })) as Element[]
    if (lineEnding !== "\n") empty[0].__markdownLineEnding = lineEnding
    return empty
  }

  const elements = parseContents(ast.children as TopLevelContent[], options)
  if (lineEnding !== "\n" && elements.length) elements[0].__markdownLineEnding = lineEnding
  const leading = markdown.match(/^\n+/)?.[0].length || 0
  const trailing = markdown.match(/\n+$/)?.[0].length || 0
  // Source boundary whitespace is not an additional editable paragraph.
  if (leading && elements.length) elements[0].__markdownLeadingNewlines = leading
  if (trailing && elements.length) elements[elements.length - 1].__markdownTrailingNewlines = trailing
  return elements
}
