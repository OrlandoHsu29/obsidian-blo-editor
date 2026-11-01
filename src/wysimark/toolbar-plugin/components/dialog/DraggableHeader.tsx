import { useRef } from "react"
import styled from "@emotion/styled"
import { usePointerDrag } from '../../../utils/use-pointer-drag'

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

interface DraggableHeaderProps {
  onDrag: (deltaX: number, deltaY: number) => void
}

export function DraggableHeader({ onDrag }: DraggableHeaderProps) {
  const startPos = useRef<{ x: number; y: number } | null>(null)

  const drag = usePointerDrag<HTMLDivElement>({
    onStart: event => { startPos.current = { x: event.clientX, y: event.clientY } },
    onMove: event => {
      const previous = startPos.current!
      startPos.current = { x: event.clientX, y: event.clientY }
      onDrag(event.clientX - previous.x, event.clientY - previous.y)
    },
  })
  return <$DragHandle {...drag} />
}
