import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'

type DragHandlers<T extends HTMLElement> = {
  onStart: (event: PointerEvent<T>) => void | false
  onMove: (event: PointerEvent<T>) => void
  onEnd?: () => void
  onCancel?: () => void
}

/** Pointer capture shares mouse/touch dragging and releases it on cancel, blur or unmount. */
export function usePointerDrag<T extends HTMLElement>(handlers: DragHandlers<T>) {
  const latest = useRef(handlers)
  latest.current = handlers
  const active = useRef<{ target: T; id: number; window: Window; blur: () => void } | null>(null)
  const release = useCallback(() => {
    const drag = active.current
    active.current = null
    if (!drag) return
    drag.window.removeEventListener('blur', drag.blur)
    if (drag.target.hasPointerCapture(drag.id)) drag.target.releasePointerCapture(drag.id)
  }, [])
  const finish = useCallback((commit: boolean) => {
    if (!active.current) return
    release()
    if (commit) latest.current.onEnd?.()
    else latest.current.onCancel?.()
  }, [release])
  useEffect(() => release, [release])
  return {
    onPointerDown(event: PointerEvent<T>) {
      if (event.button !== 0 || !event.isPrimary || active.current) return
      event.preventDefault()
      event.stopPropagation()
      if (latest.current.onStart(event) === false) return
      const target = event.currentTarget, window = target.ownerDocument.defaultView!
      const blur = () => finish(false)
      active.current = { target, id: event.pointerId, window, blur }
      target.setPointerCapture(event.pointerId)
      window.addEventListener('blur', blur)
    },
    onPointerMove(event: PointerEvent<T>) {
      if (active.current?.id === event.pointerId) latest.current.onMove(event)
    },
    onPointerUp(event: PointerEvent<T>) { if (active.current?.id === event.pointerId) finish(true) },
    onPointerCancel(event: PointerEvent<T>) { if (active.current?.id === event.pointerId) finish(false) },
    onLostPointerCapture(event: PointerEvent<T>) { if (active.current?.id === event.pointerId) finish(false) },
  }
}
