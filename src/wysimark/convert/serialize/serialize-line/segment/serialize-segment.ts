import { Text as SlateText } from "slate"

import { MarkKey, Segment, Text } from "../../../types"
import { assertUnreachable } from "../../../utils"
import { serializeImageShared } from "../../serialize-image-shared"
import { EscapeTextOptions } from "../utils"
import { serializeCodeText } from "../segment/serialize-code-text"
import { serializeAnchor } from "./serialize-anchor"
import { serializeNonCodeText } from "./serialize-non-code-text"
import { cleanInlineStyle } from '../../../../../blocks/typography'
import { serializeMath } from "../../../../math-plugin/serialize"
import { serializeLine } from '../serialize-line'
import { serializeCodeFrame } from './serialize-code-frame'

/** Marks on an inline formula use tags, not delimiters; see the case below. */
const MATH_MARK_TAGS: [MarkKey, string][] = [
  ["bold", "strong"],
  ["italic", "em"],
  ["underline", "u"],
  ["strike", "s"],
  ["highlight", "mark"],
  ["kbd", "kbd"],
  ["sup", "sup"],
  ["sub", "sub"],
]

export function serializeSegment(
  segment: Segment,
  options?: EscapeTextOptions,
  preserveCodeBoundary = false
): string {
  if (SlateText.isText(segment)) {
    if (segment.inlineStyle) {
      const { inlineStyle, ...text } = segment;
      const style=cleanInlineStyle(inlineStyle)
      return style?`<span style="${style}">${serializeSegment(text, options)}</span>`:serializeSegment(text, options);
    }
    if (segment.html) return segment.text
    if (segment.footnote) return `[^${segment.footnote}]`
    /**
     * If the segment is a `code` segment, we need to use a different strategy
     * for escaping the `code` segment. This is why it needs a separate
     * serializing function.
     */
    if (segment.code) return serializeCodeText(segment, options)
    /**
     * Otherwise, we use the standard text escaping code.
     */
    return serializeNonCodeText(segment, options)
  }
  switch (segment.type) {
    case 'inline-code':
      if (!segment.children.some(text => text.text)) return ''
      if (preserveCodeBoundary || segment.children.length > 1) {
        return serializeCodeFrame(segment)
      }
      return serializeLine(segment.children.map(text => ({ ...text, code: true })), [], [], options)
    case "math-inline": {
      const formula = serializeMath(segment.latex, false, options?.inTable)
      const leaf = segment.children.find(child => SlateText.isText(child)) as Text | undefined
      if (!leaf) return formula
      // Marks around a formula use paired HTML tags: Markdown delimiters do not
      // reliably parse beside `$…$`, and Obsidian renders these tags too.
      let result = formula
      for (const [mark, tag] of MATH_MARK_TAGS) if (leaf[mark]) result = `<${tag}>${result}</${tag}>`
      const style = cleanInlineStyle(leaf.inlineStyle)
      return style ? `<span style="${style}">${result}</span>` : result
    }
    case "anchor": {
      return serializeAnchor(segment, options)
    }
    case "image-inline":
      return serializeImageShared(segment, options)
    default:
      assertUnreachable(segment)
  }
}
