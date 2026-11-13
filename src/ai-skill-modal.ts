import { Modal, Notice, Setting } from 'obsidian'
import type BloEditorPlugin from './main'
import { aiSkillInstallPrompt } from './ai-skill'
import { ui } from './wysimark/utils/translations'

export async function copyAiSkillPrompt(plugin: BloEditorPlugin): Promise<void> {
  await plugin.ensureAiSkill()
  await navigator.clipboard.writeText(aiSkillInstallPrompt(plugin.app, plugin.manifest))
  new Notice(ui('安装提示词已复制，请粘贴给 AI'))
}

export class AiSkillPromptModal extends Modal {
  constructor(private readonly plugin: BloEditorPlugin) { super(plugin.app) }

  onOpen() {
    this.modalEl.addClass('blo-ai-skill-modal')
    this.setTitle(ui('安装 Blo Editor Skill'))
    this.contentEl.createEl('p', { cls: 'blo-ai-skill-help', text: ui('将提示词粘贴给能访问本地文件的 AI，按其客户端的方式安装或更新 Skill。') })
    this.contentEl.createEl('pre', {
      cls: 'blo-ai-skill-preview', text: aiSkillInstallPrompt(this.plugin.app, this.plugin.manifest),
      attr: { tabindex: '0', 'aria-label': ui('安装提示词') },
    })
    new Setting(this.contentEl).setClass('blo-ai-skill-actions')
      .addButton(button => button.setButtonText(ui('关闭')).onClick(() => this.close()))
      .addButton(button => button.setButtonText(ui('复制安装提示词')).setCta().onClick(async () => {
        button.setDisabled(true)
        try { await copyAiSkillPrompt(this.plugin) }
        catch (error) {
          console.error('Blo Editor: could not copy AI skill prompt', error)
          new Notice(ui('无法准备或复制 Skill，请重试；也可选中预览中的提示词手动复制。'))
        } finally { button.setDisabled(false) }
      }))
  }

  onClose() { this.contentEl.empty() }
}
