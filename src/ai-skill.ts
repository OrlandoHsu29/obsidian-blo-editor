import { FileSystemAdapter, normalizePath } from 'obsidian'
import type { App, PluginManifest } from 'obsidian'
import { ui } from './wysimark/utils/translations'
import instructions from '../skills/blo-editor-notes/SKILL.md'
import format from '../skills/blo-editor-notes/references/format.md'
import drawings from '../skills/blo-editor-notes/references/drawings.md'
import example from '../skills/blo-editor-notes/assets/example-note.md'
import drawing from '../skills/blo-editor-notes/assets/example.excalidraw.md'

// Embed resources: Obsidian's standard updater only downloads the plugin's
// main.js, styles.css and manifest.json. Materialize the same skill for both
// that installation route and the full ZIP distribution.
export const AI_SKILL_FILES: Readonly<Record<string, string>> = {
  'SKILL.md': instructions,
  'references/format.md': format,
  'references/drawings.md': drawings,
  'assets/example-note.md': example,
  'assets/example.excalidraw.md': drawing,
}

export function aiSkillDirectory(app: App, manifest: PluginManifest): string {
  return normalizePath(`${manifest.dir || `${app.vault.configDir}/plugins/${manifest.id}`}/skills/blo-editor-notes`)
}

export async function writeAiSkill(app: App, manifest: PluginManifest): Promise<void> {
  const adapter = app.vault.adapter
  const root = aiSkillDirectory(app, manifest)
  for (const [relative, content] of Object.entries(AI_SKILL_FILES)) {
    const path = `${root}/${relative}`
    const folders = path.slice(0, path.lastIndexOf('/')).split('/')
    for (let i = 1; i <= folders.length; i++) {
      const folder = folders.slice(0, i).join('/')
      if (!await adapter.exists(folder)) await adapter.mkdir(folder)
    }
    if (!await adapter.exists(path) || await adapter.read(path) !== content) await adapter.write(path, content)
  }
}

export function aiSkillInstallPrompt(app: App, manifest: PluginManifest): string {
  const relative = aiSkillDirectory(app, manifest)
  const path = app.vault.adapter instanceof FileSystemAdapter
    ? `${app.vault.adapter.getBasePath().replace(/\\/g, '/').replace(/\/$/, '')}/${relative}`
    : relative
  return ui('AI 技能安装提示词', { path, version: manifest.version })
}
