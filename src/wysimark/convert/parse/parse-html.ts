import type { HTML } from "mdast"

import { Element } from "../types"
import { restoreEscapedWikiLinks } from "../obsidian-links"
import { htmlImages } from './html-image'

export function parseHTML(content: HTML): Element[] {
  const images = htmlImages(content.value)
  if (images) return images.map(image => ({ type: 'image-block', ...image, children: [{ text: '' }] }))
  return [
    {
      type: "html-block",
      html: restoreEscapedWikiLinks(content.value, true),
      children: [{ text: "" }],
    },
  ]
}
