import { blockToolbarPosition } from './block-toolbar-position'
import type { BlockToolbarOptions } from './block-toolbar-position'
import { getFixedViewport } from './get-methods/get-fixed-viewport'
import type { Rect } from './types'

export type AnchoredOverlayOptions = BlockToolbarOptions & { getAnchorRect?: () => Rect }
export type AnchoredOverlayPosition = ReturnType<typeof blockToolbarPosition>

function borderBoxSize(style: CSSStyleDeclaration, axis: 'width' | 'height'): number {
  const sides = axis === 'width' ? ['Left', 'Right'] : ['Top', 'Bottom']
  return parseFloat(style[axis]) + (style.boxSizing === 'border-box' ? 0 : sides.reduce((total, side) =>
    total + (parseFloat(style[`padding${side}`]) || 0) + (parseFloat(style[`border${side}Width`]) || 0), 0))
}

/** The editor's visible client area, excluding its own toolbar and find panel. */
export function editorOverlayViewport(anchor: HTMLElement, avoidChrome = true): Rect {
  const viewport = getFixedViewport(anchor), win = anchor.ownerDocument.defaultView!
  const scroller = anchor.closest<HTMLElement>('.wysimark-editor-container')
  if (scroller) {
    const clip = scroller.getBoundingClientRect()
    const x = scroller.offsetWidth ? clip.width / scroller.offsetWidth : 1
    const y = scroller.offsetHeight ? clip.height / scroller.offsetHeight : 1
    viewport.left = Math.max(viewport.left, clip.left + scroller.clientLeft * x)
    viewport.right = Math.min(viewport.right, clip.left + (scroller.clientLeft + scroller.clientWidth) * x)
    viewport.top = Math.max(viewport.top, clip.top + scroller.clientTop * y)
    viewport.bottom = Math.min(viewport.bottom, clip.top + (scroller.clientTop + scroller.clientHeight) * y)
  }
  const tableScroll = anchor.closest<HTMLElement>('.blo-table-frame[data-overflow="true"] .blo-table-scroll')
  if (tableScroll) {
    const clip = tableScroll.getBoundingClientRect()
    const frame = tableScroll.parentElement!
    const left = frame.dataset.moreLeft === 'true' ? frame.getBoundingClientRect().left : clip.left
    viewport.left = Math.max(viewport.left, left)
    viewport.right = Math.min(viewport.right, clip.right)
  }
  if (avoidChrome) {
    const root = anchor.closest('.wysimark-container')
    for (const obstacle of [root?.querySelector<HTMLElement>('[data-wysimark-toolbar]:not([data-wysimark-toolbar="image"])'), root?.querySelector<HTMLElement>('.wysimark-find-panel:not([hidden])')]) {
      if (obstacle && obstacle.getClientRects().length && win.getComputedStyle(obstacle).visibility !== 'hidden') viewport.top = Math.max(viewport.top, obstacle.getBoundingClientRect().bottom)
    }
  }
  viewport.width = Math.max(0, viewport.right - viewport.left)
  viewport.height = Math.max(0, viewport.bottom - viewport.top)
  return viewport
}

/** One measurement and listener lifecycle for React overlays and Obsidian menus. */
export function observeAnchoredOverlay(anchor: HTMLElement, panel: HTMLElement, update: (position: AnchoredOverlayPosition) => void, options: AnchoredOverlayOptions = {}) {
  const doc = anchor.ownerDocument, win = doc.defaultView!
  const root = anchor.closest<HTMLElement>('.wysimark-container')
  const scroller = anchor.closest<HTMLElement>('.wysimark-editor-container')
  const toolbar = root?.querySelector<HTMLElement>('[data-wysimark-toolbar]:not([data-wysimark-toolbar="image"])')
  const findSlot = root?.querySelector<HTMLElement>('[data-wysimark-find-slot]')
  let frame = 0, disposed = false
  const place = () => {
    if (disposed) return
    const viewport = editorOverlayViewport(anchor)
    let rect: Rect = anchor.getBoundingClientRect()
    if (anchor.isConnected && options.getAnchorRect) {
      try { rect = options.getAnchorRect() } catch { return /* Slate may still be committing its DOM selection. */ }
    }
    const box = panel.getBoundingClientRect()
    const style = win.getComputedStyle(panel)
    // offset/client sizes are integer-rounded. Using their difference as a
    // border thickness makes max-height alternate by 1px, toggling scrollbars
    // and rewrapping preview text on every ResizeObserver notification.
    const cssWidth = borderBoxSize(style, 'width') || panel.offsetWidth
    const cssHeight = borderBoxSize(style, 'height') || panel.offsetHeight
    const scaleX = cssWidth ? box.width / cssWidth : 1
    const scaleY = cssHeight ? box.height / cssHeight : 1
    const borderHeight = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0)
    const horizontalScrollbar = panel.scrollWidth > panel.clientWidth + 1
      ? Math.max(0, panel.offsetHeight - panel.clientHeight - borderHeight) : 0
    // Round the intrinsic CSS height up so fractional borders/content cannot
    // create a spurious outer scrollbar when all content already fits.
    const naturalHeight = Math.ceil(panel.scrollHeight + borderHeight + horizontalScrollbar) * scaleY
    const height = options.allowResize ? Math.max(box.height, naturalHeight) : box.height
    const visibleBounds = anchor.closest('[data-wysimark-toolbar]') ? editorOverlayViewport(anchor, false) : viewport
    const anchorVisible = anchor.isConnected && rect.bottom > visibleBounds.top && rect.top < visibleBounds.bottom && rect.right > visibleBounds.left && rect.left < visibleBounds.right
    const position = blockToolbarPosition(rect, { width: box.width, height }, viewport, { ...options, anchorVisible })
    update({ ...position, maxWidth: position.maxWidth / (scaleX || 1), maxHeight: position.maxHeight / (scaleY || 1) })
  }
  const schedule = () => { if (!disposed && !frame) frame = win.requestAnimationFrame(() => { frame = 0; place() }) }
  const resize = new win.ResizeObserver(schedule)
  for (const target of [anchor, panel, scroller, toolbar]) if (target) resize.observe(target)
  const findChanges = findSlot ? new win.MutationObserver(schedule) : undefined
  if (findSlot) findChanges?.observe(findSlot, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style', 'class'] })
  doc.addEventListener('scroll', schedule, true); win.addEventListener('resize', schedule)
  return {
    refresh: schedule,
    place,
    dispose() {
      disposed = true; resize.disconnect(); findChanges?.disconnect(); win.cancelAnimationFrame(frame)
      doc.removeEventListener('scroll', schedule, true); win.removeEventListener('resize', schedule)
    },
  }
}
