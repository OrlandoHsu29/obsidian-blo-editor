import { App, Notice } from 'obsidian'
import { Descendant, Editor, Element, Node, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import { ReactEditor } from 'slate-react'
import type { OnImageSaveHandler } from './wysimark/entry'
import { wikiEmbedUrl, wikiLinkHref } from './wysimark/convert/obsidian-links'
import { ui } from './wysimark/utils/translations'
import { IMAGE_FILE_PATTERN as IMAGES, MEDIA_FILE_PATTERN as MEDIA, vaultMediaUrl, vaultTransferReferences } from './vault-media'

/** Reference existing vault files directly; never copy them into attachments. */
export function handleVaultMediaTransfer(app: App, sourcePath: string, editor: Editor,
  event: ClipboardEvent | DragEvent, current: () => boolean): boolean {
  if (!current() || editor.wysimark.readOnly) return false
  const data = 'clipboardData' in event ? event.clipboardData : event.dataTransfer
  if (!data) return false
  const drop = 'dataTransfer' in event
  let location = editor.selection
  if (drop) {
    try { location = ReactEditor.findEventRange(editor, event) }
    catch { location = Editor.range(editor, Editor.end(editor, [])) }
  }
  if (location && (Node.leaf(editor, location.anchor.path).code ||
    Editor.above(editor, { at: location, match: node => Element.isElement(node) && node.type === 'code-block' }))) return false
  if (!drop && Editor.marks(editor)?.code) return false
  const references = vaultTransferReferences(app, sourcePath, data, drop)
  if (!references.length) return false
  event.preventDefault(); event.stopPropagation()
  if (drop && location) Transforms.select(editor, location)
  const fragment: Descendant[] = references.map(reference => {
    const url = vaultMediaUrl(app, sourcePath, reference), label = reference.display || reference.file.name
    return url ? { type: 'image-block', url, alt: label, children: [{ text: '' }] } :
      { type: 'paragraph', children: [{ type: 'anchor', href: wikiLinkHref(reference.target), children: [{ text: label }] }] }
  })
  const insert = () => Editor.withoutNormalizing(editor, () => {
    if (!editor.selection) Transforms.select(editor, Editor.end(editor, []))
    editor.insertFragment(fragment)
    editor.marks = null
  })
  if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, insert)
  else insert()
  ReactEditor.focus(editor)
  return true
}

/** File transfers take precedence over HTML/text fallbacks; internal Slate copies keep their metadata. */
export function handleMediaTransfer(editor: Editor, event: ClipboardEvent | DragEvent,
  save: OnImageSaveHandler, current: () => boolean): boolean {
  if (editor.wysimark.readOnly) return false
  const data = 'clipboardData' in event ? event.clipboardData : event.dataTransfer
  if (!data || data.getData('application/x-slate-fragment') || /\bdata-slate-fragment\s*=/i.test(data.getData('text/html'))) return false
  const files = Array.from(data.files)
  if (!files.length) for (const item of Array.from(data.items ?? [])) {
    if (item.kind === 'file') { const file = item.getAsFile(); if (file) files.push(file) }
  }
  if (!files.length) return false
  event.preventDefault(); event.stopPropagation()
  if ('dataTransfer' in event) {
    try { Transforms.select(editor, ReactEditor.findEventRange(editor, event)) }
    catch { Transforms.select(editor, Editor.end(editor, [])) }
  }
  const location = Editor.rangeRef(editor, editor.selection ?? Editor.range(editor, Editor.end(editor, [])), { affinity: 'forward' })
  const insert = async () => {
    const fragment: Descendant[] = []
    for (const file of files) {
      if (!current()) break
      try {
        const url = await save(file, file.name)
        if (file.type.startsWith('image/') || IMAGES.test(file.name)) {
          fragment.push({ type: 'image-block', url, alt: file.name, children: [{ text: '' }] })
        } else if (/^(?:audio|video)\//.test(file.type) || MEDIA.test(file.name)) {
          fragment.push({ type: 'image-block', url: wikiEmbedUrl(decodeURI(url)), alt: file.name, children: [{ text: '' }] })
        } else {
          fragment.push({ type: 'paragraph', children: [{ type: 'anchor', href: url, children: [{ text: file.name }] }] })
        }
      } catch (error) {
        console.error('Blo Editor: attachment paste failed', error)
        new Notice(ui('无法插入附件：{name}', { name: file.name }))
      }
    }
    if (!fragment.length) return
    if (!current() || !location.current) { new Notice(ui('附件已保存，原插入位置已失效')); return }
    const apply = () => Editor.withoutNormalizing(editor, () => {
      Transforms.select(editor, location.current!)
      editor.insertFragment(fragment)
      editor.marks = null
    })
    if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, apply)
    else apply()
  }
  void insert().catch(error => console.error('Blo Editor: attachment insertion failed', error)).finally(() => location.unref())
  return true
}
