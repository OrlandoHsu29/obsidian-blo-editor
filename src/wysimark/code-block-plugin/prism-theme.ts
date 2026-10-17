/**
 * Styles from
 * https://github.com/PrismJS/prism-themes/blob/master/themes/prism-ghcolors.css
 */

import { CSSProperties } from "react"

const commentStyle = { color: "var(--code-comment, var(--text-muted))", fontStyle: "italic" }
const dimStyle = { opacity: "0.7" }
const stringStyle = { color: "var(--code-string, var(--color-green))" }
const operatorStyle = { color: "var(--code-operator, var(--text-normal))" }
const valueStyle = { color: "var(--code-value, var(--color-orange))" }
const keywordStyle = { color: "var(--code-keyword, var(--color-purple))" }
const functionStyle = { color: "var(--code-function, var(--color-blue))" }
const tagStyle = { color: "var(--code-tag, var(--color-blue))" }
const regularStyle = { fontWeight: "inherit" }
const italicStyle = { fontStyle: "italic" }

type TokenStyles = Record<string, CSSProperties>

export const tokenStyles: TokenStyles = {
  comment: commentStyle,
  prolog: commentStyle,
  doctype: commentStyle,
  cdata: commentStyle,
  namespace: dimStyle,
  string: stringStyle,
  char: stringStyle,
  inserted: stringStyle,
  deleted: { color: 'var(--color-red)' },
  "attr-value": stringStyle,
  puncutation: operatorStyle,
  punctuation: { color: 'var(--code-punctuation, var(--text-muted))' },
  'class-name': { color: 'var(--code-type, var(--color-yellow))' },
  builtin: keywordStyle,
  macro: keywordStyle,
  directive: keywordStyle,
  'directive-hash': keywordStyle,
  'macro-name': valueStyle,
  operator: operatorStyle,
  entity: valueStyle,
  url: valueStyle,
  symbol: valueStyle,
  number: valueStyle,
  boolean: valueStyle,
  variable: valueStyle,
  constant: valueStyle,
  property: valueStyle,
  regex: valueStyle,
  insert: valueStyle,
  atrule: keywordStyle,
  keyword: keywordStyle,
  "attr-name": keywordStyle,
  function: functionStyle,
  delete: functionStyle,
  tag: tagStyle,
  selector: tagStyle,
  important: regularStyle,
  bold: regularStyle,
  italic: italicStyle,
}
