import { TFile } from 'obsidian'
import type { App, PluginManifest } from 'obsidian'
import { aiSkillDirectory } from './ai-skill'
import { normalizeEditingFolder } from './editing-scope'
import { ui } from './wysimark/utils/translations'

const begin = '<!-- blo-editor:notes-rules:start -->'
const end = '<!-- blo-editor:notes-rules:end -->'

function safeRelativePath(path: string): boolean {
  return !/^[\\/]|[\r\n<>:"|?*]/.test(path) && !path.split(/[\\/]/).some(part => part === '..' || part === '.')
}

export function directoryRulesPath(folder: string): string {
  const scope = normalizeEditingFolder(folder)
  if (!safeRelativePath(folder.trim()) || !safeRelativePath(scope)) throw new Error('Invalid AI rules folder')
  return scope ? `${scope}/AGENTS.md` : 'AGENTS.md'
}

/** Replace only our delimited section. Never guess when delimiters are damaged. */
export function mergeDirectoryRules(source: string, body: string): string {
  const starts = source.split(begin).length - 1, ends = source.split(end).length - 1
  if (starts !== ends || starts > 1 || (starts && source.indexOf(end) < source.indexOf(begin))) {
    throw new Error('Conflicting Blo Editor rule markers')
  }
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  const section = `${begin}${newline}${body.replace(/\r?\n/g, newline).trim()}${newline}${end}`
  if (starts) return source.slice(0, source.indexOf(begin)) + section + source.slice(source.indexOf(end) + end.length)
  return source + (source ? (source.endsWith(newline + newline) ? '' : source.endsWith(newline) ? newline : newline + newline) : '') + section + newline
}

export function directoryRulesBody(app: App, manifest: PluginManifest, folder: string): string {
  const scope = normalizeEditingFolder(folder)
  const skill = `${'../'.repeat(scope ? scope.split('/').length : 0)}${aiSkillDirectory(app, manifest)}/SKILL.md`
  return ui('AI 目录规则正文', { skill })
}

async function updateFile(app: App, path: string, body: string): Promise<void> {
  const file = app.vault.getAbstractFileByPath(path)
  if (file instanceof TFile) {
    // Vault.process merges against the latest on-disk text, including edits
    // made while a queued scope update was waiting.
    await app.vault.process(file, source => mergeDirectoryRules(source, body))
  } else if (file || await app.vault.adapter.exists(path)) {
    throw new Error('AI rules path is not an available Markdown file')
  } else {
    await app.vault.create(path, mergeDirectoryRules('', body))
  }
}

export async function writeDirectoryRules(app: App, manifest: PluginManifest, folder: string): Promise<string> {
  const target = directoryRulesPath(folder)
  const scope = normalizeEditingFolder(folder)
  if (scope && !await app.vault.adapter.exists(scope)) throw new Error('AI rules folder does not exist')
  await updateFile(app, target, directoryRulesBody(app, manifest, folder))
  return target
}
