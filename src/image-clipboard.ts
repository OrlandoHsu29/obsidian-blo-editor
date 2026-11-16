import { Node } from 'slate'
import type { Descendant } from 'slate'
import type { TFile } from 'obsidian'
import type { BloView } from './BloView'
import { richContent } from './note-export/rich-content'

/** Standard HTML embeds image bytes; a lone image also gets the OS bitmap format. */
export async function copyImageFragment(view: BloView, source: TFile, fragment: Descendant[], encoded: string, current: () => boolean): Promise<void> {
  const content = await richContent(view, source, fragment, false)
  if (!current()) return
  const doc = view.contentEl.ownerDocument.implementation.createHTMLDocument('')
  doc.body.innerHTML = content.html
  // Optional round-trip metadata is ignored by other apps; their image source
  // is a self-contained data URL rather than an Obsidian-only resource URL.
  doc.body.firstElementChild?.setAttribute('data-slate-fragment', encoded)
  const images = doc.querySelectorAll('img'), hasText = !!doc.body.textContent?.trim()
  const text = fragment.map(node => Node.string(node)).join('\n')
  const { clipboard, nativeImage } = require('electron')
  const image = images.length === 1 && !hasText ? nativeImage.createFromDataURL(images[0].src) : undefined
  await new Promise(resolve => view.contentEl.ownerDocument.defaultView!.setTimeout(resolve, 0))
  if (!current() || !clipboard.readHTML().includes(encoded)) return
  clipboard.write({ html: doc.body.innerHTML, ...(text.trim() ? { text } : {}), ...(image && !image.isEmpty() ? { image } : {}) })
}
