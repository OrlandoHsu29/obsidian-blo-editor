import { PluginSettingTab, Setting } from 'obsidian'
import type BloEditorPlugin from './main'
import { ui } from './wysimark/utils/translations'
import { DEFAULT_TEXT_COLOR } from './wysimark/marks-plugin/methods/text-color'
import { DEFAULT_ATTACHMENT_FOLDER, normalizeAttachmentFolder } from './attachments'

export type EditorSettings = {
  preferRichEditing: boolean
  defaultTextColor: string | null
  richEditingFolder: string
  attachmentFolder: string
  tableDefaults: { headerRow: boolean; headerColumn: boolean }
}

export const DEFAULT_SETTINGS: EditorSettings = {
  preferRichEditing: true,
  defaultTextColor: DEFAULT_TEXT_COLOR,
  richEditingFolder: '',
  attachmentFolder: DEFAULT_ATTACHMENT_FOLDER,
  tableDefaults: { headerRow: true, headerColumn: false },
}

export class BloSettingsTab extends PluginSettingTab {
  constructor(private readonly editorPlugin: BloEditorPlugin) {
    super(editorPlugin.app, editorPlugin)
  }

  display() {
    const plugin = this.editorPlugin
    this.containerEl.empty()
    new Setting(this.containerEl)
      .setName(ui('附件保存路径'))
      .setDesc(ui('图片和画板统一保存于此，路径相对于知识库根目录；留空保存到根目录。'))
      .addText(text => text
        .setPlaceholder(DEFAULT_ATTACHMENT_FOLDER)
        .setValue(plugin.settings.attachmentFolder)
        .onChange(async value => {
          try {
            const folder = normalizeAttachmentFolder(value)
            text.inputEl.setCustomValidity('')
            plugin.settings.attachmentFolder = folder
            await plugin.saveData(plugin.settings)
          } catch {
            text.inputEl.setCustomValidity(ui('请填写知识库内的相对路径'))
            text.inputEl.reportValidity()
          }
        }))
    new Setting(this.containerEl)
      .setName(ui('默认使用富文本编辑器'))
      .setDesc(ui('Markdown 笔记默认使用富文本编辑；阅读视图不受影响。'))
      .addToggle(toggle => toggle
        .setValue(plugin.settings.preferRichEditing)
        .onChange(async value => {
          plugin.settings.preferRichEditing = value
          await plugin.saveData(plugin.settings)
        }))
    new Setting(this.containerEl)
      .setName(ui('默认编辑范围'))
      .setDesc(ui('留空应用于整个库；填写文件夹路径可限制范围。'))
      .addText(text => text
        .setValue(plugin.settings.richEditingFolder)
        .onChange(async value => {
          plugin.settings.richEditingFolder = value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
          await plugin.saveData(plugin.settings)
        }))
  }
}
