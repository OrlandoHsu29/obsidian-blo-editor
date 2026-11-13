import type { MenuItemData } from '../../../shared-overlays/types'

/** Keep group separators only between groups that still have visible tools. */
export function toolbarIndices(items: readonly MenuItemData[], keep: (index: number) => boolean): number[] {
  const result: number[] = []
  let divider: number | undefined
  items.forEach((item, index) => {
    if (item === 'divider') { divider = index; return }
    if (!keep(index)) return
    if (result.length && divider !== undefined) result.push(divider)
    result.push(index); divider = undefined
  })
  return result
}

/** Pure arithmetic over cached widths; never rearrange the remaining buttons. */
export function fitToolbar(items: readonly MenuItemData[], widths: readonly number[], available: number,
  moreWidth: number, limit = items.length, collapseOrder?: readonly number[]): number[] {
  const kept = new Set(items.flatMap((item, index) => item !== 'divider' && index < limit ? [index] : []))
  const totalButtons = items.filter(item => item !== 'divider').length
  const layout = () => toolbarIndices(items, index => kept.has(index))
  const fits = (indices: number[]) => indices.reduce((sum, index) => sum + widths[index], 0) +
    (kept.size < totalButtons ? moreWidth : 0) <= available + .5
  let visible = layout()
  const order = collapseOrder ?? [...kept].reverse()
  for (const index of order) {
    if (fits(visible)) break
    if (kept.delete(index)) visible = layout()
  }
  return visible
}
