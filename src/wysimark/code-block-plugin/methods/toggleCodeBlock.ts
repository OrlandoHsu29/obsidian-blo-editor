import { Editor, Node, Path, Range, Transforms } from "slate"

import { findElementUp, insertRootElement } from "../../sink"
import { isListItem } from "../../list-plugin"
import type { ListItemElement } from "../../list-plugin"
import { convertCodeBlockToParagraph } from "./convertCodeBlockToParagraph"
import { createCodeBlock } from "./createCodeBlock"

export function toggleCodeBlock(editor: Editor) {
  if (convertCodeBlockToParagraph(editor)) return
  const listEntry = findElementUp<ListItemElement>(editor, isListItem)
  if (listEntry && !listEntry[0].blockChildren && editor.selection &&
      Path.isAncestor(listEntry[1], editor.selection.anchor.path) && Path.isAncestor(listEntry[1], editor.selection.focus.path)) {
    const [list, path] = listEntry, [start, end] = Range.edges(editor.selection)
    const expanded = Range.isExpanded(editor.selection)
    const selected = expanded ? Editor.string(editor, editor.selection) : Node.string(list)
    const fragment = (range: Range) => {
      if (Range.isCollapsed(range)) return []
      const root = Editor.fragment(editor, range)[0]
      return root ? Array.from(Node.elements(root)).filter(([node]) => isListItem(node)).at(-1)?.[0].children ?? [] : []
    }
    const before = expanded ? fragment({ anchor: Editor.start(editor, path), focus: start }) : []
    const after = expanded ? fragment({ anchor: end, focus: Editor.end(editor, path) }) : []
    const children = [
      ...(before.length ? [{ type: 'paragraph' as const, children: before }] : []),
      { type: 'code-block' as const, language: 'text', children: selected.split('\n').map(text => ({ type: 'code-block-line' as const, children: [{ text }] })) },
      ...(after.length ? [{ type: 'paragraph' as const, children: after }] : []),
    ]
    const codeIndex = before.length ? 1 : 0
    Editor.withoutNormalizing(editor, () => {
      Transforms.removeNodes(editor, { at: path })
      Transforms.insertNodes(editor, { ...list, blockChildren: true, children }, { at: path })
      Transforms.select(editor, Editor.range(editor, [...path, codeIndex]))
    })
    return
  }
  if (editor.selection && Range.isExpanded(editor.selection)) {
    // A fragment trims the boundary blocks to the selection. Join its leaf
    // blocks explicitly because Node.string omits separators between blocks.
    const text = Editor.fragment(editor, editor.selection)
      .flatMap((node) =>
        Array.from(Node.elements(node))
          .filter(([element]) =>
            Editor.isBlock(editor, element) && Editor.hasInlines(editor, element)
          )
          .map(([element]) => Node.string(element))
      )
      .join("\n")
    insertRootElement(editor, {
      type: "code-block",
      language: "text",
      children: text.split("\n").map((line) => ({
        type: "code-block-line",
        children: [{ text: line }],
      })),
    }, { select: true })
    return
  }
  createCodeBlock(editor, { language: "text" })
}
