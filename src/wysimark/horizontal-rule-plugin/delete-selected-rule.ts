import { Editor, Element, Range, Transforms } from "slate"
import { HistoryEditor } from "slate-history"

/** A selected rule is atomic, even next to a protected table or code block. */
export function deleteSelectedRule(editor: Editor): boolean {
  if (editor.wysimark.readOnly || !editor.selection || !Range.isCollapsed(editor.selection)) return false
  const entry = Editor.above(editor, {
    match: node => Element.isElement(node) && node.type === "horizontal-rule",
    voids: true,
  })
  if (!entry) return false
  const remove = () => Editor.withoutNormalizing(editor, () => {
    Transforms.removeNodes(editor, { at: entry[1], voids: true })
    if (!editor.children.length) {
      Transforms.insertNodes(editor, {
        type: "paragraph", children: [{ text: "" }],
      }, { at: [0] })
      Transforms.select(editor, Editor.start(editor, [0]))
    }
  })
  if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, remove)
  else remove()
  return true
}
