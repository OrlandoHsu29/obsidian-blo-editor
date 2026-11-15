import type { ImageSize } from '../../../types'

/** Keep pointer bursts out of React; publish only the newest preview per frame. */
export function createResizePreview(win: Window, publish: (size: ImageSize) => void) {
  let frame = 0, next: ImageSize | undefined
  return {
    queue(size: ImageSize) {
      next = size
      if (!frame) frame = win.requestAnimationFrame(() => {
        frame = 0
        const size = next; next = undefined
        if (size) publish(size)
      })
    },
    cancel() { win.cancelAnimationFrame(frame); frame = 0; next = undefined },
  }
}
