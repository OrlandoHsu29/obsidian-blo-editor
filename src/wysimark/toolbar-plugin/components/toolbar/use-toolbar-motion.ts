import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'

type Item = { node: HTMLElement; x: number; y: number; width: number; height: number }
type Layout = { width: number; items: Map<string, Item> }
const timing = { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }
// Animated output does not change the overflow budget (parent and controls).
export const toolbarWidthMotion = new WeakMap<HTMLElement, Animation>()

/** Animate the final toolbar layout, keeping overflow measurements independent. */
export function createToolbarMotion(host: HTMLElement) {
  const win = host.ownerDocument.defaultView!
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)')
  const animations = new Set<Animation>(), ghosts = new Set<HTMLElement>()
  let previous: Layout | undefined, ready = false, frame = 0, disposed = false
  const cancel = () => {
    toolbarWidthMotion.delete(host)
    for (const animation of animations) animation.cancel()
    animations.clear()
    for (const ghost of ghosts) ghost.remove()
    ghosts.clear()
  }
  const motionChanged = () => { if (reduced.matches) cancel() }
  reduced.addEventListener('change', motionChanged)
  const animate = (node: HTMLElement, frames: Keyframe[], finish?: () => void) => {
    const animation = node.animate(frames, timing)
    if (node === host) toolbarWidthMotion.set(host, animation)
    animations.add(animation)
    animation.onfinish = animation.oncancel = () => {
      if (toolbarWidthMotion.get(host) === animation) toolbarWidthMotion.delete(host)
      animations.delete(animation); finish?.()
    }
  }
  return {
    update() {
      if (disposed) return
      if (!host.isConnected || !host.getClientRects().length) {
        cancel(); win.cancelAnimationFrame(frame); frame = 0
        previous = undefined; ready = false
        return
      }
      const old = previous
      // Read ongoing translations before cancelling so rapid changes continue
      // from the current visual position rather than snapping to a prior end.
      const positions = new Map<string, { x: number; y: number; opacity: number }>()
      for (const [key, item] of old?.items ?? []) {
        if (!animations.size) { positions.set(key, { x: item.x, y: item.y, opacity: 1 }); continue }
        const style = win.getComputedStyle(item.node)
        const matrix = new win.DOMMatrixReadOnly(style.transform && style.transform !== 'none' ? style.transform : undefined)
        const opacity = parseFloat(style.opacity)
        positions.set(key, { x: item.x + matrix.m41, y: item.y + matrix.m42, opacity: Number.isFinite(opacity) ? opacity : 1 })
      }
      const currentWidth = animations.size ? parseFloat(win.getComputedStyle(host).width) : old?.width
      cancel()
      const style = win.getComputedStyle(host), box = host.getBoundingClientRect()
      const px = (value: string) => parseFloat(value) || 0
      const width = px(style.width)
      const borderLeft = px(style.borderLeftWidth), borderTop = px(style.borderTopWidth)
      const borderWidth = style.boxSizing === 'border-box' ? width : width + px(style.paddingLeft) + px(style.paddingRight) + borderLeft + px(style.borderRightWidth)
      const scale = borderWidth ? box.width / borderWidth : 1
      const items = new Map<string, Item>()
      for (const node of host.querySelectorAll<HTMLElement>('[data-toolbar-motion-key]:not(.blo-toolbar-item-hidden)')) {
        const rect = node.getBoundingClientRect()
        items.set(node.dataset.toolbarMotionKey!, { node, x: (rect.left - box.left) / scale, y: (rect.top - box.top) / scale, width: rect.width / scale, height: rect.height / scale })
      }
      previous = { width, items }
      if (!old) {
        // Initial overflow classification happens before the first paint.
        frame = win.requestAnimationFrame(() => { frame = 0; ready = true })
        return
      }
      if (!ready || reduced.matches || typeof host.animate !== 'function') return
      if (currentWidth !== undefined && Math.abs(currentWidth - width) > .5) {
        animate(host, [{ width: `${currentWidth}px` }, { width: `${width}px` }])
      }
      for (const [key, item] of items) {
        const from = positions.get(key)
        if (!from) {
          animate(item.node, [{ opacity: 0, transform: 'translateX(4px)' }, { opacity: 1, transform: 'translateX(0)' }])
        } else {
          const x = from.x - item.x, y = from.y - item.y
          if (Math.abs(x) > .5 || Math.abs(y) > .5 || from.opacity < .99) {
            animate(item.node, [{ transform: `translate(${x}px,${y}px)`, opacity: from.opacity }, { transform: 'translate(0,0)', opacity: 1 }])
          }
        }
      }
      for (const [key, item] of old.items) {
        if (items.has(key)) continue
        const from = positions.get(key)!
        const ghost = item.node.cloneNode(true) as HTMLElement
        // Exit visuals neither participate in measurement nor receive input,
        // focus, hotkeys or tooltips. They are removed when the fade finishes.
        for (const node of [ghost, ...ghost.querySelectorAll<HTMLElement>('*')]) {
          for (const attribute of ['data-toolbar-index', 'data-toolbar-motion-key', 'data-toolbar-overflow-trigger', 'data-toolbar-title', 'aria-label', 'title', 'tabindex']) node.removeAttribute(attribute)
        }
        ghost.classList.remove('blo-toolbar-item-hidden')
        ghost.setAttribute('aria-hidden', 'true'); ghost.inert = true
        Object.assign(ghost.style, { position: 'absolute', left: `${from.x - borderLeft}px`, top: `${from.y - borderTop}px`, width: `${item.width}px`, height: `${item.height}px`, pointerEvents: 'none', userSelect: 'none' })
        host.append(ghost); ghosts.add(ghost)
        animate(ghost, [{ opacity: from.opacity, transform: 'translateX(0)' }, { opacity: 0, transform: 'translateX(-4px)' }], () => { ghost.remove(); ghosts.delete(ghost) })
      }
    },
    dispose() {
      disposed = true
      cancel(); win.cancelAnimationFrame(frame)
      reduced.removeEventListener('change', motionChanged)
      previous = undefined
    },
  }
}

export function useToolbarMotion(toolbar: RefObject<HTMLElement | null>, items: readonly unknown[], count: number, enabled: boolean) {
  const state = useRef<{ host: HTMLElement; motion: ReturnType<typeof createToolbarMotion> } | null>(null)
  useLayoutEffect(() => {
    const host = toolbar.current
    if (!enabled || !host) { state.current?.motion.dispose(); state.current = null; return }
    if (state.current?.host !== host) {
      state.current?.motion.dispose()
      state.current = { host, motion: createToolbarMotion(host) }
    }
    state.current.motion.update()
  }, [toolbar, items, count, enabled])
  useLayoutEffect(() => () => { state.current?.motion.dispose(); state.current = null }, [])
}
