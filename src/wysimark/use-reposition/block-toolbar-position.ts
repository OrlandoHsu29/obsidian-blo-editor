import type { Rect } from './types'

export type BlockToolbarOptions = {
  alignment?: 'start' | 'center' | 'end'
  preferredSide?: 'above' | 'below'
  aboveGap?: number
  belowGap?: number
  allowResize?: boolean
  maxHeight?: number
  anchorVisible?: boolean
  offsetX?: number
  offsetY?: number
}

/** Context toolbars follow their block: above first, then below, without pinning. */
export function blockToolbarPosition(anchor: Rect, panel: Pick<Rect, 'width' | 'height'>, viewport: Rect, options: BlockToolbarOptions = {}) {
  const leftEdge = viewport.left + 8, rightEdge = viewport.right - 8
  const topEdge = viewport.top + 8, bottomEdge = viewport.bottom - 8
  const maxWidth = Math.max(0, rightEdge - leftEdge)
  const width = Math.min(panel.width, maxWidth)
  const desiredLeft = options.alignment === 'center' ? anchor.left + (anchor.width - width) / 2 : options.alignment === 'end' ? anchor.right - width : anchor.left
  const naturalHeight = Math.min(panel.height, options.maxHeight ?? panel.height)
  const aboveSpace = Math.max(0, anchor.top - (options.aboveGap ?? 8) - topEdge)
  const belowTop = Math.max(topEdge, anchor.bottom + (options.belowGap ?? 8))
  const belowSpace = Math.max(0, bottomEdge - belowTop)
  const up = options.preferredSide === 'below'
    ? belowSpace < naturalHeight && (aboveSpace >= naturalHeight || !!options.allowResize && aboveSpace > belowSpace)
    : aboveSpace >= naturalHeight || !!options.allowResize && belowSpace < naturalHeight && aboveSpace >= belowSpace
  const height = options.allowResize ? Math.min(naturalHeight, up ? aboveSpace : belowSpace) : naturalHeight
  let top = up ? anchor.top - height - (options.aboveGap ?? 8) : belowTop
  if (options.offsetY) top = Math.max(topEdge, Math.min(top + options.offsetY, bottomEdge - height))
  const anchorVisible = options.anchorVisible ?? (anchor.bottom > topEdge && anchor.top < bottomEdge && anchor.right > leftEdge && anchor.left < rightEdge)
  return {
    left: Math.max(leftEdge, Math.min(desiredLeft + (options.offsetX ?? 0), rightEdge - width)),
    top,
    maxWidth,
    maxHeight: options.allowResize ? height : Math.max(0, viewport.height - 16),
    visible: maxWidth > 0 && height > 0 && anchorVisible && top >= topEdge && top + height <= bottomEdge + 0.5,
  }
}
