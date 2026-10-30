import { TFile } from 'obsidian'
import type { Descendant } from 'slate'
import type { BloView } from '../BloView'
import { portableDocument, portableMarkdown } from './portable-document'

const imageMime: Record<string, string> = { avif:'image/avif', bmp:'image/bmp', gif:'image/gif', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', svg:'image/svg+xml', webp:'image/webp' }

/** Resolve only referenced local assets; no downloads, document edits or selection changes. */
export async function resolveExportAssets(view: BloView, source: TFile, nodes: Descendant[], destination: string) {
  const local = new Map<string, { file: TFile; embedded: boolean }>()
  const external = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i
  const discover = (target: string, embedded: boolean) => {
    if (external.test(target)) return target
    let decoded = target
    try { decoded = decodeURIComponent(target) } catch { /* Keep literal file names. */ }
    const file = view.app.metadataCache.getFirstLinkpathDest(decoded.split('#')[0], source.path)
    if (file instanceof TFile) local.set(target, { file, embedded: embedded || !!local.get(target)?.embedded })
    return target
  }
  portableDocument(nodes, discover)
  const images = new Map<string, { url: string; data: ArrayBuffer; name: string }>()
  const nodeRequire = require
  const path = nodeRequire('node:path') as typeof import('node:path')
  const assetFolder = path.basename(destination, path.extname(destination)) + '.assets'
  const files = [...local.entries()].filter(([, entry]) => entry.embedded && imageMime[entry.file.extension.toLowerCase()])
  const reads = new Map<TFile, Promise<ArrayBuffer>>()
  let next = 0
  await Promise.all(Array.from({length: Math.min(4, files.length)}, async () => {
    while (next < files.length) {
      const [target, {file}] = files[next++]
      let pending = reads.get(file)
      if (!pending) { pending = view.app.vault.readBinary(file); reads.set(file, pending) }
      const data = await pending
      const hash = (nodeRequire('node:crypto') as typeof import('node:crypto')).createHash('sha256').update(new Uint8Array(data)).digest('hex').slice(0, 12)
      const name = hash + '.' + file.extension.toLowerCase()
      const url = encodeURIComponent(assetFolder) + '/' + name
      images.set(target, { url, data, name })
    }
  }))
  const link = (target: string, embedded: boolean) => {
    const entry = local.get(target)
    if (embedded && entry && imageMime[entry.file.extension.toLowerCase()]) {
      return images.has(target) ? images.get(target)!.url : entry.file.path.split('/').map(encodeURIComponent).join('/')
    }
    if (entry) {
      const fragment = target.includes('#') ? target.slice(target.indexOf('#')) : ''
      return 'obsidian://open?vault=' + encodeURIComponent(view.app.vault.getName()) + '&file=' + encodeURIComponent(entry.file.path + fragment)
    }
    return external.test(target) ? target : encodeURI(target)
  }
  return { assetFolder, images: [...images.values()], resolveLink: link }
}

export function exportMarkdown(view: BloView, nodes: Descendant[], link: Parameters<typeof portableDocument>[1]) {
  const body = portableMarkdown(portableDocument(nodes, link))
  const frontmatter = view.getFrontmatter()
  return frontmatter ? frontmatter.replace(/\s*$/, '\n\n') + body : body
}

export async function exportContent(view: BloView, source: TFile, nodes: Descendant[], destination: string) {
  const assets = await resolveExportAssets(view, source, nodes, destination)
  return { ...assets, markdown: exportMarkdown(view, nodes, assets.resolveLink) }
}
