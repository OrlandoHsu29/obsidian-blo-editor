import type { Root } from 'mdast'
import remarkParse from 'remark-parse'
import remarkMath from 'remark-math'
import { unified } from 'unified'
import { customRemarkGfm } from './custom-gfm'

// Recovery parses must use exactly the same grammar as the main document.
const parser = unified().use(remarkParse).use(customRemarkGfm()).use(remarkMath)

export function parseMarkdown(source: string): Root {
  return parser.parse(source) as Root
}
