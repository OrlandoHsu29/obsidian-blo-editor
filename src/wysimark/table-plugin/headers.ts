import { Editor, Element, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import { TableElement } from './types'

export function setTableHeader(editor: Editor, key: 'headerRow'|'headerColumn', enabled: boolean) {
  if(editor.wysimark.readOnly||!editor.selection)return
  const entry=Editor.above<TableElement>(editor,{match:n=>Element.isElement(n)&&n.type==='table'})
  if(!entry)return
  const run=()=>Transforms.setNodes(editor,{[key]:enabled},{at:entry[1]})
  if(HistoryEditor.isHistoryEditor(editor))HistoryEditor.withNewBatch(editor,run);else run()
}
