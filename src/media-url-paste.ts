import { Editor, Element, Node, Range, Text, Transforms } from 'slate'
import type { Descendant, Path } from 'slate'
import { HistoryEditor } from 'slate-history'
import { attachmentPreviewUrl } from './attachment-preview'
import { wikiEmbedUrl } from './wysimark/convert/obsidian-links'

/** Recognize file URLs without downloading anything just to inspect a paste. */
export function remoteMediaUrl(value: string): string | undefined {
  if (/\s/.test(value.trim())) return
  try {
    const url = new URL(value.trim())
    if (!/^https?:$/.test(url.protocol)) return
    const media = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp|mp3|wav|m4a|ogg|oga|opus|flac|aac|mp4|webm|ogv|mov|mkv|3gp|pdf)(?=$|[?!#@:;/"'])/i
    const matches = (candidate: string) => {
      for (let count = 0; count < 2; count++) try { candidate = decodeURIComponent(candidate) } catch { break }
      return media.test(candidate)
    }
    if (matches(url.pathname)) return value.trim()
    for (const [key, candidate] of url.searchParams) {
      const name = key.toLowerCase()
      if (/^(?:filename|file|name|path|url|src|image|image_url|imageurl|imgurl|media|response-content-disposition)$/.test(name) && matches(candidate) ||
        /^(?:format|fm)$/.test(name) && /^(?:avif|gif|jpe?g|png|svg|webp)$/i.test(candidate) ||
        /^(?:type|mime|mimetype|content-type|response-content-type)$/.test(name) && /^(?:(?:image|audio|video)\/[^;]+|application\/pdf)(?:;|$)/i.test(candidate)) return value.trim()
    }
  } catch { /* Non-URL clipboard text follows the normal paste path. */ }
}

/** Browser copies can expose a display label as plain text and the actual URL only in HTML. */
export function clipboardMediaLink(data: Pick<DataTransfer, 'getData'>): { url: string; label?: string; fragment?: Descendant[] } | undefined {
  const html = data.getData('text/html')
  const encoded = data.getData('application/x-slate-fragment') || /\bdata-slate-fragment\s*=\s*["']([^"']+)["']/i.exec(html)?.[1]
  if (encoded) {
    try {
      const fragment: unknown = JSON.parse(decodeURIComponent(atob(encoded)))
      if (!Node.isNodeList(fragment) || !fragment.every((node): node is Descendant => !Editor.isEditor(node))) return
      const paragraph = fragment.length === 1 && Element.isElement(fragment[0]) && fragment[0].type === 'paragraph' ? fragment[0] : undefined
      const nodes = paragraph?.children ?? fragment
      // Copied inline boundaries can include empty links alongside the visible link.
      const content = nodes.filter(node => Text.isText(node) ? node.text !== '' :
        !(Element.isElement(node) && node.type === 'anchor' && node.children.every(Text.isText) && Node.string(node) === ''))
      if (content.length !== 1 || !Element.isElement(content[0]) || content[0].type !== 'anchor' || !content[0].children.every(Text.isText)) return
      const url = remoteMediaUrl(content[0].href)
      if (url) return { url, label: Node.string(content[0]), fragment: paragraph ? [{ ...paragraph, children: [content[0]] }] : [content[0]] }
    } catch { /* Invalid internal fragments follow Slate's normal paste handling. */ }
    return
  }
  const plain = remoteMediaUrl(data.getData('text/plain'))
  if (plain) return { url: plain }
  const uri = data.getData('text/uri-list').split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'))
  if (uri.length === 1) {
    const url = remoteMediaUrl(uri[0])
    if (url) return { url }
  }
  if (!html || /<(?:img|video|audio|iframe|object|embed)\b/i.test(html)) return
  const body = new DOMParser().parseFromString(html, 'text/html').body
  const anchors = body.querySelectorAll('a[href]')
  if (anchors.length !== 1 || body.textContent?.trim() !== anchors[0].textContent?.trim()) return
  const url = remoteMediaUrl(anchors[0].getAttribute('href') || '')
  if (url) return { url, label: anchors[0].textContent?.trim() || undefined }
}

/** Paste as a link first. Dismissal or an import error never loses the pasted content. */
export function createMediaUrlPaste(editor: Editor, url: string, label = url, fragment?: Descendant[]) {
  if (editor.wysimark.readOnly || !editor.selection) return
  const insert = () => Editor.withoutNormalizing(editor, () => {
    if (Range.isExpanded(editor.selection!)) Transforms.delete(editor)
    Transforms.unwrapNodes(editor, { match: node => Element.isElement(node) && node.type === 'anchor', split: true })
    if (fragment) editor.insertFragment(fragment)
    else editor.anchor.insertLink(url, label)
  })
  if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, insert)
  else insert()
  const point = editor.selection?.anchor
  const linkAt = (at: typeof point) => at && Editor.above(editor, {
    at, match: node => Element.isElement(node) && node.type === 'anchor' && node.href === url,
  })
  const entry = linkAt(point) || linkAt(point && Editor.before(editor, point))
  if (!entry) return
  const after = Editor.after(editor, entry[1])
  if (after) Transforms.select(editor, after)
  return createMediaLinkImport(editor, entry[1], url)
}

/** The same importer works for a newly pasted URL and an existing selected link. */
export function createMediaLinkImport(editor: Editor, at: Path, url: string) {
  const ref = Editor.pathRef(editor, at)
  const download = editor.wysimark.downloadAttachment, save = editor.wysimark.onImageSave
  const isCurrentDocument = editor.wysimark.isCurrentDocument
  let active = true, pending = false
  const current = () => {
    if (!active || editor.wysimark.readOnly || isCurrentDocument?.() === false || !ref.current) return false
    const node = Editor.node(editor, ref.current)[0]
    return Element.isElement(node) && node.type === 'anchor' && node.href === url
  }
  return {
    path: ref,
    current,
    canEmbed: !!download && !!save,
    dispose() { if (!pending) { active = false; ref.unref() } },
    async embed() {
      if (pending || !download || !save || !current()) return false
      pending = true
      try {
        const file = await download(url)
        if (!current()) return false
        const href = await save(file, file.name)
        if (!current()) return false
        let path = href
        try { path = decodeURI(href) } catch { /* Preserve literal percent signs. */ }
        const preview = attachmentPreviewUrl(file, href) || wikiEmbedUrl(path)
        const at = ref.current!
        const apply = () => Editor.withoutNormalizing(editor, () => {
          Transforms.removeNodes(editor, { at })
          Transforms.insertNodes(editor, { type: 'image-inline', url: preview, alt: file.name, children: [{ text: '' }] }, { at })
        })
        if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, apply)
        else apply()
        return true
      } finally { pending = false; active = false; ref.unref() }
    },
  }
}
export type MediaUrlPaste = NonNullable<ReturnType<typeof createMediaUrlPaste>>
