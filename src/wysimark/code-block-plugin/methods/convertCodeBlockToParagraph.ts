import { Editor, Node, Path, Point, Transforms } from "slate"

import { findElementUp } from "../../sink"
import type { CodeBlockElement } from "../types"
import { isListItem } from '../../list-plugin'
import { blockDepth } from '../../../blocks/model'

export function convertCodeBlockToParagraph(editor: Editor): boolean {
  const entry = findElementUp<CodeBlockElement>(editor, "code-block")
  if (!entry) return false
  const [block, path] = entry
  const lines = block.children.map((line) => Node.string(line))
  const mapPoint = (point: Point): Point => {
    if (!Path.isAncestor(path, point.path)) return point
    const lineIndex = point.path[path.length]
    const linePath = [...path, lineIndex]
    const offset = lines.slice(0, lineIndex)
      .reduce((sum, line) => sum + line.length + 1, 0)
      + Editor.string(editor, { anchor: Editor.start(editor, linePath), focus: point }).length
    return { path: [...path, 0], offset }
  }
  const selection = editor.selection && {
    anchor: mapPoint(editor.selection.anchor),
    focus: mapPoint(editor.selection.focus),
  }
  Editor.withoutNormalizing(editor, () => {
    Transforms.removeNodes(editor, { at: path })
    Transforms.insertNodes(
      editor,
      { type: "paragraph", __blockDepth: blockDepth(block), children: [{ text: lines.join("\n") }] },
      { at: path }
    )
    if (selection) Transforms.select(editor, selection)
    const parentPath = Path.parent(path)
    if (parentPath.length) {
      const parent = Node.get(editor, parentPath)
      if (isListItem(parent) && parent.blockChildren && parent.children.length === 1 &&
          'type' in parent.children[0] && parent.children[0].type === 'paragraph') {
        const child = parent.children[0], active = editor.selection
        Transforms.removeNodes(editor, { at: parentPath })
        const { blockChildren: _unused, ...simple } = parent
        void _unused
        Transforms.insertNodes(editor, { ...simple, children: child.children }, { at: parentPath })
        if (active) Transforms.select(editor, {
          anchor: { path: [...parentPath, ...active.anchor.path.slice(parentPath.length + 1)], offset: active.anchor.offset },
          focus: { path: [...parentPath, ...active.focus.path.slice(parentPath.length + 1)], offset: active.focus.offset },
        })
      }
    }
  })
  return true
}
