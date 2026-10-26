import { Rect } from "../types"
import { getFixedRect } from "./get-fixed-rect"

/**
 * Returns a `Rect` representing the `absolute` positioning coordinates of
 * the `HTMLElement`
 *
 * NOTE: we add the owning window's `scrollY` to get the `absolute` position.
 */
export function getAbsoluteRect(domElement: HTMLElement): Rect {
  const rect = getFixedRect(domElement)
  const { scrollY } = domElement.ownerDocument?.defaultView ?? { scrollY: 0 }
  return Object.assign(rect, {
    top: rect.top + scrollY,
    bottom: rect.bottom + scrollY,
  })
}
