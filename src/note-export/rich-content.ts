import { Text } from 'slate'
import type { Descendant } from 'slate'
import type { TFile } from 'obsidian'
import type { BloView } from '../BloView'
import { clipboardFragmentHtml } from '../wysimark/paste-markdown-plugin/clipboard-html'
import { exportHeadingLists } from './heading-lists'
import { isWikiEmbedUrl, isWikiLinkHref, wikiEmbedSpecFromUrl, wikiLinkSpecFromHref, wikiLinkTarget } from '../wysimark/convert/obsidian-links'
import { exportMarkdown, resolveExportAssets } from './content'
import { createPdfHtml } from '../pdf-export'
import { mediaExtensions } from '../media-extensions'
import { prepareRichMath } from './rich-math'
const attachmentExtension = new RegExp(`\\.(?:${mediaExtensions}|excalidraw(?:\\.md)?)(?:[?#]|$)`, 'i')

/** Use the same semantic renderer as rich copy/paste, without changing selection. */
export async function richContent(view: BloView, source: TFile, nodes: Descendant[], includeText = true) {
  const content = await resolveExportAssets(view, source, nodes, source.basename + '.md')
  const images = new Map(content.images.map(image => [image.url, image]))
  const nodeRequire = require
  const { Buffer } = nodeRequire('node:buffer') as typeof import('node:buffer')
  const resolve = (target: string, embedded: boolean) => {
    const resolved = content.resolveLink(target, embedded)
    const image = embedded ? images.get(resolved) : undefined
    if (image) {
      const ext = image.name.split('.').pop()!
      const mime = ext === 'svg' ? 'svg+xml' : ext === 'jpg' ? 'jpeg' : ext
      return `data:image/${mime};base64,${Buffer.from(image.data).toString('base64')}`
    }
    return /^(?:javascript|vbscript|data(?!:image\/)):/i.test(resolved.trim()) ? '' : resolved
  }
  const clone = (node: Descendant): Descendant => {
    if (Text.isText(node)) return { ...node }
    const copy = { ...node, children: node.children.map(clone) } as typeof node
    if (copy.type === 'anchor') copy.href = resolve(isWikiLinkHref(copy.href) ? wikiLinkTarget(wikiLinkSpecFromHref(copy.href)) : copy.href, false)
    if (copy.type === 'image-block' || copy.type === 'image-inline') {
      const target = isWikiEmbedUrl(copy.url) ? wikiLinkTarget(wikiEmbedSpecFromUrl(copy.url)) : copy.url
      copy.url = resolve(target, true)
      if (copy.url.startsWith('obsidian:') || attachmentExtension.test(target)) {
        const anchor = { type: 'anchor' as const, href: copy.url, children: [{ text: copy.alt || target }] }
        return copy.type === 'image-block' ? { type: 'paragraph', __blockDepth: copy.__blockDepth, children: [anchor] } : anchor
      }
    }
    if (node.__subtitle && copy.type === 'paragraph') return { type: 'heading', level: 5, children: copy.children }
    return copy
  }
  const fragment = exportHeadingLists(nodes).map(clone)
  const owner = view.contentEl.ownerDocument
  const formulas = await prepareRichMath(owner, fragment)
  const doc = owner.implementation.createHTMLDocument('')
  doc.body.innerHTML = clipboardFragmentHtml(fragment, '', undefined, undefined, formulas)
  doc.body.firstElementChild?.removeAttribute('data-slate-fragment')
  return { html: doc.body.innerHTML, text: includeText ? exportMarkdown(view, nodes, resolve) : '' }
}

/** Share the cleaned rendered snapshot with PDF instead of losing editor styles. */
export async function htmlDocument(view: BloView, _source: TFile, _nodes: Descendant[]) {
  return createPdfHtml(view, { paper: 'A4', landscape: false, margin: 15, title: false, pages: false }, 'html')
}
