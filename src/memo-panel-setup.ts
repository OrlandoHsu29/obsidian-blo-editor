import { App, Modal, Notice, Setting } from 'obsidian'
import { MEMO_PANEL_PLUGIN_ID, memoPanelEnabled, memoPanelStatus } from './memo-panel'
import { ui } from './wysimark/utils/translations'

const RELEASES_URL = 'https://github.com/OrlandoHsu29/obsidian-flash-memo/releases'

type MemoPluginManager = {
  loadManifests?: () => Promise<void>
  enablePluginAndSave: (id: string) => Promise<boolean>
}

/** Manual ZIP installation preserves Flash Memo's native hotkey helper. */
export class MemoPanelSetupModal extends Modal {
  private settled = false
  private finished = false
  private checking = false

  constructor(app: App, private readonly complete: (enabled: boolean) => void) { super(app) }

  onOpen() { this.render() }

  private render() {
    this.setTitle(ui('设置 Flash Memo'))
    this.contentEl.empty()
    const status = memoPanelStatus(this.app)
    this.contentEl.createEl('p', { text: ui(status === 'disabled'
      ? 'Flash Memo 已安装但尚未启用。启用后即可使用 Blo 速记面板。'
      : 'Flash Memo 尚未上架插件市场，请从 GitHub 下载完整安装包。') })
    if (status === 'missing') {
      this.contentEl.createEl('p', { text: ui('将 ZIP 内的 flash-memo 文件夹解压到当前库的 .obsidian/plugins/ 下，保留全部文件（包括 Windows 快捷键程序）。然后点击“重新检测并启用”；如仍未检测到，请重启 Obsidian 后重试。') })
      this.contentEl.createEl('a', { text: ui('下载完整安装包'), href: RELEASES_URL, attr: { target: '_blank', rel: 'noopener noreferrer' } })
    }
    new Setting(this.contentEl)
      .addButton(button => button.setButtonText(ui('取消')).onClick(() => this.close()))
      .addButton(button => button.setButtonText(ui(status === 'disabled' ? '启用 Flash Memo' : '重新检测并启用')).setCta().onClick(async () => {
        if (this.checking) return
        this.checking = true
        button.setDisabled(true)
        try {
          const manager = (this.app as App & { plugins: MemoPluginManager }).plugins
          if (memoPanelStatus(this.app) === 'missing') await manager.loadManifests?.()
          if (this.finished) return
          if (memoPanelStatus(this.app) === 'missing') {
            new Notice(ui('尚未检测到 Flash Memo，请确认已解压到当前库，或重启 Obsidian 后重试。'))
            return
          }
          if (!memoPanelEnabled(this.app)) await manager.enablePluginAndSave(MEMO_PANEL_PLUGIN_ID)
          if (this.finished) return
          if (!memoPanelEnabled(this.app)) throw new Error('Flash Memo did not load')
          this.settled = true
          this.complete(true)
          this.close()
        } catch (error) {
          console.error('Blo Editor: Flash Memo setup failed', error)
          if (!this.finished) new Notice(ui('无法启用 Flash Memo，请在第三方插件中检查并手动启用。'))
        } finally {
          this.checking = false
          button.setDisabled(false)
        }
      }))
  }

  onClose() {
    this.finished = true
    if (!this.settled) { this.settled = true; this.complete(false) }
    this.contentEl.empty()
  }
}

/** Invoked only when the user turns the integration on. */
export function setupMemoPanel(app: App): { modal: MemoPanelSetupModal; result: Promise<boolean> } {
  let modal!: MemoPanelSetupModal
  const result = new Promise<boolean>(resolve => { modal = new MemoPanelSetupModal(app, resolve) })
  modal.open()
  return { modal, result }
}
