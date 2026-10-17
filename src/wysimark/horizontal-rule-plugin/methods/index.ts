import { Editor, Element, Node, Path, Range, Transforms } from "slate"
import { HistoryEditor } from "slate-history"

import { blockDepth } from "../../../blocks/model"
import { curryOne, findElementUp } from "../../sink"

function insertHorizontalRule(editor: Editor) {
  const { selection } = editor
  if (!selection || editor.wysimark.readOnly) return false
  const entry = findElementUp(editor, node => Element.isElement(node) && editor.isMaster(node))
  const root = editor.children[selection.anchor.path[0]]
  const depth = blockDepth(root)
  const indentation = depth || (Element.isElement(root) && root.__blockDepth !== undefined)
    ? { __blockDepth: depth } : {}
  const hrElement = {
    type: "horizontal-rule" as const,
    ...indentation,
    children: [{ text: "" }] as [{ text: string }],
  }
  const insert = () => Editor.withoutNormalizing(editor, () => {
    if (entry) {
      Transforms.insertNodes(editor, hrElement, { at: Path.next(entry[1]), select: true })
    } else if (Range.isCollapsed(selection) && Element.isElement(root) &&
      !editor.isVoid(root) && Node.string(root) === '') {
      // Replace the empty insertion block instead of leaving it above the rule.
      const at = [selection.anchor.path[0]]
      Transforms.removeNodes(editor, { at })
      Transforms.insertNodes(editor, hrElement, { at, select: true })
    } else {
      // Slate preserves the text on both sides when inserting in a paragraph.
      Transforms.insertNodes(editor, hrElement, { select: true })
    }
    const nextPath = Path.next(Path.parent(editor.selection!.anchor.path))
    const next = Node.has(editor, nextPath) ? Node.get(editor, nextPath) : null
    if (!next || !Element.isElement(next) || editor.isVoid(next) || editor.isMaster(next)) {
      Transforms.insertNodes(editor, {
        type: 'paragraph', ...indentation, children: [{ text: '' }],
      }, { at: nextPath })
    }
    // Reuse existing following text; only create a typing block when necessary.
    Transforms.select(editor, Editor.start(editor, nextPath))
    editor.marks = null
  })
  if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, insert)
  else insert()
  return true
}

export function createHorizontalRuleMethods(editor: Editor) {
  return {
    insertHorizontalRule: curryOne(insertHorizontalRule, editor),
  }
}