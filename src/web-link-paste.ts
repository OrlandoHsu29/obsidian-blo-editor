import { Editor, Element, Node } from 'slate'
import type { Descendant } from 'slate'
import { HistoryEditor } from 'slate-history'
import { Notice } from 'obsidian'
import { clipboardUrlLink, insertPastedLink, remoteMediaUrl } from './media-url-paste'
import { fetchLinkTitle } from './remote-link-title'
import { ui } from './wysimark/utils/translations'

export function clipboardWebLink(data: Pick<DataTransfer, 'getData'>) {
  return clipboardUrlLink(data, value => {
    const text = value.trim()
    if (/\s/.test(text) || remoteMediaUrl(text)) return
    try { if (/^https?:$/.test(new URL(text).protocol)) return text } catch { /* Normal paste handles other text. */ }
  })
}

/** Insert the link immediately and update its label when the page title arrives. */
export function createWebUrlPaste(editor: Editor, url: string, doc: Document, label = url, fragment?: Descendant[]) {
  const path = insertPastedLink(editor, url, label, fragment)
  if (!path) return
  const ref = Editor.pathRef(editor, path)
  const isCurrentDocument = editor.wysimark.isCurrentDocument
  let expected = Node.string(Node.get(editor, path))
  let mode: 'url' | 'title' = 'url', title: string | undefined
  let disposed = false, pending = false
  let request: Promise<void> | undefined
  const current = () => {
    if (editor.wysimark.readOnly || isCurrentDocument?.() === false || !ref.current || !Node.has(editor, ref.current)) return false
    const node = Node.get(editor, ref.current)
    return Element.isElement(node) && node.type === 'anchor' && node.href === url && Node.string(node) === expected
  }
  const apply = (text: string) => {
    if (!current() || text === expected) return
    const at = ref.current!, node = Node.get(editor, at)
    if (!Element.isElement(node) || node.type !== 'anchor') return
    const change = () => editor.anchor.editLink({ href: url, title: node.title, text }, { at })
    if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, change)
    else change()
    expected = text
  }
  return {
    path: ref,
    kind: 'web' as const,
    get choice() { return mode === 'title' && title ? 'title' as const : 'url' as const },
    current,
    choose(value: 'url' | 'title') {
      if (disposed) return Promise.resolve()
      mode = value
      if (mode === 'url') { apply(url); return Promise.resolve() }
      if (request) { if (!pending && title) apply(title); return request }
      pending = true
      request = fetchLinkTitle(url, doc).then(result => {
        title = result
        if (mode !== 'title') return
        if (title) apply(title)
        else if (current()) new Notice(ui('链接标题获取失败'))
      }).finally(() => { pending = false; if (disposed) ref.unref() })
      return request
    },
    dispose() { disposed = true; if (!pending) ref.unref() },
  }
}
export type WebUrlPaste = NonNullable<ReturnType<typeof createWebUrlPaste>>
