import { ButtonComponent, Modal, Notice, TFile, setIcon } from 'obsidian'
import type { BloView } from '../BloView'
import { PdfExportModal } from '../pdf-export'
import { ui } from '../wysimark/utils/translations'
import { exportContent } from './content'
import { htmlDocument, richContent } from './rich-content'

export class NoteExportModal extends Modal {
  private readonly file: TFile | null
  private busy = false
  private closed = false
  private transferred = false
  private buttons: ButtonComponent[] = []
  constructor(private view: BloView, private afterClose?: () => void) {
    super(view.app)
    this.file = view.currentFile
  }
  onOpen() {
    this.closed = false
    this.modalEl.addClass('blo-note-export-modal')
    this.titleEl.setText(ui('导出笔记'))
    const grid = this.contentEl.createDiv({ cls: 'blo-export-cards' })
    const card = (icon: string, title: string, description: string) => {
      const element = grid.createDiv({ cls: 'blo-export-card' })
      const main = element.createDiv({ cls: 'blo-export-card-main' })
      setIcon(main.createDiv({ cls: 'blo-export-card-icon' }), icon)
      const details = main.createDiv({ cls: 'blo-export-card-details' })
      details.createEl('h3', { text: title })
      details.createEl('p', { cls: 'blo-export-card-description', text: description })
      return element.createDiv({ cls: 'blo-export-card-actions' })
    }
    const button = (host: HTMLElement, label: string, action: () => Promise<void>, cta = false) => {
      const control = new ButtonComponent(host).setButtonText(label).onClick(() => { void this.run(action) })
      if (cta) control.setCta()
      this.buttons.push(control)
    }
    const markdown = card('file-code', ui('原生 Markdown'), ui('适用 Typora、Obsidian，导出通用语法及图片，移除 Blo 私有格式。'))
    button(markdown, ui('导出 Markdown'), () => this.exportMarkdown(), true)
    const cloud = card('clipboard-copy', ui('云文档富文本'), ui('可直接粘贴到语雀、飞书、Notion，保留父子块缩进、颜色和表格等样式。'))
    button(cloud, ui('复制全文'), async () => {
      const content = await richContent(this.view, this.file!, this.view.editor!.children)
      if (this.closed) return
      this.assertCurrent()
      require('electron').clipboard.write(content)
      new Notice(ui('已复制全文，可粘贴到云文档'))
    }, true)
    const html = card('file-code-2', 'HTML', ui('浏览器直接打开，保留富文本与表格，图片内嵌。'))
    button(html, ui('导出 HTML'), () => this.exportHtml(), true)
    const pdf = card('file-text', 'PDF', ui('保留阅读排版，适合分享和打印，可设置纸张、页边距及页码。'))
    button(pdf, ui('导出 PDF'), async () => {
      this.assertCurrent()
      this.transferred = true
      const modal = new PdfExportModal(this.view, () => this.finish())
      this.close()
      try { modal.open() } catch (error) { this.finish(); throw error }
    }, true)
  }
  private assertCurrent() {
    if (!this.file || this.view.currentFile !== this.file) throw new Error(ui('笔记已切换，请重新导出'))
    if (!this.view.editor) throw new Error(ui('编辑器尚未就绪，请稍后重试'))
  }
  private async run(action: () => Promise<void>) {
    if (this.busy || this.closed) return
    this.busy = true; this.buttons.forEach(button => button.setDisabled(true))
    try { this.assertCurrent(); await action() }
    catch (error) {
      const message = String(error instanceof Error ? error.message : error).replace(/data:[^\s'"]+/gi, '[embedded content]').slice(0, 300)
      new Notice(ui('笔记导出失败：') + message)
    } finally { this.busy = false; this.buttons.forEach(button => button.setDisabled(false)) }
  }
  private async exportMarkdown() {
    const remote = require('electron').remote
    const result = await remote.dialog.showSaveDialog(remote.getCurrentWindow(), {
      title: ui('导出笔记'), defaultPath: this.file!.basename + '.md',
      filters: [{name: 'Markdown', extensions: ['md']}],
    })
    if (result.canceled || !result.filePath || this.closed) return
    this.assertCurrent()
    const nodeRequire = require
    const path = nodeRequire('node:path') as typeof import('node:path')
    const basePath = (this.app.vault.adapter as { basePath?: string }).basePath
    if (basePath && path.resolve(result.filePath).toLowerCase() === path.resolve(basePath, this.file!.path).toLowerCase()) throw new Error(ui('不能覆盖原笔记，请选择其他文件名'))
    const content = await exportContent(this.view, this.file!, this.view.editor!.children, result.filePath)
    if (this.closed) return
    this.assertCurrent()
    const fs = nodeRequire('node:fs/promises') as typeof import('node:fs/promises')
    if (content.images.length) {
      const folder = path.join(path.dirname(result.filePath), content.assetFolder)
      await fs.mkdir(folder, {recursive: true})
      for (const image of content.images) await fs.writeFile(path.join(folder, image.name), new Uint8Array(image.data))
    }
    await fs.writeFile(result.filePath, content.markdown, 'utf8')
    new Notice(ui('Markdown 已导出'))
  }
  private async exportHtml() {
    const remote = require('electron').remote
    const result = await remote.dialog.showSaveDialog(remote.getCurrentWindow(), {
      title: ui('导出 HTML'), defaultPath: this.file!.basename + '.html',
      filters: [{ name: 'HTML', extensions: ['html'] }],
    })
    if (result.canceled || !result.filePath || this.closed) return
    this.assertCurrent()
    const nodeRequire = require
    const path = nodeRequire('node:path') as typeof import('node:path')
    const basePath = (this.app.vault.adapter as { basePath?: string }).basePath
    if (basePath && path.resolve(result.filePath).toLowerCase() === path.resolve(basePath, this.file!.path).toLowerCase()) throw new Error(ui('不能覆盖原笔记，请选择其他文件名'))
    const html = await htmlDocument(this.view, this.file!, this.view.editor!.children)
    if (this.closed) return
    this.assertCurrent()
    const fs = nodeRequire('node:fs/promises') as typeof import('node:fs/promises')
    await fs.writeFile(result.filePath, html, 'utf8')
    new Notice(ui('HTML 已导出'))
  }
  private finish() { const callback = this.afterClose; this.afterClose = undefined; callback?.() }
  onClose() {
    this.closed = true; this.contentEl.empty(); this.buttons = []
    if (!this.transferred) this.finish()
  }
}
