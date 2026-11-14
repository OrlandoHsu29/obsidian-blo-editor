import { Editor, Element, Range, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import { formatSelectedTableCells, selectedCellTextEntries } from '../../table-plugin/cell-selection'
import { clearSelectedBlockStyles } from '../../../blocks/clear-formatting'
import { removeMarks } from './removeMarks'

/** Clear text and paragraph presentation, retaining content, links, media and tables. */
export function clearFormatting(editor: Editor) {
  if (!editor.selection || editor.wysimark.readOnly) return
  if (formatSelectedTableCells(editor, selected => {
    for (let y = selected.bottom; y >= selected.top; y--) for (let x = selected.right; x >= selected.left; x--) {
      Transforms.unwrapNodes(editor, { at: [...selected.path, y, x], match: node => Element.isElement(node) && node.type === 'inline-code' })
    }
    for (const [, path] of selectedCellTextEntries(editor, selected)) {
      Transforms.unsetNodes(editor, ['bold','italic','underline','strike','code','highlight','inlineStyle','kbd','sup','sub'], { at: path })
    }
  })) return
  const run=()=>Editor.withoutNormalizing(editor,()=>{
    const collapsed = Range.isCollapsed(editor.selection!)
    const caret = collapsed ? Editor.pointRef(editor, editor.selection!.anchor) : undefined
    const cell = collapsed && Editor.above(editor, { match: node => Element.isElement(node) && node.type === 'table-cell' })
    const target = Editor.rangeRef(editor, collapsed ? Editor.range(editor, cell ? cell[1] : [editor.selection!.anchor.path[0]]) : editor.selection!, { affinity: 'inward' })
    try {
      clearSelectedBlockStyles(editor, target.current!)
      Transforms.unwrapNodes(editor, { at: target.current!, match: node => Element.isElement(node) && node.type === 'inline-code', split: true })
      removeMarks(editor, { at: target.current! })
      editor.activeMarks = {}
      if (caret?.current) Transforms.select(editor, caret.current)
      if (collapsed) editor.marks = {}
    } finally { caret?.unref(); target.unref() }
  })
  if(HistoryEditor.isHistoryEditor(editor))HistoryEditor.withNewBatch(editor,run)
  else run()
}
