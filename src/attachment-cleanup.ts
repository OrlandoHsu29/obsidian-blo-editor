import { App, Notice, TFile } from 'obsidian'
import { Descendant, Editor, Element } from 'slate'
import { isDrawingFile } from './drawings'
import { isWikiEmbedUrl, wikiEmbedSpecFromUrl, wikiLinkTarget } from './wysimark/convert/obsidian-links'
import { ui } from './wysimark/utils/translations'
import type { EditorSettings } from './settings'
import { attachmentRestored } from './wysimark/image-plugin/attachment-revision'

const IMAGE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'])

function imageUrls(nodes: Descendant[]): string[] {
  const urls: string[] = []
  const visit = (node: Descendant) => {
    if (!Element.isElement(node)) return
    if (node.type === 'image-block' || node.type === 'image-inline') urls.push(node.url)
    for (const child of node.children) visit(child)
  }
  for (const node of nodes) visit(node)
  return urls
}

/** Observe actual removals, so moving blocks, initial loading and ordinary edits never delete files. */
export function watchAttachments(app: App, source: TFile, editor: Editor, settings: () => EditorSettings): () => void {
  type RemovedAttachment = { file: TFile; drawing: boolean; urls: Set<string>; content?: ArrayBuffer; deleted: boolean }
  const records = new Map<string, RemovedAttachment>()
  const resolve = (url: string, sourcePath = source.path) => {
    let target = url
    if (isWikiEmbedUrl(url)) target = wikiLinkTarget(wikiEmbedSpecFromUrl(url))
    else {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)) return null
      try { target = decodeURIComponent(url) } catch { /* Keep literal filenames. */ }
    }
    return app.metadataCache.getFirstLinkpathDest(target.split('#')[0], sourcePath)
  }
  const enabled = (record: RemovedAttachment) => record.drawing ? settings().deleteDrawingAttachments : settings().deleteImageAttachments
  const present = (record: RemovedAttachment, candidate: Editor = editor, sourcePath = source.path) => imageUrls(candidate.children).some(url =>
    (record.urls.has(url) && candidate === editor) || resolve(url, sourcePath)?.path === record.file.path)
  const shared = (record: RemovedAttachment) => {
    for (const [path, links] of Object.entries(app.metadataCache.resolvedLinks)) {
      if (path !== source.path && links[record.file.path]) return true
    }
    return app.workspace.getLeavesOfType('blo-view').some(leaf => {
      const view = leaf.view as typeof leaf.view & { editor?: Editor; currentFile?: TFile }
      return view.editor && view.editor !== editor && present(record, view.editor, view.currentFile?.path)
    })
  }
  let pending = Promise.resolve(), disposed = false
  const synchronize = (record: RemovedAttachment) => {
    pending = pending.then(async () => {
      if (present(record)) {
        if (record.deleted && record.content !== undefined) {
          if (app.vault.getAbstractFileByPath(record.file.path)) return
          record.file = await app.vault.createBinary(record.file.path, record.content)
          record.deleted = false; record.content = undefined
          attachmentRestored(editor, record.urls)
        }
        return
      }
      if (!enabled(record) || record.deleted || shared(record) || app.vault.getAbstractFileByPath(record.file.path) !== record.file) return
      for (const leaf of app.workspace.getLeavesOfType('excalidraw')) {
        const view = leaf.view as typeof leaf.view & { file?: TFile; forceSave?: () => Promise<void> }
        if (view.file === record.file) await view.forceSave?.()
      }
      const content = await app.vault.readBinary(record.file)
      await editor.wysimark.save?.()
      if (!enabled(record) || present(record) || shared(record)) return
      record.content = content
      // Use Obsidian's local trash, retaining recoverability even after this editor closes.
      await app.vault.trash(record.file, false)
      record.deleted = true
    }).catch(error => {
      console.error('Blo Editor: attachment cleanup failed', error)
      new Notice(ui('无法同步附件，请检查附件文件'))
    }).finally(() => { if (disposed) records.clear() })
  }
  const apply = editor.apply
  const wrapped: Editor['apply'] = operation => {
    const affected = new Set<RemovedAttachment>()
    if (!editor.wysimark.readOnly && (records.size || settings().deleteDrawingAttachments || settings().deleteImageAttachments) &&
      (operation.type === 'remove_node' || operation.type === 'insert_node') && Element.isElement(operation.node)) {
      for (const url of imageUrls([operation.node])) {
        let record = Array.from(records.values()).find(record => record.urls.has(url))
        if (!record && operation.type === 'remove_node') {
          const file = resolve(url)
          if (file) {
            const drawing = isDrawingFile(app, file)
            const allowed = drawing ? settings().deleteDrawingAttachments : settings().deleteImageAttachments && IMAGE_EXTENSIONS.has(file.extension.toLowerCase())
            if (allowed) {
              record = records.get(file.path) ?? { file, drawing, urls: new Set(), deleted: false }
              records.set(file.path, record)
            }
          }
        }
        if (record) { record.urls.add(url); affected.add(record) }
      }
    }
    apply(operation)
    for (const record of affected) synchronize(record)
  }
  editor.apply = wrapped
  return () => {
    disposed = true
    if (editor.apply === wrapped) editor.apply = apply
    void pending.finally(() => records.clear())
  }
}
