import { normalizeEditingFolder } from './editing-scope'
import { Notice, PluginSettingTab, Setting, SettingGroup } from 'obsidian'
import type BloEditorPlugin from './main'
import { ui } from './wysimark/utils/translations'
import { DEFAULT_TEXT_COLOR } from './wysimark/marks-plugin/methods/text-color'
import { DEFAULT_ATTACHMENT_FOLDER, normalizeAttachmentFolder } from './attachments'
import { memoPanelStatus } from './memo-panel'
import { AiSkillPromptModal, copyAiSkillPrompt } from './ai-skill-modal'

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
  autoLinkTitle: boolean
  showListGuides: boolean
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
  autoLinkTitle: true,
  showListGuides: true,
}

export class BloSettingsTab extends PluginSettingTab {
  constructor(private readonly editorPlugin: BloEditorPlugin) {
    super(editorPlugin.app, editorPlugin)
  }

  display() {
    const plugin = this.editorPlugin
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
    const scopeGroup = group(ui('编辑范围'))
    const attachmentGroup = group(ui('附件'))
    const integrationGroup = group(ui('扩展功能'))
    const aiGroup = group(ui('AI 写笔记'))
    new Setting(aiGroup)
      .setName(ui('AI 默认写作格式'))
      .setClass('blo-ai-skill-setting')
      .setDesc(ui('在当前编辑范围生成 AGENTS.md，让支持目录规则的 AI 默认按 Blo 格式写笔记。已有文件仅更新 Blo 规则段。'))
      .addButton(button => button.setButtonText(ui('生成 AGENTS.md')).onClick(async () => {
        button.setDisabled(true)
        try {
          const path = await plugin.generateAiDirectoryRules()
          new Notice(ui('AI 写作规则已生成：{path}', { path }))
        } catch (error) {
          console.error('Blo Editor: could not generate AI directory rules', error)
          new Notice(ui('无法更新 AI 目录规则，请检查编辑范围是否存在及 AGENTS.md 是否可写、规则标记是否完整。'))
        } finally { button.setDisabled(false) }
      }))
    new Setting(aiGroup)
      .setName(ui('安装 Blo Editor Skill'))
      .setClass('blo-ai-skill-setting')
      .setDesc(ui('让 AI 学会 Blo 的块结构、样式与画板格式。复制提示词给 AI，即可安装或更新 Skill。'))
      .addButton(button => button.setButtonText(ui('查看提示词')).onClick(() => new AiSkillPromptModal(plugin).open()))
      .addButton(button => button.setButtonText(ui('复制安装提示词')).onClick(async () => {
        button.setDisabled(true)
        try {
          await copyAiSkillPrompt(plugin)
        } catch (error) {
          console.error('Blo Editor: could not copy AI skill prompt', error)
          new Notice(ui('无法准备或复制 Skill，请重试；也可选中预览中的提示词手动复制。'))
        } finally { button.setDisabled(false) }
      }))
    new Setting(editorGroup)
      .setName(ui('默认使用富文本编辑器'))
      .setDesc(ui('Markdown 笔记默认使用富文本编辑；阅读视图不受影响。'))
      .addToggle(toggle => toggle
        .setValue(plugin.settings.preferRichEditing)
        .onChange(async value => {
          plugin.settings.preferRichEditing = value
          await plugin.saveData(plugin.settings)
        }))
    new Setting(editorGroup)
      .setName(ui('正文列表层级竖线'))
      .setDesc(ui('显示正文列表父子层级的竖线；标题列表不显示竖线。修改后立即生效。'))
      .addToggle(toggle => toggle.setValue(plugin.settings.showListGuides).onChange(async value => {
        plugin.setListGuidesVisible(value)
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
      unsupported: 'Glimmer Memo 仅支持桌面端',
      missing: '依赖 Glimmer Memo，尚未安装。开启后可查看 GitHub 安装指引。',
      disabled: 'Glimmer Memo 已安装但尚未启用。开启后可启用插件并接入 Blo。',
      enabled: 'Glimmer Memo 已启用。速记笔记使用 Blo 编辑，隐藏重复标题、使用紧凑工具栏，并在面板隐藏前保存。',
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
