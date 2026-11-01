import { Editor } from 'slate'
import { HistoryEditor } from 'slate-history'

/** A command updates structure and selection as one undo step. */
export function withHistoryBatch(editor: Editor, run: () => void): void {
  const apply = () => Editor.withoutNormalizing(editor, run)
  if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, apply)
  else apply()
}
