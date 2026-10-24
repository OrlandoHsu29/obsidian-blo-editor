import { App, Modal, Notice, Setting, TFile } from 'obsidian'
import { attachmentPath, normalizeAttachmentFolder } from './attachments'
import { ui } from './wysimark/utils/translations'

/** Save a distinct vault copy; never replace the source drawing or its embed. */
export class DrawingSaveAsModal extends Modal {
  private busy = false
  constructor(app: App, private file: TFile) { super(app) }
  onOpen() {
    this.setTitle(ui('画板另存为'))
    const extension = this.file.path.endsWith('.excalidraw.md') ? '.excalidraw.md' : '.' + this.file.extension
    const stem = this.file.name.slice(0, -extension.length)
    let value = `${this.file.parent?.path === '/' ? '' : (this.file.parent?.path || '') + '/'}${stem} - ${ui('副本')}${extension}`
    let input: HTMLInputElement
    new Setting(this.contentEl).setName(ui('保存路径')).setDesc(ui('相对于知识库根目录；保存副本，不替换当前引用。'))
      .addText(text => { input = text.inputEl; text.setValue(value).onChange(next => { value = next; input.setCustomValidity('') }) })
    new Setting(this.contentEl).addButton(button => button.setButtonText(ui('取消')).onClick(() => this.close()))
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
        this.busy = true; button.setDisabled(true)
        try {
          for (const leaf of this.app.workspace.getLeavesOfType('excalidraw')) {
            const view = leaf.view as typeof leaf.view & { file?: TFile; forceSave?: () => Promise<void> }
            if (view.file === this.file) await view.forceSave?.()
          }
          const path = await attachmentPath(this.app, folder, filename)
          await this.app.vault.copy(this.file, path)
          new Notice(ui('画板已另存为：{path}', { path }))
          this.close()
        } catch (error) {
          console.error('Blo Editor: could not save drawing copy', error)
          new Notice(ui('无法另存为画板'))
        } finally { this.busy = false; button.setDisabled(false) }
      }))
  }
  onClose() { this.contentEl.empty() }
}
