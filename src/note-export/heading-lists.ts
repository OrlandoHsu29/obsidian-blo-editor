import { Element, Text } from 'slate'
import type { Descendant } from 'slate'
import { blockDepth, resolveOrderedNumbers } from '../blocks/model'

/** Put actual heading numbers in the text so external renderers cannot renumber them.
 * Hash prefixes are editor CSS only. Work on detached nodes and leave body lists intact. */
export function exportHeadingLists(nodes: Descendant[]): Descendant[] {
  const numbering = nodes.some(node => Element.isElement(node) && node.type === 'ordered-list-item')
    ? resolveOrderedNumbers(nodes) : undefined
  return nodes.flatMap(node => {
    if (Text.isText(node)) return [{ ...node }]
    const children = exportHeadingLists(node.children)
    const first = node.children[0]
    if (node.type === 'ordered-list-item' && node.blockChildren && Element.isElement(first) &&
      first.type === 'heading' && first.level !== 5) {
      const [heading, ...rest] = children
      const label = numbering!.numberLabels.get(node) ?? `${numbering!.numbers.get(node) ?? 1}.`
      return [{
        ...heading, __blockDepth: Math.max(blockDepth(node), blockDepth(heading)),
        children: [{ text: label + ' ' }, ...(heading as Element).children],
      } as Descendant, ...rest.map(child => Element.isElement(child)
        ? { ...child, __blockDepth: Math.max(blockDepth(node), blockDepth(child)) } : child)]
    }
    return [{ ...node, children, ...(node.type === 'ordered-list-item'
      ? { start: numbering!.numbers.get(node) ?? node.start, __numbering: 'explicit' as const } : {}) } as Descendant]
  })
}
