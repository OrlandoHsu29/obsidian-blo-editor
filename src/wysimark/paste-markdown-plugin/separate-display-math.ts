import type { Element } from 'slate'
import { blockDepth, isListBlock } from '../../blocks/model'

/** A webpage can put a display equation in the same HTML <li> as its prose. */
export function separatePastedDisplayMath(elements: Element[]): Element[] {
  return elements.flatMap(element => {
    if (element.type === 'block-quote') {
      return { ...element, children: separatePastedDisplayMath(element.children as Element[]) }
    }
    if (!isListBlock(element) || !('blockChildren' in element && element.blockChildren)) return element

    const children = separatePastedDisplayMath(element.children as Element[])
    const firstMath = children.findIndex(child => child.type === 'math-block')
    if (firstMath < 0) return { ...element, children }

    const result: Element[] = []
    const depth = blockDepth(element)
    let keptMarker = false
    let groupStart = 0
    for (let index = 0; index <= children.length; index++) {
      const child = children[index]
      if (child && child.type !== 'math-block') continue
      const group = children.slice(groupStart, index)
      if (group.length && !keptMarker) {
        result.push({ ...element, children: group })
        keptMarker = true
      } else if (group.length) {
        for (const continuation of group) {
          const newDepth = depth + blockDepth(continuation)
          result.push({ ...continuation, __blockDepth: newDepth,
            ...(isListBlock(continuation) ? { depth: newDepth } : {}) })
        }
      }
      if (child) {
        const formulaDepth = depth + blockDepth(child)
        result.push(formulaDepth ? { ...child, __blockDepth: formulaDepth } : child)
      }
      groupStart = index + 1
    }
    return result
  })
}
