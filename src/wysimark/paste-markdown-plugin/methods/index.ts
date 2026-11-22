import { Editor, Element, Range, Transforms } from "slate"

import { curryOne } from "../../sink"

import { parse } from "../../convert"
import { pasteTableFragment } from '../../table-plugin/paste-table'
import { deleteMixedTableSelection } from '../../table-plugin/mixed-selection'

function pasteMarkdown(editor: Editor, markdown: string, fromHtml = false) {
  const fragment = parse(markdown, { enableInternalLinks: true, collapseListGaps: fromHtml })
  for (const element of fragment) {
    delete element.__markdownLeadingNewlines
    delete element.__markdownTrailingNewlines
  }
  if (pasteTableFragment(editor, fragment)) return
  // Paragraph fragments merge their edges with the text around the selection.
  // Explicit Markdown blocks (headings, tables, etc.) retain their own structure.
  const emptyParagraph = editor.selection && Range.isCollapsed(editor.selection) &&
    Editor.above(editor, { match: node => Element.isElement(node) && node.type === "paragraph" && Editor.isEmpty(editor, node) })
  if (emptyParagraph || fragment.every(element => element.type === "paragraph")) {
    editor.insertFragment(fragment)
  } else {
    const insert = () => Transforms.insertNodes(editor, fragment)
    if (!deleteMixedTableSelection(editor, insert)) insert()
  }
}

export function createPasteMarkdownMethods(editor: Editor) {
  return {
    pasteMarkdown: curryOne(pasteMarkdown, editor),
  }
}
