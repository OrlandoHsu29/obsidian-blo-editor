import { useRef, useCallback } from "react"
import styled from "@emotion/styled"

const $DragHandle = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 0;
  left: 12px;
  right: 12px;
  height: 6px;
  cursor: grab;
  background: transparent;
  user-select: none;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }
`

const $DragIndicator = styled.div`
  display: none;
`

interface DraggableHeaderProps {
  onDrag: (deltaX: number, deltaY: number) => void
}

export function DraggableHeader({ onDrag }: DraggableHeaderProps) {
  const startPos = useRef<{ x: number; y: number } | null>(null)

  const handleStart = useCallback((clientX: number, clientY: number) => {
    startPos.current = { x: clientX, y: clientY }
  }, [])

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!startPos.current) return
    const deltaX = clientX - startPos.current.x
    const deltaY = clientY - startPos.current.y
    startPos.current = { x: clientX, y: clientY }
    onDrag(deltaX, deltaY)
  }, [onDrag])

  const handleEnd = useCallback(() => {
    startPos.current = null
  }, [])

  // Mouse events
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    handleStart(e.clientX, e.clientY)

    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY)
    }
    const onMouseUp = () => {
      handleEnd()
      activeDocument.removeEventListener("mousemove", onMouseMove)
      activeDocument.removeEventListener("mouseup", onMouseUp)
    }

    activeDocument.addEventListener("mousemove", onMouseMove)
    activeDocument.addEventListener("mouseup", onMouseUp)
  }, [handleStart, handleMove, handleEnd])

  // Touch events
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    handleStart(touch.clientX, touch.clientY)
  }, [handleStart])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    // touch-action: none in CSS prevents scrolling, so no need for preventDefault
    const touch = e.touches[0]
    handleMove(touch.clientX, touch.clientY)
  }, [handleMove])

  const onTouchEnd = useCallback(() => {
    handleEnd()
  }, [handleEnd])

  return (
    <$DragHandle
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <$DragIndicator />
    </$DragHandle>
  )
}
