import { Editor, Element, Transforms } from "slate"

import { BetterAt, findElementUp } from "../../sink"

import type { BuiltInLanguage, CodeBlockElement } from "../types"

/**
 * Set the current CodeBlock's language if the selection is currently in a
 * CodeBlock. Returns true if the language was set, false otherwise.
 */
export function setCodeBlockLanguage(
  editor: Editor,
  language: BuiltInLanguage,
  options: { at?: BetterAt } = {}
): boolean {
  if (editor.wysimark.readOnly) return false
  const entry = findElementUp<CodeBlockElement>(
    editor,
    (el) => Element.isElement(el) && el.type === "code-block",
    { at: options.at }
  )
  if (!entry || entry[0].language === language) return false
  Transforms.setNodes(editor, { language }, { at: entry[1] })
  return true
}
