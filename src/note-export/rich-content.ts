import { Text } from 'slate'
import type { Descendant } from 'slate'
import type { TFile } from 'obsidian'
import type { BloView } from '../BloView'
import { clipboardFragmentHtml } from '../wysimark/paste-markdown-plugin/clipboard-html'
import { rootCache } from '../blocks/model'
import { isWikiEmbedUrl, isWikiLinkHref, wikiEmbedSpecFromUrl, wikiLinkSpecFromHref, wikiLinkTarget } from '../wysimark/convert/obsidian-links'
import { exportContent } from './content'

/** Use the same semantic renderer as rich copy/paste, without changing selection. */
export async function richContent(view: BloView, source: TFile, nodes: Descendant[]) {
  const labels = new Map(rootCache(view.editor!).numberLabels)
  const content = await exportContent(view, source, nodes, source.basename + '.md')
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
    if (copy.type === 'image-block' || copy.type === 'image-inline') copy.url = resolve(isWikiEmbedUrl(copy.url) ? wikiLinkTarget(wikiEmbedSpecFromUrl(copy.url)) : copy.url, true)
    if (node.__subtitle && copy.type === 'paragraph') return { type: 'heading', level: 5, children: copy.children }
    return copy
  }
  const fragment = nodes.map(clone)
  // Number labels refer to original nodes. Transfer only the root identities.
  const mappedLabels = new Map(fragment.map((node, index) => [node, labels.get(nodes[index])!]).filter(([, label]) => !!label) as [Descendant, string][])
  const doc = view.contentEl.ownerDocument.implementation.createHTMLDocument('')
  doc.body.innerHTML = clipboardFragmentHtml(fragment, '', mappedLabels)
  doc.body.firstElementChild?.removeAttribute('data-slate-fragment')
  return { html: doc.body.innerHTML, text: content.markdown }
}

/** Wrap the shared rich-text fragment in a standalone browser document. */
export async function htmlDocument(view: BloView, source: TFile, nodes: Descendant[]) {
  const content = await richContent(view, source, nodes)
  const doc = view.contentEl.ownerDocument.implementation.createHTMLDocument(source.basename)
  const charset = doc.createElement('meta'); charset.setAttribute('charset', 'utf-8'); doc.head.prepend(charset)
  const viewport = doc.createElement('meta'); viewport.name = 'viewport'; viewport.content = 'width=device-width, initial-scale=1'; doc.head.append(viewport)
  const policy = doc.createElement('meta'); policy.httpEquiv = 'Content-Security-Policy'
  policy.content = "default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline';"; doc.head.append(policy)
  const style = doc.createElement('style')
  style.textContent = `
body{max-width:960px;margin:32px auto;padding:0 24px;background:#fff;color:#222;font:16px/1.65 system-ui,sans-serif;overflow-wrap:anywhere}
h1,h2,h3,h4,h5,h6{line-height:1.35;margin:1.5em 0 .6em}h1{font-size:2em}h2{font-size:1.5em}h3{font-size:1.25em}h4{font-size:1.1em}h5,h6{font-size:1em}
li:has(>h1)::marker{font-size:2em;font-weight:bold}li:has(>h2)::marker{font-size:1.5em;font-weight:bold}li:has(>h3)::marker{font-size:1.25em;font-weight:bold}li:has(>h4)::marker{font-size:1.1em;font-weight:bold}
img{max-width:100%;height:auto}table{border-collapse:collapse;max-width:100%}td,th{overflow-wrap:anywhere}
pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;background:#f5f5f5;border-radius:6px}code,pre{font-family:Consolas,monospace}blockquote{margin-left:0;padding-left:1em;border-left:3px solid #ccc}
@media(max-width:600px){body{margin:20px auto;padding:0 16px}}`
  doc.head.append(style)
  doc.body.innerHTML = content.html
  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML
}
