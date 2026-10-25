import type { Text } from 'slate'

export type InlineCodeElement = { type: 'inline-code'; children: Text[] }

export type InlineCodeEditor = {
  inlineCode: {
    toggleInlineCode: () => void
  }
}

export type InlineCodeText = {
  text: string
  code?: true
}

export type InlineCodePluginCustomTypes = {
  Name: "inline-code"
  Editor: InlineCodeEditor
  Element: InlineCodeElement
  Text: InlineCodeText
}
