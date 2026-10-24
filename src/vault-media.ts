import { App, FileSystemAdapter, normalizePath, TFile } from 'obsidian'
import { isDrawingFile } from './drawings'
import { normalizeWikiLinkInput, wikiEmbedUrl } from './wysimark/convert/obsidian-links'

export const IMAGE_FILE_PATTERN = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i
export const MEDIA_FILE_PATTERN = /\.(?:mp3|wav|m4a|ogg|oga|opus|flac|aac|mp4|webm|ogv|mov|mkv|3gp|pdf|excalidraw(?:\.md)?)$/i
export type VaultReference = { file: TFile; target: string; display?: string }

/** Accept vault paths, wiki links, and this vault's copied Obsidian URLs. */
export function normalizeVaultLinkInput(app: App, value: string): ReturnType<typeof normalizeWikiLinkInput> {
  const parsed = normalizeWikiLinkInput(value)
  let target = parsed.target
  if (/^obsidian:\/\//i.test(target)) {
    try {
      const url = new URL(target), vault = url.searchParams.get('vault')
      if (url.hostname !== 'open' || vault && vault !== app.vault.getName()) return parsed
      target = url.searchParams.get('file') || target
    } catch { return parsed }
  }
  if (/^file:\/\//i.test(target)) {
    try {
      const url = new URL(target)
      target = decodeURIComponent(url.pathname) + url.hash
      if (/^\/[a-z]:\//i.test(target)) target = target.slice(1)
    } catch { return parsed }
  }
  target = target.replace(/\\/g, '/')
  if (app.vault.adapter instanceof FileSystemAdapter) {
    const base = app.vault.adapter.getBasePath().replace(/\\/g, '/').replace(/\/$/, '') + '/'
    const windowsPath = /^[a-z]:\//i.test(base)
    const startsInVault = windowsPath ? target.toLowerCase().startsWith(base.toLowerCase()) : target.startsWith(base)
    if (startsInVault) target = target.slice(base.length)
  }
  return { ...parsed, target }
}

export function resolveVaultReference(app: App, sourcePath: string, value: string): VaultReference | undefined {
  const parsed = normalizeVaultLinkInput(app, value)
  if (!parsed.target || /^(?:[a-z][a-z\d+.-]*:|\/)/i.test(parsed.target)) return
  let target = parsed.target
  // Preserve literal #/% in real filenames before trying URL-decoded link paths.
  const exact = app.vault.getAbstractFileByPath(normalizePath(target))
  if (exact instanceof TFile) return { ...parsed, file: exact, target: exact.path }
  try { target = decodeURI(target) } catch { /* Keep a literal percent sign. */ }
  const hash = target.indexOf('#'), path = hash < 0 ? target : target.slice(0, hash), suffix = hash < 0 ? '' : target.slice(hash)
  const file = app.vault.getAbstractFileByPath(normalizePath(path)) || app.metadataCache.getFirstLinkpathDest(path, sourcePath)
  if (file instanceof TFile) return { file, target: file.path + suffix, display: parsed.display }
}

export function vaultMediaUrl(app: App, sourcePath: string, reference: VaultReference): string | undefined {
  const { file, target } = reference
  if (IMAGE_FILE_PATTERN.test(file.path)) {
    const source = sourcePath.split('/').slice(0, -1), destination = file.path.split('/')
    while (source.length && destination.length && source[0] === destination[0]) { source.shift(); destination.shift() }
    return [...source.map(() => '..'), ...destination].map(part => encodeURIComponent(part)).join('/')
  }
  if (MEDIA_FILE_PATTERN.test(file.path) || isDrawingFile(app, file)) return wikiEmbedUrl(target)
}

/** Sidebar drags contain Obsidian file references, not browser File objects. */
export function vaultTransferReferences(app: App, sourcePath: string, data: DataTransfer, drop: boolean): VaultReference[] {
  if (data.types.includes('application/x-slate-fragment') || data.types.includes('application/x-wysimark-block') || /\bdata-slate-fragment\s*=/i.test(data.getData('text/html'))) return []
  type Dragged = { type?: string; file?: TFile; files?: unknown[]; linktext?: string; sourcePath?: string }
  const dragged = drop ? (app as App & { dragManager?: { draggable?: Dragged } }).dragManager?.draggable : undefined
  if (dragged?.type === 'link' && dragged.linktext) {
    if (dragged.file instanceof TFile) {
      const parsed = normalizeVaultLinkInput(app, dragged.linktext), hash = parsed.target.indexOf('#')
      const suffix = hash >= 0 && parsed.target !== dragged.file.path && parsed.target !== dragged.file.name ? parsed.target.slice(hash) : ''
      return [{ file: dragged.file, target: dragged.file.path + suffix, display: parsed.display }]
    }
    const reference = resolveVaultReference(app, dragged.sourcePath || sourcePath, dragged.linktext)
    if (reference) return [reference]
  }
  const files = dragged?.type === 'file' ? [dragged.file] : dragged?.type === 'files' ? dragged.files : []
  const references = files?.filter((file): file is TFile => file instanceof TFile).map(file => ({ file, target: file.path }))
  if (references?.length) return references
  const text = (data.getData('text/uri-list') || data.getData('text/plain')).trim()
  if (!text) return []
  const links = Array.from(text.matchAll(/!?\[\[[^\]\n]+\]\]/g))
  const candidates = links.length && !text.replace(/!?\[\[[^\]\n]+\]\]/g, '').trim()
    ? links.map(match => match[0]) : text.split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'))
  if (candidates.some(value => !/^\s*!?\[\[/.test(value) && !/^(?:obsidian|file):\/\//i.test(value.trim()) && !/\.[^/\\#\s]+(?:#.*)?$/.test(value.trim()))) return []
  const resolved = candidates.map(value => resolveVaultReference(app, sourcePath, value))
  if (!resolved.length || resolved.some(reference => !reference)) return []
  const valid = resolved as VaultReference[]
  // Normal pasted prose/note links keep their existing clipboard behavior.
  return drop || valid.every(reference => vaultMediaUrl(app, sourcePath, reference)) ? valid : []
}
