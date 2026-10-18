import { createPlugin, stopEvent, TypedPlugin } from "../sink"
import { clipboardHtmlToMarkdown } from "./html-markdown"

import { createPasteMarkdownMethods } from "./methods"

type PasteMarkdownMethods = {
  pasteMarkdown: (markdown: string) => void
}

export type PasteMarkdownEditor = {
  pasteMarkdown: PasteMarkdownMethods
}

export type PasteMarkdownPluginCustomTypes = {
  Name: "paste-markdown"
  Editor: PasteMarkdownEditor
}

export const PasteMarkdownPlugin = createPlugin<PasteMarkdownPluginCustomTypes>(
  (editor) => {
    editor.pasteMarkdown = createPasteMarkdownMethods(editor)
    return {
      name: "paste-markdown",
      editor: {},
      editableProps: {
        onPaste(e) {
          const data = e.clipboardData
          const html = data.getData("text/html")
          // Slate's own fragment preserves block metadata and rectangular cells.
          if (data.files.length || data.getData("application/x-slate-fragment") || /\bdata-slate-fragment\s*=/i.test(html)) return false
          // Browser plain text omits headings, list markers and inline marks.
          // Convert HTML first so its block spacing is parsed as Markdown, rather
          // than turning every newline of the fallback text into a paragraph.
          const markdown = html ? clipboardHtmlToMarkdown(html) : data.getData("text/plain")
          if (!markdown) return false
          editor.pasteMarkdown.pasteMarkdown(markdown)
          stopEvent(e)
          return true
        },
      },
    }
  }
) as TypedPlugin<PasteMarkdownPluginCustomTypes>
