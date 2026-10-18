import { PluginSettingTab, Setting } from 'obsidian'
import type BloEditorPlugin from './main'
import { ui } from './wysimark/utils/translations'

export type EditorSettings = {
  preferRichEditing: boolean
  defaultTextColor: string | null
  richEditingFolder: string
  tableDefaults: { headerRow: boolean; headerColumn: boolean }
}

export const DEFAULT_SETTINGS: EditorSettings = {
  preferRichEditing: true,
  defaultTextColor: null,
  richEditingFolder: '',
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
