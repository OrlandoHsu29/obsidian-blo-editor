import { Text } from "slate"
import { cleanInlineStyle } from "../../blocks/typography"

/** Text marks an exported formula image has to carry itself. */
export type FormulaMarks = {
  color?: string
  background?: string
  highlight?: boolean
  underline?: boolean
  strike?: boolean
}

function styleValue(style: string | undefined, property: string): string | undefined {
  for (const part of style?.split(';') ?? []) {
    const colon = part.indexOf(':')
    if (colon > 0 && part.slice(0, colon).trim().toLowerCase() === property) return part.slice(colon + 1).trim()
  }
}

/** Marks of a formula leaf, or undefined when it is unstyled. */
export function formulaMarks(leaf: Text): FormulaMarks | undefined {
  const style = cleanInlineStyle(leaf.inlineStyle)
  const marks: FormulaMarks = {
    color: styleValue(style, 'color'),
    background: styleValue(style, 'background-color'),
    highlight: !!leaf.highlight,
    underline: !!leaf.underline,
    strike: !!leaf.strike,
  }
  return marks.color || marks.background || marks.highlight || marks.underline || marks.strike ? marks : undefined
}

export const formulaMarksKey = (marks?: FormulaMarks) => marks
  ? [marks.color ?? '', marks.background ?? '', marks.highlight ? 1 : 0, marks.underline ? 1 : 0, marks.strike ? 1 : 0].join('|')
  : ''
