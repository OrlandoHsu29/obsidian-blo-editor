import { Editor, Node, NodeEntry, Transforms } from "slate"
import { HistoryEditor } from "slate-history"

import { TableElement } from "../types"

export function normalizeTableIndexes(
  editor: Editor,
  entry: NodeEntry<TableElement>
): boolean {
  const [table, path] = entry
  if (!Node.has(editor, path) || Node.get(editor, path) !== table) return false

  let isTransformed = false
  // Coordinates are derived from structure, not user-editable table settings.
  // Mount-time repairs must not merge into the first edit's undo batch.
  Editor.withoutNormalizing(editor, () => HistoryEditor.withoutSaving(editor, () => {
    table.children.forEach((rowElement, y) => {
      rowElement.children.forEach((cellElement, x) => {
        if (cellElement.x !== x || cellElement.y !== y) {
          Transforms.setNodes(editor, { x, y }, { at: [...path, y, x] })
          isTransformed = true
        }
      })
    })
  }))
  return isTransformed
}
