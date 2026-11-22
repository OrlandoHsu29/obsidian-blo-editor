import { Editor, Element, Node, Range, Text, Transforms } from "slate"
import { HistoryEditor } from "slate-history"
import { createPlugin, TypedPlugin } from "../sink"
import { MathFormula } from "./MathFormula"
import { editMath } from "./editing"
import type { MathElement, MathPluginCustomTypes } from "./types"
import { materializeTextBoundary } from "../../blocks/boundary"
import { mathSelectionSource } from './selection-source'
import { restoreInlineMathText, selectedInlineMath } from './inline-text'
import { withHistoryBatch } from '../utils/with-history-batch'
import { selectionHasHeading } from '../../blocks/heading-policy'
import { withHeadingMathPolicy } from './heading-math'

const isMath = (node: unknown): node is MathElement => Element.isElement(node) && (node.type === "math-inline" || node.type === "math-block")
export function canInsertMath(editor: Editor): boolean {
  return !editor.wysimark.readOnly && !!editor.selection && !selectionHasHeading(editor) && !Editor.above(editor, {
    match: node => Element.isElement(node) && ['inline-code', 'code-block', 'html-block', 'link-definition'].includes(node.type),
  })
}
function editSelectedMath(editor: Editor) {
  const inserted = Editor.above<MathElement>(editor, { match: isMath })
  if (inserted) editMath(editor, inserted[0])
}

function insertInline(editor: Editor, fromMenu = false): boolean {
  if (!canInsertMath(editor)) return false
  const selected = selectedInlineMath(editor)
  if (selected) {
    if (fromMenu) editMath(editor, Node.get(editor, selected) as MathElement)
    else withHistoryBatch(editor, () => restoreInlineMathText(editor, selected))
    return true
  }
  const existing = Editor.above<MathElement>(editor, { match: isMath })
  if (existing) {
    const [node, path] = existing
    if (!fromMenu || node.type !== 'math-block') { editMath(editor, node); return true }
    withHistoryBatch(editor, () => {
      const { type: _type, latex, children: _children, ...metadata } = node
      Transforms.removeNodes(editor, { at: path })
      Transforms.insertNodes(editor, { ...metadata, type: 'paragraph',
        children: [{ type: 'math-inline', latex, children: [{ text: '' }] }] }, { at: path })
      Transforms.select(editor, Editor.start(editor, [...path, 0]))
    })
    editSelectedMath(editor)
    return true
  }
  const latex = mathSelectionSource(editor)
  HistoryEditor.withNewBatch(editor, () => Editor.withoutNormalizing(editor, () => {
    materializeTextBoundary(editor)
    Transforms.insertNodes(editor, { type: 'math-inline', latex, children: [{ text: '' }] }, { select: true })
  }))
  editSelectedMath(editor)
  return true
}

export function canInsertBlockMath(editor: Editor): boolean {
  if (!canInsertMath(editor)) return false
  const tables = Editor.nodes(editor, { match: node => Element.isElement(node) && node.type === 'table' })
  return !!tables.next().done
}

function insertBlock(editor: Editor): boolean {
  if (!canInsertBlockMath(editor)) return false
  const selection = editor.selection!
  const existing = Range.isCollapsed(selection) && Editor.above<MathElement>(editor, { match: isMath })
  if (existing && existing[0].type === 'math-block') { editMath(editor, existing[0]); return true }
  const inline = selectedInlineMath(editor)
  const latex = inline ? (Node.get(editor, inline) as MathElement).latex : mathSelectionSource(editor)
  const formula = { type: 'math-block' as const, latex, children: [{ text: '' }] }
  withHistoryBatch(editor, () => {
    if (inline) {
      const before = Editor.before(editor, inline)
      Transforms.removeNodes(editor, { at: inline })
      if (before) Transforms.select(editor, before)
    }
    const point = editor.selection?.anchor
    const at = point && [point.path[0]]
    const row = at && Node.get(editor, at)
    if (at && Element.isElement(row) && row.type === 'paragraph' &&
        Range.isCollapsed(editor.selection!) && row.children.every(child => Text.isText(child) && !child.text.trim())) {
      Transforms.removeNodes(editor, { at })
      Transforms.insertNodes(editor, { ...formula,
        ...(row.__blockDepth !== undefined ? { __blockDepth: row.__blockDepth } : {}),
        ...(row.__blockId ? { __blockId: row.__blockId } : {}),
      }, { at, select: true })
    } else {
      Transforms.insertNodes(editor, formula, { mode: 'highest', select: true })
    }
  })
  editSelectedMath(editor)
  return true
}

export const MathPlugin = createPlugin<MathPluginCustomTypes>((editor, _options, { createPolicy }) => {
  editor.math = { insertInline: fromMenu => insertInline(editor, fromMenu), insertBlock: () => insertBlock(editor) }
  withHeadingMathPolicy(editor)
  return createPolicy({
    name: "math",
    editor: {
      isInline: element => element.type === "math-inline" ? true : undefined,
      isVoid: element => isMath(element) ? true : undefined,
    },
    editableProps: {
      renderElement: props => isMath(props.element) ? <MathFormula {...props} element={props.element} /> : undefined,
      onKeyDown: event => {
        if (!['Enter', ' '].includes(event.key) || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing || editor.wysimark.readOnly) return false
        const entry = Editor.above<MathElement>(editor, { match: isMath })
        if (!entry) return false
        event.preventDefault(); editMath(editor, entry[0]); return true
      },
    },
  })
}) as TypedPlugin<MathPluginCustomTypes>
