import { Element, Text } from 'slate'
import type { Descendant } from 'slate'
import type { Element as BloElement } from '../wysimark/convert/types'
import type { ListItemElement } from '../wysimark/list-plugin/types'
import { blockDepth, isEditorSpacer, isListBlock } from '../blocks/model'
import { exportHeadingLists } from './heading-lists'
import { serializeElements } from '../wysimark/convert/serialize/serialize-elements'
import { isWikiEmbedUrl, isWikiLinkHref, wikiEmbedSpecFromUrl, wikiLinkSpecFromHref, wikiLinkTarget } from '../wysimark/convert/obsidian-links'
import { imageExtensions, mediaExtensions } from '../media-extensions'

export type ExportLink = (target: string, embedded: boolean) => string
const imageExtension = new RegExp(`\\.(?:${imageExtensions})(?:[?#]|$)`, 'i')
const mediaExtension = new RegExp(`\\.(?:${mediaExtensions}|excalidraw(?:\\.md)?)(?:[?#]|$)`, 'i')
const isList = (node: Descendant): node is ListItemElement => Element.isElement(node) && isListBlock(node)

/** Work on a detached tree. Saved documents, selections and undo history are untouched. */
export function portableDocument(nodes: Descendant[], link: ExportLink = target => target): BloElement[] {
  const bold = (node: Descendant): Descendant => Text.isText(node)
    ? { ...node, bold: true }
    : { ...node, children: node.children.map(bold) } as typeof node
  const clean = (node: Descendant): Descendant => {
    if (Text.isText(node)) {
      const text = { ...node }
      delete text.inlineStyle; delete text.highlight
      return text
    }
    const copy = { ...node, children: node.children.map(clean) } as typeof node
    if (node.__subtitle && copy.type === 'paragraph' || copy.type === 'heading' && copy.level === 5) {
      return {type:'paragraph',children:copy.children.map(bold)}
    }
    for (const key of Object.keys(copy)) if (key.startsWith('__')) delete (copy as unknown as Record<string, unknown>)[key]
    if (copy.type === 'table') { delete copy.headerRow; delete copy.headerColumn }
    if (copy.type === 'anchor') {
      const target = isWikiLinkHref(copy.href) ? wikiLinkTarget(wikiLinkSpecFromHref(copy.href)) : copy.href
      copy.href = safeLink(link(target, false))
      delete copy.markdownSyntax
    }
    if (copy.type === 'image-block' || copy.type === 'image-inline') {
      const target = isWikiEmbedUrl(copy.url) ? wikiLinkTarget(wikiEmbedSpecFromUrl(copy.url)) : copy.url
      const url = safeLink(link(target, true))
      if (mediaExtension.test(target) || !imageExtension.test(target) && !/^(?:https?:|data:image\/)/i.test(target)) {
        const anchor = { type: 'anchor' as const, href: url, children: [{ text: copy.alt || target.split('/').pop() || target }] }
        return copy.type === 'image-block' ? { type: 'paragraph', children: [anchor] } : anchor
      }
      copy.url = url
      delete copy.width; delete copy.height; delete copy.srcWidth; delete copy.srcHeight
    }
    if (isList(copy)) {
      copy.depth = 0
      if (copy.type === 'ordered-list-item') copy.__numbering = 'explicit'
    }
    return copy
  }
  const source = exportHeadingLists(nodes).filter(node => !isEditorSpacer(node))
  type Branch = { node: Descendant; depth: number; children: Branch[] }
  const roots: Branch[] = [], stack: Branch[] = []
  for (const node of source) {
    const branch: Branch = { node, depth: blockDepth(node), children: [] }
    while (stack.length && stack[stack.length - 1].depth >= branch.depth) stack.pop()
    if (stack.length) stack[stack.length - 1].children.push(branch); else roots.push(branch)
    stack.push(branch)
  }
  const render = (branch: Branch): BloElement => {
    const node = clean(branch.node) as BloElement
    if (!branch.children.length) return node
    const children = branch.children.map(render)
    if (isList(node)) {
      const content = node.blockChildren ? node.children : [{ type: 'paragraph' as const, children: node.children }]
      return { ...node, blockChildren: true, children: [...content, ...children] } as BloElement
    }
    return { type: 'unordered-list-item', depth: 0, blockChildren: true, children: [node, ...children] } as BloElement
  }
  // Plain paragraphs/headings cannot be indented in Markdown without becoming
  // code or list items. Keep their reading order; genuine lists retain nesting.
  const flatten = (branch: Branch): BloElement[] => {
    if (isList(branch.node)) return [render(branch)]
    return [clean(branch.node) as BloElement, ...branch.children.flatMap(flatten)]
  }
  return roots.flatMap(flatten)
}

export function portableMarkdown(nodes: BloElement[]): string {
  const output = serializeElements(nodes, { enableInternalLinks: false })
  return output ? output.replace(/\n*$/, '\n') : ''
}

/** Keep executable URLs out of exported Markdown. */
function safeLink(url: string): string {
  return /^(?:javascript|vbscript|data(?!:image\/)):/i.test(url.trim()) ? '' : url
}
