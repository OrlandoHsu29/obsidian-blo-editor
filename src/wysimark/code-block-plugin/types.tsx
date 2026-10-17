import { Text } from "slate"

import { BetterAt } from "../sink"

import { LanguageList } from "./languages"
export { LanguageList } from "./languages"
export type BuiltInLanguage = (typeof LanguageList)[number] | 'clike' | 'markup' | 'js'

type CodeBlockMethods = {
  toggleCodeBlock: () => void
  convertCodeBlockToParagraph: () => boolean
  createCodeBlock: (options: { language: BuiltInLanguage }) => void
  setCodeBlockLanguage: (
    language: BuiltInLanguage,
    options?: { at?: BetterAt }
  ) => boolean
}

export type CodeBlockEditor = {
  codeBlock: CodeBlockMethods
}

/**
 * The code block element is the root element of a code block.
 */
export type CodeBlockElement = {
  type: "code-block"
  /**
   * The language of the code block. Can accept any string because Markdown can
   * accept any string; however, the built-in Prism languages are defined in:
   * `BuiltInLanguage`
   */
  language: string
  meta?: string
  children: CodeBlockLineElement[]
}

export type CodeBlockLineElement = {
  type: "code-block-line"
  children: Text[]
}

export type CodeBlockPluginCustomTypes = {
  Name: "code-block"
  Editor: CodeBlockEditor
  Element: CodeBlockElement | CodeBlockLineElement
  Text: { text: string; prismToken?: string }
}
