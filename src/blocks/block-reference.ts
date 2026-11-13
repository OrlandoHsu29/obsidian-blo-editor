import { Editor, Element, Node, Transforms } from 'slate'
import type { Descendant } from 'slate'
import { customAlphabet } from 'nanoid'
import { isEditorSpacer, isListBlock, rootCache } from './model'
import { withHistoryBatch } from '../wysimark/utils/with-history-batch'

const randomId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10)
export const validBlockId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9-]+$/.test(value)

export function canReferenceBlock(node: Node): node is Element {
  return Element.isElement(node) && !isEditorSpacer(node) && node.type !== 'link-definition' &&
    !(node.type === 'paragraph' && !Node.string(node).trim() && !(node.children as Descendant[]).some(child => Element.isElement(child)))
}

export function ensureBlockId(editor: Editor, element: Element): string {
  const index = rootCache(editor).indices.get(element)
  if (editor.wysimark.readOnly || index === undefined || !canReferenceBlock(element)) throw new Error('Block is not available')
  const existing = Array.from(Node.elements(editor), ([node]) => node.__blockId)
  if (validBlockId(element.__blockId) && existing.filter(id => id === element.__blockId).length === 1) return element.__blockId
  const ids = new Set(existing)
  let id: string
  do { id = `blo-${randomId()}` } while (ids.has(id))
  withHistoryBatch(editor, () => Transforms.setNodes(editor, { __blockId: id }, { at: [index] }))
  return id
}

/** IDs use native Obsidian syntax so references also work in native views. */
export function serializeBlockId(element: Element, markdown: string): string {
  if (!validBlockId(element.__blockId)) return markdown
  if (!canReferenceBlock(element)) return markdown
  const id = `^${element.__blockId}`
  if (element.type === 'paragraph' || element.type === 'heading' || isListBlock(element)) {
    // A list item's ID belongs on its first content line, before any nested
    // list/body blocks. A standalone ID would refer to the entire native list.
    if (isListBlock(element)) return markdown.replace(/\n|$/, match => ` ${id}${match}`)
    return markdown.replace(/\n*$/, suffix => ` ${id}${suffix}`)
  }
  return `${markdown.trimEnd()}\n\n${id}\n\n`
}

/** Pasting a copy must not introduce duplicate IDs; cut/paste may retain them. */
export function uniquePastedBlockIds(editor: Editor, fragment: Descendant[]): Descendant[] {
  const hasId = (node: Descendant): boolean => Element.isElement(node) &&
    (validBlockId(node.__blockId) || (node.children as Descendant[]).some(hasId))
  if (!fragment.some(hasId)) return fragment
  const used = new Set(Array.from(Node.elements(editor), ([node]) => node.__blockId).filter(validBlockId))
  const visit = (node: Descendant): Descendant => {
    if (!Element.isElement(node)) return node
    const copy = { ...node, children: node.children.map(visit) } as Element
    if (validBlockId(copy.__blockId)) {
      if (used.has(copy.__blockId)) delete copy.__blockId
      else used.add(copy.__blockId)
    }
    return copy
  }
  return fragment.map(visit)
}
