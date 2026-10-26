import { useEffect } from "react"

import {
  useThrottledRefresh,
  UseThrottledRefreshReturnType,
} from "./use-throttled-refresh"

/**
 * Refreshes the Component whenever the page is resized or the window is
 * scrolled. This is because these are usually the only two events that cause
 * the elements on a page to be repositioned.
 *
 * If there are yet other events that can cause the elements to be repositioned
 * or resized, you can also call the returned `refresh` method. This will
 * update the components while still respected the fact that the updates will
 * be throttled so as not to overload the browser.
 *
 * Pass the positioned element as `host` so overlays inside a popout window
 * follow that window's resize and scroll instead of the main window's.
 */
export function useReposition(host?: HTMLElement | null): UseThrottledRefreshReturnType {
  /**
   * Create a throttled `refresh` method.
   */
  const refresh = useThrottledRefresh()

  const target = host?.ownerDocument?.defaultView ?? null

  /**
   * refresh on page resize or scroll (throttled)
   */
  useEffect(() => {
    refresh()
    const win = target ?? window
    win.addEventListener("resize", refresh)
    win.addEventListener("scroll", refresh)
    return () => {
      win.removeEventListener("resize", refresh)
      win.removeEventListener("scroll", refresh)
    }
  }, [target])

  return refresh
}
