import { Editor, Element, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import { formatSelectedTableCells, selectedCellTextEntries } from '../../table-plugin/cell-selection'

/** Clear text presentation while retaining links, blocks, images and hard/soft breaks. */
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
    Transforms.unwrapNodes(editor, { match: node => Element.isElement(node) && node.type === 'inline-code', split: true })
    for(const mark of ['bold','italic','underline','strike','code','highlight','inlineStyle','kbd','sup','sub']) Editor.removeMark(editor,mark)
  })
  if(HistoryEditor.isHistoryEditor(editor))HistoryEditor.withNewBatch(editor,run)
  else run()
}
