import { Element, Node } from 'slate'

export type HeadingDefaults = { style: 'hash' | 'number'; levels: (1 | 2 | 3 | 4)[] }

/** The first block carries document presets, including an otherwise empty note. */
export function headingDefaults(node: Node | undefined): HeadingDefaults | undefined {
  while (Element.isElement(node)) {
    if (node.__headingDefaults) return node.__headingDefaults
    if (!node.type.endsWith('list-item') || !('blockChildren' in node && node.blockChildren)) break
    node = node.children[0]
  }
}
