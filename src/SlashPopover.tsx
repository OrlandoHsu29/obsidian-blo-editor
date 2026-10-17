import { ui } from "./wysimark/utils/translations"
import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Editor, Transforms } from 'slate'
import { ReactEditor, useFocused, useSlate } from 'slate-react'
import { getSlashContext, slashCommands } from './slash-menu'

export function SlashPopover() {
  const editor = useSlate(), focused = useFocused(), context = focused ? getSlashContext(editor) : null
  const [dismissed, setDismissed] = useState('')
  const [choice, setChoice] = useState({key: '', index: 0})
  const [position, setPosition] = useState({left: 0, top: 0})
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
        const rect = ReactEditor.toDOMRange(editor, editor.selection!).getBoundingClientRect()
        setPosition({left: Math.max(8, Math.min(rect.left, window.innerWidth - 268)), top: rect.bottom + 6 + Math.min(0, window.innerHeight - rect.bottom - Math.min(matches.length * 36 + 16, 280) - 14)})
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
  return createPortal(<div className="wysimark-slash-popover" role="listbox" aria-label={ui("简洁命令菜单")} style={{position:'fixed', ...position}} onMouseDown={event => event.preventDefault()}>
    {matches.map((command, index) => <div key={command.title} role="option" aria-selected={index === selected} className={index === selected ? 'is-selected' : ''} onMouseEnter={() => setChoice({key:context!.key,index})} onClick={() => choose(index)}>{command.title}</div>)}
  </div>, document.body)
}
