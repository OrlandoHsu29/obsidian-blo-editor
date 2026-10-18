import { Editor, Element, Range, Transforms } from "slate"

import { curryOne } from "../../sink"

import { parse } from "../../convert"

function pasteMarkdown(editor: Editor, markdown: string) {

  const fragment = parse(markdown)
  for (const element of fragment) {
    delete element.__markdownLeadingNewlines
    delete element.__markdownTrailingNewlines
  }
  // Paragraph fragments merge their edges with the text around the selection.
  // Explicit Markdown blocks (headings, tables, etc.) retain their own structure.
  const emptyParagraph = editor.selection && Range.isCollapsed(editor.selection) &&
    Editor.above(editor, { match: node => Element.isElement(node) && node.type === "paragraph" && Editor.isEmpty(editor, node) })
  if (emptyParagraph || fragment.every(element => element.type === "paragraph")) {
    editor.insertFragment(fragment)
  } else {
    Transforms.insertNodes(editor, fragment)
  }
}

export function createPasteMarkdownMethods(editor: Editor) {
  return {
    pasteMarkdown: curryOne(pasteMarkdown, editor),
  }
}
