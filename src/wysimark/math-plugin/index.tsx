import { Editor, Element, Transforms } from "slate"
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
function insertInline(editor: Editor): boolean {
  if (!canInsertMath(editor)) return false
  const selected = selectedInlineMath(editor)
  if (selected) { withHistoryBatch(editor, () => restoreInlineMathText(editor, selected)); return true }
  const existing = Editor.above<MathElement>(editor, { match: isMath })
  if (existing) { editMath(editor, existing[0]); return true }
  const latex = mathSelectionSource(editor)
  HistoryEditor.withNewBatch(editor, () => Editor.withoutNormalizing(editor, () => {
    materializeTextBoundary(editor)
    Transforms.insertNodes(editor, { type: 'math-inline', latex, children: [{ text: '' }] }, { select: true })
  }))
  const inserted = Editor.above<MathElement>(editor, { match: isMath })
  if (inserted) editMath(editor, inserted[0])
  return true
}
export const MathPlugin = createPlugin<MathPluginCustomTypes>((editor, _options, { createPolicy }) => {
  editor.math = { insertInline: () => insertInline(editor) }
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
