import { Rect } from "../types"
import { documentForHost } from "../utils"
import { getFixedViewport } from "./get-fixed-viewport"

/**
 * Returns a `Rect` representing the `absolute` positioning coordinates of
 * the hosting window's viewport.
 *
 * NOTE: we add the window's `scrollY` to get the `absolute` position.
 */
export function getAbsoluteViewport(host?: Element | Document | null): Rect {
  const rect = getFixedViewport(host)
  const scrollY = documentForHost(host)?.defaultView?.scrollY ?? 0
  return Object.assign(rect, {
    top: scrollY,
    bottom: scrollY + rect.height,
  })
}
