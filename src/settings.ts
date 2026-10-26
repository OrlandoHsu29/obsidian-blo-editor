import { normalizeEditingFolder } from './editing-scope'
import { PluginSettingTab, Setting, SettingGroup } from 'obsidian'
import { createElement } from 'react'
import { createPortal } from 'react-dom'
import { createRoot, Root } from 'react-dom/client'
import type BloEditorPlugin from './main'
import { ui } from './wysimark/utils/translations'
import { DEFAULT_TEXT_COLOR } from './wysimark/marks-plugin/methods/text-color'
import { DEFAULT_ATTACHMENT_FOLDER, normalizeAttachmentFolder } from './attachments'
import { toolbarGroups } from './wysimark/toolbar-plugin/items'
import { isFixedToolbarButton } from './toolbar-preferences'
import { memoPanelStatus } from './memo-panel'

export type EditorSettings = {
  preferRichEditing: boolean
  defaultTextColor: string | null
  richEditingFolder: string
  restrictExistingBloTabs: boolean
  attachmentFolder: string
  deleteEmbeddedAttachments: boolean
  enableImageViewer: boolean
  enableDrawings: boolean
  enableMemoPanel: boolean
  /** Integrations the user turned off on purpose; detection leaves them off. */
  integrationOptOut: string[]
  tableDefaults: { headerRow: boolean; headerColumn: boolean }
  hiddenToolbarButtons: string[]
}

export const DEFAULT_SETTINGS: EditorSettings = {
  preferRichEditing: true,
  defaultTextColor: DEFAULT_TEXT_COLOR,
  richEditingFolder: '',
  restrictExistingBloTabs: false,
  attachmentFolder: DEFAULT_ATTACHMENT_FOLDER,
  deleteEmbeddedAttachments: false,
  enableImageViewer: false,
  enableDrawings: false,
  enableMemoPanel: false,
  integrationOptOut: [],
  tableDefaults: { headerRow: true, headerColumn: false },
  hiddenToolbarButtons: [],
}

export class BloSettingsTab extends PluginSettingTab {
  private iconRoot: Root | null = null
  constructor(private readonly editorPlugin: BloEditorPlugin) {
    super(editorPlugin.app, editorPlugin)
    editorPlugin.register(() => this.clearIcons())
  }

  private clearIcons() { this.iconRoot?.unmount(); this.iconRoot = null }
  hide() { this.clearIcons() }

  display() {
    const plugin = this.editorPlugin
    this.clearIcons()
    this.containerEl.empty()
    this.containerEl.addClass('blo-settings')
    // A dependency enabled during this session should show up as already on.
    void plugin.enableDetectedIntegrations().then(changed => {
      if (changed && this.containerEl.isConnected) this.display()
    })
    const group = (title: string): HTMLElement => {
      if (typeof SettingGroup === 'function') {
        return new SettingGroup(this.containerEl).setHeading(title).listEl
      }
      new Setting(this.containerEl).setName(title).setHeading()
      return this.containerEl.createDiv()
    }
    const editorGroup = group(ui('编辑器'))
    const toolbarGroup = group(ui('工具栏配置'))
    const scopeGroup = group(ui('编辑范围'))
    const attachmentGroup = group(ui('附件'))
    const integrationGroup = group(ui('扩展功能'))
    const toolbarDescription = toolbarGroup.createEl('p', { cls: 'setting-item-description blo-toolbar-description', text: ui('勾选显示对应按钮；灰色勾选项固定显示。悬停查看功能名称，修改立即生效。'), attr: { id: 'blo-toolbar-config-description' } })
    toolbarGroup.before(toolbarDescription)
    const toolbarRow = toolbarGroup.createDiv({ cls: 'blo-toolbar-settings', attr: { role: 'group', 'aria-describedby': 'blo-toolbar-config-description' } })
    const icons: ReturnType<typeof createPortal>[] = []
    toolbarGroups.forEach((entries, index) => {
      if (index) toolbarRow.createDiv({ cls: 'blo-toolbar-settings-divider', attr: { 'aria-hidden': 'true' } })
      for (const entry of entries) {
        const label = toolbarRow.createEl('label', { cls: 'blo-toolbar-setting', attr: { 'aria-label': entry.item.title } })
        const icon = label.createSpan({ cls: 'blo-toolbar-setting-icon', attr: { 'aria-hidden': 'true' } })
        icons.push(createPortal(createElement(entry.settingsIcon), icon, entry.id))
        const checkbox = label.createEl('input', { type: 'checkbox', attr: { 'aria-label': entry.item.title, 'data-toolbar-id': entry.id } })
        checkbox.disabled = isFixedToolbarButton(entry.id)
        checkbox.checked = checkbox.disabled || !plugin.toolbarPreferences.getSnapshot().includes(entry.id)
        checkbox.addEventListener('change', () => {
          const hidden = new Set(plugin.toolbarPreferences.getSnapshot())
          if (checkbox.checked) hidden.delete(entry.id)
          else hidden.add(entry.id)
          plugin.settings.hiddenToolbarButtons = [...hidden]
          plugin.toolbarPreferences.setHidden(plugin.settings.hiddenToolbarButtons)
          void plugin.saveData(plugin.settings)
        })
      }
    })
    this.iconRoot = createRoot(toolbarGroup.createDiv({ attr: { hidden: 'true' } }))
    this.iconRoot.render(icons)
    new Setting(editorGroup)
      .setName(ui('默认使用富文本编辑器'))
      .setDesc(ui('Markdown 笔记默认使用富文本编辑；阅读视图不受影响。'))
      .addToggle(toggle => toggle
        .setValue(plugin.settings.preferRichEditing)
        .onChange(async value => {
          plugin.settings.preferRichEditing = value
          await plugin.saveData(plugin.settings)
        }))
    for (const [feature, key, name, description] of [
      ['imageViewer', 'enableImageViewer', '启用图片查看器', '依赖 Image Toolkit；已启用时自动开启，未安装时会自动安装并启用。支持图片放大查看，已适配工具栏图标与主题样式。'],
      ['drawings', 'enableDrawings', '启用画板', '依赖 Excalidraw；已启用时自动开启，未安装时会自动安装并启用。支持内嵌预览、缩放及放大绘制。'],
    ] as const) {
      new Setting(integrationGroup).setName(ui(name)).setDesc(ui(description)).addToggle(toggle => toggle
        .setValue(plugin.settings[key]).onChange(async value => {
          toggle.setDisabled(true)
          try { toggle.setValue(await plugin.setOptionalIntegration(feature, value)) }
          finally { toggle.setDisabled(false) }
        }))
    }
    const memoStatus = memoPanelStatus(plugin.app)
    const memoDescription = {
      unsupported: 'Flash Memo 仅支持桌面端',
      missing: '依赖 Flash Memo，尚未安装。开启后可查看 GitHub 安装指引。',
      disabled: 'Flash Memo 已安装但尚未启用。开启后可启用插件并接入 Blo。',
      enabled: 'Flash Memo 已启用。速记笔记使用 Blo 编辑，隐藏重复标题、使用紧凑工具栏，并在面板隐藏前保存。',
    } as const
    new Setting(integrationGroup).setName(ui('启用速记面板')).setDesc(ui(memoDescription[memoStatus]))
      .addToggle(toggle => toggle.setValue(memoStatus === 'enabled' && plugin.settings.enableMemoPanel)
        .setDisabled(memoStatus === 'unsupported').onChange(async value => {
          toggle.setDisabled(true)
          try { await plugin.setOptionalIntegration('memoPanel', value) }
          finally { this.display() }
        }))
    new Setting(scopeGroup)
      .setName(ui('编辑范围'))
      .setDesc(ui('控制哪些笔记自动使用 Blo；留空应用于整个库。'))
      .addText(text => text
        .setValue(plugin.settings.richEditingFolder)
        .onChange(async value => {
          plugin.settings.richEditingFolder = normalizeEditingFolder(value)
          await plugin.saveData(plugin.settings)
          await plugin.enforceEditingScope()
        }))
    new Setting(scopeGroup)
      .setName(ui('已有 Blo Editor 格式的笔记仍用 Blo Editor 打开'))
      .setDesc(ui('默认开启：已有或恢复的 Blo Editor 标签页仍使用 Blo Editor，不受编辑范围限制。关闭后，范围外的笔记会保存并切回原生编辑器。'))
      .addToggle(toggle => toggle
        .setValue(!plugin.settings.restrictExistingBloTabs)
        .onChange(async value => {
          plugin.settings.restrictExistingBloTabs = !value
          await plugin.saveData(plugin.settings)
          await plugin.enforceEditingScope()
        }))
    new Setting(attachmentGroup)
      .setName(ui('附件保存路径'))
      .setDesc(ui('粘贴或导入的媒体和新画板保存于此，相对于知识库根目录；留空保存到根目录。'))
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
      new Setting(attachmentGroup)
        .setName(ui('删除内嵌文件时删除附件'))
        .setDesc(ui('包含图片、音视频、PDF 和画板。仅将附件目录及子目录内、无其他引用的文件移入回收站，可撤销；其他目录保留源文件。路径留空时仅限库根目录文件。'))
        .addToggle(toggle => toggle.setValue(plugin.settings.deleteEmbeddedAttachments).onChange(async value => {
          plugin.settings.deleteEmbeddedAttachments = value
          await plugin.saveData(plugin.settings)
        }))
  }
}
