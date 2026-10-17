import { ui } from "./wysimark/utils/translations"
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Editor, Transforms } from 'slate'
import { ReactEditor, useFocused, useSlate } from 'slate-react'
import { getSlashContext, slashCommands } from './slash-menu'

export function SlashPopover() {
  const editor = useSlate(), focused = useFocused(), context = focused ? getSlashContext(editor) : null
  const [dismissed, setDismissed] = useState('')
  const [choice, setChoice] = useState({key: '', index: 0})
  const popup = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({left: 0, top: 0, maxHeight: 280})
  const matches = slashCommands.filter(command => command.title.includes(context?.query || ''))
  const visible = !!context && context.key !== dismissed && matches.length > 0
  const selected = choice.key === context?.key ? Math.min(choice.index, matches.length - 1) : 0
  const choose = (index: number) => {
    if (!context || !matches[index]) return
    Editor.withoutNormalizing(editor, () => {
      Transforms.select(editor, context.range)
      Transforms.delete(editor)
      matches[index].run(editor)
    })
    ReactEditor.focus(editor)
  }
  useLayoutEffect(() => {
    if (!visible || !editor.selection) return
    const update = () => {
      try {
        if (!popup.current || !editor.selection) return
        const rect = ReactEditor.toDOMRange(editor, editor.selection).getBoundingClientRect()
        const menu = popup.current
        const gap = 12, edge = 8
        // Measure rendered content instead of guessing option heights or shifting
        // a below-caret menu upward through the current line.
        const naturalHeight = Math.min(menu.scrollHeight + menu.offsetHeight - menu.clientHeight, 280)
        const above = Math.max(0, rect.top - gap - edge)
        const below = Math.max(0, window.innerHeight - rect.bottom - gap - edge)
        const placeAbove = above >= naturalHeight || above >= below
        const maxHeight = Math.min(naturalHeight, placeAbove ? above : below)
        const width = menu.getBoundingClientRect().width
        const left = Math.max(edge, Math.min(rect.left, window.innerWidth - width - edge))
        const top = placeAbove ? rect.top - gap - maxHeight : rect.bottom + gap
        setPosition({left, top, maxHeight})
      } catch { /* Wait for Slate's DOM selection to update. */ }
    }
    update()
    document.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => { document.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
  }, [visible, context?.key])
  useEffect(() => {
    if (!visible) return
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || !ReactEditor.toDOMNode(editor, editor).contains(event.target as globalThis.Node)) return
      if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) return
      event.preventDefault(); event.stopImmediatePropagation()
      if (event.key === 'Escape') setDismissed(context!.key)
      else if (event.key === 'Enter') choose(selected)
      else setChoice({key: context!.key, index: (selected + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length})
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [visible, context?.key, selected])
  if (!visible) return null
  return createPortal(<div ref={popup} className="wysimark-slash-popover" role="listbox" aria-label={ui("简洁命令菜单")} style={{position:'fixed', boxSizing:'border-box', maxWidth:'calc(100vw - 16px)', ...position}} onMouseDown={event => event.preventDefault()}>
    {matches.map((command, index) => <div key={command.title} role="option" aria-selected={index === selected} className={index === selected ? 'is-selected' : ''} onMouseEnter={() => setChoice({key:context!.key,index})} onClick={() => choose(index)}>{command.title}</div>)}
  </div>, document.body)
}
