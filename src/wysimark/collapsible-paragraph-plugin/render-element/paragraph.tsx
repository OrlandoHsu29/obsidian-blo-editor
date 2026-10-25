import { clsx } from "clsx"
import { useCallback, useLayoutEffect, useRef } from "react"
import type { CSSProperties } from "react"
import { Editor, Transforms } from "slate"
import { HistoryEditor } from "slate-history"
import { ReactEditor, useReadOnly, useSelected, useSlateSelector, useSlateStatic } from "slate-react"
import { isEditorSpacer, rootCache } from "../../../blocks/model"
import { isStructuredBlock, selectStructuredBoundary } from "../../../blocks/boundary"
import { structuredBlockContent } from '../../../blocks/structured-block'

import { ConstrainedRenderElementProps } from "../../sink"

import { ParagraphElement } from ".."
import { $Paragraph } from "./styles"
import { getIsEmpty } from "./utils"

export function Paragraph({
  element,
  attributes,
  children,
}: ConstrainedRenderElementProps<ParagraphElement>) {
  const editor = useSlateStatic()
  const readOnly = useReadOnly()
  const selected = useSelected()
  const isEmpty = getIsEmpty(element)
  const boundaryRef = useRef<HTMLParagraphElement>(null)
  const attachParagraph = useCallback((node: HTMLParagraphElement | null) => {
    boundaryRef.current = node
    attributes.ref(node)
  }, [attributes.ref])
  const anchor = useSlateSelector(useCallback(editor => {
    const index = rootCache(editor).indices.get(element)
    const previous = index === undefined ? undefined : editor.children[index - 1]
    return isEditorSpacer(element) && isStructuredBlock(previous)
      ? `--blo-${ReactEditor.findKey(editor, previous).id}` : undefined
  }, [element]))
  useLayoutEffect(() => {
    const paragraph = boundaryRef.current
    if (!anchor || !selected || readOnly || !paragraph) return
    let frame = 0
    const index = rootCache(editor).indices.get(element)
    if (index === undefined) return
    const block = ReactEditor.toDOMNode(editor, editor.children[index - 1])
    const position = () => {
      const parent = paragraph.offsetParent as HTMLElement | null
      if (!parent) return
      const root = block.closest<HTMLElement>('[data-wysimark-block]')
      const target = ((root && structuredBlockContent(root)) || block).getBoundingClientRect(), origin = parent.getBoundingClientRect()
      const scale = parent.offsetWidth ? origin.width / parent.offsetWidth : 1
      const line = parseFloat(getComputedStyle(paragraph).lineHeight)
      paragraph.style.left = `${(target.right - origin.left) / scale + parent.scrollLeft - parent.clientLeft + 4}px`
      paragraph.style.top = `${(target.bottom - origin.top) / scale + parent.scrollTop - parent.clientTop - line}px`
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(position) }
    // A selected boundary can live in the next Slate chunk; CSS anchors cannot
    // cross its layout containment. Measure only this active native caret.
    position()
    const observer = new ResizeObserver(schedule)
    observer.observe(block)
    if (paragraph.offsetParent) observer.observe(paragraph.offsetParent)
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame); observer.disconnect()
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      paragraph.style.removeProperty('left'); paragraph.style.removeProperty('top')
    }
  }, [anchor, selected, readOnly, editor, element])
  return (
    <$Paragraph
      {...attributes}
      ref={attachParagraph}
      data-subtitle={element.__subtitle||undefined}
      data-block-boundary={anchor ? true : undefined}
      style={anchor ? { '--blo-boundary-anchor': anchor } as CSSProperties : undefined}
      onMouseDown={event => {
        if (readOnly || event.button !== 0 || !isEmpty || !element.__collapsible) return
        const path = ReactEditor.findPath(editor, element)
        if (anchor && path.length === 1) {
          event.preventDefault()
          selectStructuredBoundary(editor, path[0] - 1)
          ReactEditor.focus(editor)
          return
        }
        if (path.length !== 1 || path[0] !== editor.children.length - 1) return
        // Clicking the trailing insertion line creates a real paragraph now,
        // so its block spacing cannot jump when the first character is typed.
        event.preventDefault()
        const materialize = () => Editor.withoutNormalizing(editor, () => {
          Transforms.unsetNodes(editor, '__collapsible', { at: path })
          Transforms.select(editor, Editor.start(editor, path))
        })
        if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, materialize)
        else materialize()
        ReactEditor.focus(editor)
      }}
      className={clsx({
        "--selected": selected,
        "--empty": isEmpty,
        "--collapsible": !!element.__collapsible,
      })}
    >
      {children}
    </$Paragraph>
  )
}
