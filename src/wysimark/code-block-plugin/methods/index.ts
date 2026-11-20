import { Editor } from "slate"

import { curryOne } from "../../sink"

import { createCodeBlock } from "./createCodeBlock"
import { setCodeBlockLanguage } from "./setCodeBlockLanguage"
import { convertCodeBlockToParagraph } from "./convertCodeBlockToParagraph"
import { toggleCodeBlock } from "./toggleCodeBlock"
import type { BuiltInLanguage, CodeBlockEditor } from "../types"

export function createCodeBlockMethods(editor: Editor): CodeBlockEditor['codeBlock'] {
  // Each mounted note editor starts with its own default.
  let defaultLanguage: BuiltInLanguage = "text"
  return {
    convertCodeBlockToParagraph: curryOne(convertCodeBlockToParagraph, editor),
    toggleCodeBlock: () => toggleCodeBlock(editor, defaultLanguage),
    createCodeBlock: (options = { language: defaultLanguage }) => createCodeBlock(editor, options),
    setCodeBlockLanguage: (language, options) => {
      if (!setCodeBlockLanguage(editor, language, options)) return false
      defaultLanguage = language
      return true
    },
  }
}
