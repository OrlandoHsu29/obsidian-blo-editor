import { Editor, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import { ReactEditor } from 'slate-react'
import { clearBlockSelection } from './selection'

/** Enter from the file title creates an editable paragraph before any block. */
export function insertDocumentStartParagraph(editor: Editor): void {
  if (editor.wysimark.readOnly) return
  clearBlockSelection(editor)
  const insert = () => Editor.withoutNormalizing(editor, () => {
    // Explicit root metadata keeps this intentional empty block on reload;
    // ordinary leading Markdown whitespace is otherwise only source padding.
    Transforms.insertNodes(editor, { type: 'paragraph', __blockDepth: 0, children: [{ text: '' }] }, { at: [0] })
    Transforms.select(editor, Editor.start(editor, [0]))
    editor.marks = null
  })
  if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, insert)
  else insert()
  ReactEditor.focus(editor)
}
