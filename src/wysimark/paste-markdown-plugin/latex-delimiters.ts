import { SKIP, visit } from 'unist-util-visit'
import { parseMarkdown } from '../convert/parse/markdown-parser'
import { serializeMath } from '../math-plugin/serialize'

const literalNodes = new Set(['code', 'inlineCode', 'math', 'inlineMath', 'html', 'link', 'image', 'definition'])
const containerPrefix = /^([ \t]*(?:>[ \t]*)*)((?:[-+*]|\d+[.)])[ \t]+)?$/

/** Convert pasted TeX delimiters before CommonMark interprets their backslashes as escapes. */
export function normalizePastedLatex(source: string): string {
  if (!/(?<!\\)\\[[(]/.test(source)) return source
  const spans: string[] = []
  let offset = 0
  visit(parseMarkdown(source), node => {
    if (!literalNodes.has(node.type)) return
    const start = node.position?.start.offset, end = node.position?.end.offset
    if (start === undefined || end === undefined) return
    spans.push(source.slice(offset, start), source.slice(start, end).replace(/[^\r\n]/g, '\0'))
    offset = end
    return SKIP
  })
  spans.push(source.slice(offset))

  let cursor = 0
  let previousInline = false
  const result: string[] = []
  const pattern = /(?<!\\)\\(?:\[((?:(?!\\\[)[^\0])*?)(?<!\\)\\\]|\(((?:(?!\\\()[^\r\n\0])*?)(?<!\\)\\\))/g
  for (const match of spans.join('').matchAll(pattern)) {
    const start = match.index!, end = start + match[0].length
    const inline = match[2]
    let markdown: string
    if (inline !== undefined) {
      if (!inline.trim()) continue
      const separator = previousInline && start === cursor ? ' ' : ''
      markdown = separator + serializeMath(inline.trim())
    } else {
      const before = source.slice(source.lastIndexOf('\n', start - 1) + 1, start)
      const lineEnd = source.indexOf('\n', end)
      const after = source.slice(end, lineEnd < 0 ? source.length : lineEnd)
      const prefix = before.match(containerPrefix)
      if (!prefix || after.trim()) continue
      const indent = prefix[1] + (prefix[2]?.replace(/\S/g, ' ') ?? '')
      const lines = match[1].split(/\r?\n/)
      const body = lines.slice(1).map(line => {
        if (line.startsWith(indent)) return line.slice(indent.length)
        if (line.trim() === indent.trim()) return ''
      })
      if (body.some(line => line === undefined)) continue
      const latex = [lines[0], ...body].join('\n').trim()
      if (!latex) continue
      markdown = serializeMath(latex, true).trimEnd().replace(/\n/g, '\n' + indent)
    }
    result.push(source.slice(cursor, start), markdown)
    cursor = end
    previousInline = inline !== undefined
  }
  return cursor ? result.join('') + source.slice(cursor) : source
}
