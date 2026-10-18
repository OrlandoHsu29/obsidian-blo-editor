import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, DragEvent, MouseEvent, ReactNode } from 'react'
import type { Menu } from 'obsidian'
import type { Editor, Element } from 'slate'
import { ReactEditor, useReadOnly, useSlateSelector, useSlateStatic } from 'slate-react'
import { ui } from '../wysimark/utils/translations'
import { blockDepth, isEditorSpacer, isListBlock, moveBlockGroup, rootCache } from './model'
import { useFirstLineAlignment } from './first-line-alignment'
import { blockGap } from './typography'
import { clearBlockSelection, selectBlockContents } from './selection'
import { isStructuredBlock, selectStructuredBoundary } from './boundary'
import { showBlockMenu } from './block-menu'

type DropPosition = 'before' | 'inside' | 'after'
const dragging = new WeakMap<Editor, Element>()

function dropPosition(event: DragEvent<HTMLDivElement>): DropPosition {
  const rect = event.currentTarget.getBoundingClientRect()
  const fraction = (event.clientY - rect.top) / Math.max(1, rect.height)
  return fraction < .25 ? 'before' : fraction > .75 ? 'after' : 'inside'
}

export function RootBlock({ element, children }: { element: Element; children: ReactNode }) {
  const editor = useSlateStatic()
  const readOnly = useReadOnly()
  // A preceding block can change without Slate re-rendering this element.
  const { index, gap } = useSlateSelector(useCallback((editor: Editor) => {
    const index = rootCache(editor).indices.get(element)
    return { index, gap: index === undefined || isEditorSpacer(element)
      ? '0px' : blockGap(editor.children, index) }
  }, [element]), (previous, next) => previous?.index === next.index && previous?.gap === next.gap)
  const depth = blockDepth(element)
  const [drop, setDrop] = useState<DropPosition | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const menu = useRef<Menu | null>(null)
  const didDrag = useRef(false)
  const alignHandle = useFirstLineAlignment(ref, '--wysimark-handle-center', true,
    index !== undefined && !isEditorSpacer(element))

  useEffect(() => () => { menu.current?.hide() }, [])
  if (index === undefined || isEditorSpacer(element)) return <>{children}</>

  const selectAndOpenMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (didDrag.current && event.detail > 0) return
    if (!selectBlockContents(editor, index)) return
    ReactEditor.focus(editor)
    menu.current?.hide()
    menu.current = showBlockMenu(editor, index, event.currentTarget)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    const node = dragging.get(editor)
    if (!node) return
    event.preventDefault()
    event.stopPropagation()
    const from = rootCache(editor).indices.get(node)
    if (from !== undefined && moveBlockGroup(editor, from, index, dropPosition(event))) {
      ReactEditor.focus(editor)
    }
    dragging.delete(editor)
    setDrop(null)
  }

  return <div ref={ref} data-wysimark-block data-block-type={element.type}
    data-block-depth={depth} data-subtitle={element.__subtitle || undefined}
    className={drop ? `wysimark-block drop-${drop}` : 'wysimark-block'}
    style={{ position: 'relative', marginLeft: isListBlock(element) ? undefined : `${depth * 2}em`,
      marginTop: gap, '--blo-block-anchor': `--blo-${ReactEditor.findKey(editor, element).id}` } as CSSProperties}
    onMouseDownCapture={event => {
      if (!(event.target as HTMLElement).closest('.wysimark-block-handle')) clearBlockSelection(editor)
    }}
    onMouseDown={event => {
      if (readOnly || event.button !== 0 || event.shiftKey || !isStructuredBlock(element)) return
      const content = ref.current?.querySelector<HTMLElement>('table,[data-wysimark-code-block]')
      if (!content || event.clientX < content.getBoundingClientRect().right) return
      event.preventDefault(); event.stopPropagation()
      if (selectStructuredBoundary(editor, index)) ReactEditor.focus(editor)
    }}
    onMouseEnter={alignHandle} onFocusCapture={alignHandle}
    onDragOver={event => {
      if (!dragging.has(editor)) return
      event.preventDefault()
      event.stopPropagation()
      setDrop(dropPosition(event))
    }}
    onDragLeave={event => {
      if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) setDrop(null)
    }} onDrop={onDrop}>
    {!readOnly && <button className="wysimark-block-handle" contentEditable={false} draggable
      aria-label={ui('拖动整块及子块；点击选中并打开块菜单')} data-tooltip-position="right"
      onMouseDown={() => { didDrag.current = false }}
      onClick={selectAndOpenMenu} onContextMenu={selectAndOpenMenu}
      onDragStart={event => {
        didDrag.current = true
        menu.current?.hide()
        dragging.set(editor, element)
        event.dataTransfer.setData('application/x-wysimark-block', String(index))
        event.dataTransfer.effectAllowed = 'move'
        event.stopPropagation()
      }} onDragEnd={() => { dragging.delete(editor); setDrop(null) }}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        <circle cx="8" cy="6" r="1.5"/><circle cx="16" cy="6" r="1.5"/>
        <circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/>
        <circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/>
      </svg>
    </button>}
    {children}
  </div>
}
