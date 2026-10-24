import { App, Platform, PluginManifest, requestUrl, requireApiVersion } from 'obsidian'
import type { IntegrationFlags } from './integration-preferences'

export const OPTIONAL_PLUGINS = { imageViewer: 'obsidian-image-toolkit', drawings: 'obsidian-excalidraw-plugin' } as const
type Manager = {
  manifests: Record<string, PluginManifest | undefined>
  plugins: Record<string, unknown>
  enabledPlugins: Set<string>
  installPlugin: (repo: string, version: string, manifest: PluginManifest) => Promise<void>
  enablePluginAndSave: (id: string) => Promise<boolean>
}
export const optionalPluginManager = (app: App) => (app as App & { plugins: Manager }).plugins
let catalog: Promise<{ id: string; repo: string }[]> | undefined
const pending = new WeakMap<App, Map<string, Promise<void>>>()

/** Only called in response to the user's explicit opt-in, never at startup. */
export async function ensureOptionalPlugin(app: App, feature: keyof IntegrationFlags): Promise<void> {
  const id = OPTIONAL_PLUGINS[feature], manager = optionalPluginManager(app)
  if (manager.plugins[id]) return
  let jobs = pending.get(app)
  if (!jobs) { jobs = new Map(); pending.set(app, jobs) }
  const existing = jobs.get(id)
  if (existing) return existing
  const job = (async () => {
    if (!manager.manifests[id]) {
      catalog ??= requestUrl('https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json')
        .then(response => response.json).catch(error => { catalog = undefined; throw error })
      const repo = (await catalog).find(entry => entry.id === id)?.repo
      if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Dependency is not in the community catalog')
      const release = (await requestUrl(`https://api.github.com/repos/${repo}/releases/latest`)).json
      if (typeof release.tag_name !== 'string') throw new Error('Missing dependency release')
      const manifest = (await requestUrl(`https://github.com/${repo}/releases/download/${encodeURIComponent(release.tag_name)}/manifest.json`)).json as PluginManifest
      if (manifest.id !== id || !manifest.version || !manifest.minAppVersion || !requireApiVersion(manifest.minAppVersion) || manifest.isDesktopOnly && !Platform.isDesktop) throw new Error('Incompatible dependency manifest')
      await manager.installPlugin(repo, release.tag_name, manifest)
      if (!manager.manifests[id]) throw new Error('Dependency installation failed')
    }
    if (!await manager.enablePluginAndSave(id) || !manager.plugins[id]) throw new Error('Dependency activation failed')
  })()
  jobs.set(id, job)
  try { await job } finally { jobs.delete(id) }
}
