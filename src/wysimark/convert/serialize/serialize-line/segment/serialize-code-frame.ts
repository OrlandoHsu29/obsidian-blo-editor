import type { InlineCodeElement } from '../../../../inline-code-plugin/types'
import type { MarkKey } from '../../../types'
import { cleanInlineStyle } from '../../../../../blocks/typography'
import { convertMarksToCloseSymbols, convertMarksToOpenSymbols, getMarksFromText } from '../utils'

/** HTML keeps explicit frame boundaries and rich marks without Markdown delimiters. */
export function serializeCodeFrame(code: InlineCodeElement): string {
  const tags: Partial<Record<MarkKey, string>> = { bold: 'strong', italic: 'em', strike: 's' }
  return `<code>${code.children.map(text => {
    let value = text.text.replace(/[!-/:-@[-`{-~\r\n]/g, char => `&#${char.codePointAt(0)};`)
    for (const mark of getMarksFromText(text).filter(mark => mark !== 'code')) {
      const tag = tags[mark]
      value = tag ? `<${tag}>${value}</${tag}>` : convertMarksToOpenSymbols([mark]) + value + convertMarksToCloseSymbols([mark])
    }
    const style = cleanInlineStyle(text.inlineStyle)
    return style ? `<span style="${style}">${value}</span>` : value
  }).join('')}</code>`
}
