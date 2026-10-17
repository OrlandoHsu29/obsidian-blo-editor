import { Editor } from 'slate'
import { HistoryEditor } from 'slate-history'

/** Clear text presentation while retaining links, blocks, images and hard/soft breaks. */
export function clearFormatting(editor: Editor) {
  if (!editor.selection || editor.wysimark.readOnly) return
  const run=()=>Editor.withoutNormalizing(editor,()=>{
    for(const mark of ['bold','italic','underline','strike','code','highlight','inlineStyle','kbd','sup','sub']) Editor.removeMark(editor,mark)
  })
  if(HistoryEditor.isHistoryEditor(editor))HistoryEditor.withNewBatch(editor,run)
  else run()
}
