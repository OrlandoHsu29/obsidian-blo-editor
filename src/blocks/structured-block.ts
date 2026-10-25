import { Element } from 'slate'

// Keep keyboard navigation, gutter hit testing, highlights and spacing on the
// same set of block kinds. Media variants share the image-block renderer.
const kinds = {
  table: { editable: true, content: 'table' },
  'code-block': { editable: true, content: '[data-wysimark-code-block]' },
  'image-block': { editable: false, content: '[data-blo-drawing],[data-blo-image]' },
  'math-block': { editable: false, content: '[data-blo-math="block"]' },
} as const

type StructuredType = keyof typeof kinds
type StructuredBlock = Extract<Element, { type: StructuredType }>

function isStructuredType(type: string | undefined): type is StructuredType {
  return !!type && Object.prototype.hasOwnProperty.call(kinds, type)
}

export function isStructuredBlock(node: unknown): node is StructuredBlock {
  return Element.isElement(node) && isStructuredType(node.type)
}

export function isEditableStructure(node: unknown): boolean {
  return isStructuredBlock(node) && kinds[node.type].editable
}

export const structuredBlockSelector = Object.keys(kinds)
  .map(type => `[data-wysimark-block][data-block-type="${type}"]`).join(',')

export function structuredBlockContent(root: HTMLElement): HTMLElement | null {
  const type = root.dataset.blockType
  return isStructuredType(type) ? root.querySelector<HTMLElement>(kinds[type].content) : null
}
