import { Element, Node } from 'slate'

export const headingLevels = [1, 2, 3, 4] as const
export type HeadingListLevel = typeof headingLevels[number]
export type HeadingListStyle = 'hash' | 'number'
export type HeadingDefaults = Record<HeadingListLevel, HeadingListStyle | null>
export const defaultHeadingListStyles: Readonly<HeadingDefaults> = { 1: 'hash', 2: 'hash', 3: 'hash', 4: null }

export function hasHeadingHashPrefix(heading: Extract<Element, { type: 'heading' }>, defaults?: HeadingDefaults): boolean {
  if (heading.__headingList) return heading.__headingList.enabled
  return (defaults ?? defaultHeadingListStyles)[heading.level as HeadingListLevel] != null
}

export function mapHeadingLevels(styleFor: (level: HeadingListLevel) => HeadingListStyle | null): HeadingDefaults {
  return { 1: styleFor(1), 2: styleFor(2), 3: styleFor(3), 4: styleFor(4) }
}

export function parseHeadingDefaults(value: unknown): HeadingDefaults | undefined {
  if (!value || typeof value !== 'object') return
  const saved = value as Record<string, unknown>
  const { style, levels } = saved
  // Earlier notes share one style across all enabled levels.
  if ((style === 'hash' || style === 'number') && Array.isArray(levels) && levels.every(level => headingLevels.some(known => level === known))) {
    return mapHeadingLevels(level => levels.includes(level) ? style : null)
  }
  if (headingLevels.every(level => saved[level] === null || saved[level] === 'hash' || saved[level] === 'number')) {
    return mapHeadingLevels(level => saved[level] as HeadingDefaults[HeadingListLevel])
  }
}

/** The first block carries document presets, including an otherwise empty note. */
export function headingDefaults(node: Node | undefined): HeadingDefaults | undefined {
  while (Element.isElement(node)) {
    if (node.__headingDefaults) return node.__headingDefaults
    if (!node.type.endsWith('list-item') || !('blockChildren' in node && node.blockChildren)) break
    node = node.children[0]
  }
}
