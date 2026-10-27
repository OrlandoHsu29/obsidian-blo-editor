import { Editor, Element, Node, Path } from 'slate'
import { HistoryEditor } from 'slate-history'
import { fetchLinkTitle } from './remote-link-title'

/** Update only the original, unchanged link after the asynchronous request. */
export async function updateLinkTitle(editor: Editor, path: Path, doc: Document): Promise<'updated' | 'unavailable' | 'stale'> {
  const node = Node.get(editor, path)
  if (!Element.isElement(node) || node.type !== 'anchor' || editor.wysimark.readOnly) return 'stale'
  const href = node.href, text = Node.string(node), title = node.title
  const isCurrentDocument = editor.wysimark.isCurrentDocument
  const ref = Editor.pathRef(editor, path)
  try {
    const result = await fetchLinkTitle(href, doc)
    const at = ref.current
    if (!at || editor.wysimark.readOnly || isCurrentDocument?.() === false || !Node.has(editor, at)) return 'stale'
    const current = Node.get(editor, at)
    if (!Element.isElement(current) || current.type !== 'anchor' || current.href !== href || current.title !== title || Node.string(current) !== text) return 'stale'
    if (!result) return 'unavailable'
    if (result === text) return 'updated'
    const apply = () => editor.anchor.editLink({ href, title, text: result }, { at })
    if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, apply)
    else apply()
    return 'updated'
  } finally { ref.unref() }
}
