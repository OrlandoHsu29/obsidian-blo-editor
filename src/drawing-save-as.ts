import { App, Modal, Notice, Setting, TFile } from 'obsidian'
import { attachmentPath, normalizeAttachmentFolder } from './attachments'
import { ui } from './wysimark/utils/translations'
import { Editor, Element, Node, PathRef, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import { ReactEditor } from 'slate-react'
import { splitWikiSpec, wikiEmbedSpecFromUrl, wikiEmbedUrl, isWikiEmbedUrl } from './wysimark/convert/obsidian-links'

export type DrawingReference = { editor: Editor; source: TFile; path: PathRef; url: string }
export function copyDrawingReference(reference?: DrawingReference): DrawingReference | undefined {
  return reference?.path.current ? { ...reference, path: Editor.pathRef(reference.editor, reference.path.current) } : undefined
}
export function trackDrawingReference(app: App, sourcePath: string, editor: Editor, element: Element): DrawingReference | undefined {
  const source = app.vault.getAbstractFileByPath(sourcePath)
  if (!(source instanceof TFile) || (element.type !== 'image-block' && element.type !== 'image-inline')) return
  try { return { editor, source, url: element.url, path: Editor.pathRef(editor, ReactEditor.findPath(editor, element)) } }
  catch { return }
}

export const DRAWING_SAVE_AS_ICON = 'blo-drawing-save-as'
// Obsidian wraps custom icons in a 100×100 viewBox; the path uses 24×24 units.
export const DRAWING_SAVE_AS_SVG = '<g transform="scale(4.1666666667)" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 11V5l-2-2H5v18h7M8 3v6h8V3M8 21v-8h5m4 1v8m-4-4h8" /></g>'

/** Save a distinct vault copy, optionally updating the originating embed. */
export class DrawingSaveAsModal extends Modal {
  private busy = false
  private reference?: DrawingReference
  private expectedUrl?: string
  constructor(app: App, private file: TFile, reference?: DrawingReference) {
    super(app)
    this.reference = copyDrawingReference(reference)
    this.expectedUrl = this.reference?.url
  }
  private canReplace() {
    const reference = this.reference, path = reference?.path.current
    if (!reference || !path || reference.editor.wysimark.readOnly || !Node.has(reference.editor, path) ||
      this.app.vault.getAbstractFileByPath(reference.source.path) !== reference.source) return false
    try { if (!ReactEditor.toDOMNode(reference.editor, reference.editor).isConnected) return false } catch { return false }
    const node = Node.get(reference.editor, path)
    return Element.isElement(node) && (node.type === 'image-block' || node.type === 'image-inline') && node.url === this.expectedUrl
  }
  onOpen() {
    this.setTitle(ui('画板另存为'))
    const extension = this.file.path.endsWith('.excalidraw.md') ? '.excalidraw.md' : '.' + this.file.extension
    const stem = this.file.name.slice(0, -extension.length)
    let value = `${this.file.parent?.path === '/' ? '' : (this.file.parent?.path || '') + '/'}${stem} - ${ui('副本')}${extension}`
    let input: HTMLInputElement
    let replaceReference = false
    new Setting(this.contentEl).setName(ui('保存路径')).setDesc(ui('相对于知识库根目录；保存为新的画板文件。'))
      .addText(text => { input = text.inputEl; text.setValue(value).onChange(next => { value = next; input.setCustomValidity('') }) })
    const actions = new Setting(this.contentEl)
    const label = actions.infoEl.createEl('label', { cls: 'blo-drawing-replace-reference' })
    const checkbox = label.createEl('input', { type: 'checkbox' })
    checkbox.checked = false; checkbox.disabled = !this.canReplace()
    checkbox.addEventListener('change', () => { replaceReference = checkbox.checked })
    label.createSpan({ text: ui('另存后替换当前引用') })
    actions.addButton(button => button.setButtonText(ui('取消')).onClick(() => this.close()))
      .addButton(button => button.setButtonText(ui('另存为')).setCta().onClick(async () => {
        if (this.busy) return
        let folder: string, filename: string
        try {
          const path = value.trim().replace(/\\/g, '/')
          const slash = path.lastIndexOf('/')
          folder = normalizeAttachmentFolder(slash < 0 ? '' : path.slice(0, slash) || '/')
          filename = path.slice(slash + 1)
          if (!filename || /[\\/:*?"<>|]/.test(filename) || !filename.endsWith(extension)) throw new Error('Invalid drawing path')
        } catch {
          input!.setCustomValidity(ui('请填写有效的画板相对路径，并保留原扩展名'))
          input!.reportValidity(); return
        }
        this.busy = true; button.setDisabled(true); checkbox.disabled = true
        try {
          for (const leaf of this.app.workspace.getLeavesOfType('excalidraw')) {
            const view = leaf.view as typeof leaf.view & { file?: TFile; forceSave?: () => Promise<void> }
            if (view.file === this.file) await view.forceSave?.()
          }
          const path = await attachmentPath(this.app, folder, filename)
          const copy = await this.app.vault.copy(this.file, path)
          if (replaceReference) {
            if (this.canReplace()) {
              const reference = this.reference!, editor = reference.editor
              const parts = isWikiEmbedUrl(this.expectedUrl!) ? splitWikiSpec(wikiEmbedSpecFromUrl(this.expectedUrl!)) : undefined
              const hash = !this.file.path.includes('#') ? parts?.target.indexOf('#') ?? -1 : -1
              const suffix = hash >= 0 ? parts!.target.slice(hash) : ''
              const target = this.app.metadataCache.fileToLinktext(copy, reference.source.path, false)
              const url = wikiEmbedUrl(target + suffix + (parts?.display ? '|' + parts.display : ''))
              const update = () => Transforms.setNodes(editor, { url }, { at: reference.path.current! })
              if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, update)
              else update()
              await editor.wysimark.save?.()
            } else new Notice(ui('副本已保存，原引用已不可用，未替换。'))
          }
          new Notice(ui('画板已另存为：{path}', { path }))
          this.close()
        } catch (error) {
          console.error('Blo Editor: could not save drawing copy', error)
          new Notice(ui('无法另存为画板'))
        } finally { this.busy = false; button.setDisabled(false); checkbox.disabled = !this.canReplace() }
      }))
  }
  onClose() { this.reference?.path.unref(); this.contentEl.empty() }
}
