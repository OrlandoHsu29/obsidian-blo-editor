import { Editor, Element, Path, Range, Transforms } from "slate"
import { HistoryEditor } from "slate-history"

import { blockDepth } from "../../blocks/model"

/** Enter on a selected rule creates a real paragraph immediately below it. */
export function insertBreak(editor: Editor): boolean {
  if (editor.wysimark.readOnly || !editor.selection || !Range.isCollapsed(editor.selection)) return false
  const entry = Editor.above(editor, {
    match: node => Element.isElement(node) && node.type === "horizontal-rule",
    voids: true,
  })
  if (!entry) return false
  const [rule, path] = entry
  const nextPath = Path.next(path)
  const depth = blockDepth(rule)
  const indentation = depth || (Element.isElement(rule) && rule.__blockDepth !== undefined)
    ? { __blockDepth: depth } : {}
  const insert = () => Editor.withoutNormalizing(editor, () => {
    Transforms.insertNodes(editor, {
      type: "paragraph", ...indentation, children: [{ text: "" }],
    }, { at: nextPath })
    Transforms.select(editor, Editor.start(editor, nextPath))
    editor.marks = null
  })
  if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, insert)
  else insert()
  return true
}
