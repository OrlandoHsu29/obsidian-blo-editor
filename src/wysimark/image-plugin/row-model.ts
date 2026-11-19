import { Element } from 'slate'
import { imageExtensions, mediaExtensions } from '../../media-extensions'
import { isWikiEmbedUrl, splitWikiSpec, wikiEmbedSpecFromUrl } from '../convert/obsidian-links'
import type { ImageRowCaretElement, ImageRowElement } from './types'

const wikiImage = new RegExp(`\\.(?:${imageExtensions})(?:[#?]|$)`, 'i')
const otherMedia = new RegExp(`\\.(?:${mediaExtensions}|excalidraw(?:\\.md)?)(?:[#?]|$)`, 'i')
export type ImageBlockElement = Extract<Element, {type:'image-block'}>

export function imageRowCaret(): ImageRowCaretElement {
  return {type:'image-row-caret',children:[{text:''}]}
}

export function imageRowChildren(images: ImageBlockElement[]): ImageRowElement['children'] {
  return images.flatMap<ImageRowElement['children'][number]>(image => [imageRowCaret(), image])
}

export function rowImages(row: ImageRowElement): ImageBlockElement[] {
  return row.children.filter((child): child is ImageBlockElement => child.type === 'image-block')
}

export function isRowImage(node: unknown): node is ImageBlockElement {
  if (!Element.isElement(node) || node.type !== 'image-block' || !node.url) return false
  return isWikiEmbedUrl(node.url) ? wikiImage.test(splitWikiSpec(wikiEmbedSpecFromUrl(node.url)).target) : !otherMedia.test(node.url)
}
