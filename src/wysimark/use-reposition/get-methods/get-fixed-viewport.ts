import { Rect } from "../types"
import { documentForHost } from "../utils"

/**
 * Returns a `Rect` representing the `fixed` positioning coordinates of the
 * window that hosts `host`; a popout window measures its own viewport.
 */
export function getFixedViewport(host?: Element | Document | null): Rect {
  const doc = documentForHost(host)
  const win = doc?.defaultView ?? window
  /**
   * Get the width of the viewport not including the scrollbar
   *
   * https://stackoverflow.com/a/25298418
   */
  const width = doc?.documentElement?.clientWidth || doc?.body?.clientWidth || win.innerWidth
  const height = win.innerHeight
  return {
    top: 0,
    right: width,
    bottom: height,
    left: 0,
    width: width,
    height: height,
  }
}
