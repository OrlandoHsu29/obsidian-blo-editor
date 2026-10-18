import { useId, useLayoutEffect, useRef, useState } from 'react'
import { ReactEditor, useSlateStatic } from 'slate-react'
import styled from '@emotion/styled'
import { CloseMask } from '../../shared-overlays'
import { $Menu } from '../../toolbar-plugin/styles'
import { ui } from '../../utils/translations'
import { languageAliases, LanguageList } from '../languages'
import { BuiltInLanguage, CodeBlockElement } from '../types'

const $Languages = styled($Menu)`
  position: fixed;
  display: flex;
  flex-direction: column;
  width: 240px;
  min-width: 0;
  overflow: hidden;
  transition: none;
  .--search { flex: none; padding: 4px 4px 8px; }
  input { width: 100%; box-sizing: border-box; }
  .--languages { overflow-y: auto; min-height: 0; }
  [role="option"] { padding: 5px 10px; border-radius: 4px; cursor: pointer; }
  [role="option"][aria-selected="true"] { background: var(--background-modifier-hover); color: var(--text-accent); }
  .--empty { padding: 8px 10px; color: var(--text-muted); }
`

export function LanguageMenu({ dest, element, close }: {
  dest: HTMLElement; element: CodeBlockElement; close: () => void
}) {
  const editor = useSlateStatic(), id = useId()
  const panel = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null), search = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState(''), [selected, setSelected] = useState(0)
  const [position, setPosition] = useState({ left: -10000, top: 0, maxHeight: 360 })
  const needle = query.trim().toLowerCase()
  const matches = LanguageList.filter(language => !needle || language.includes(needle) ||
    (language === 'text' && ui('Plain text').toLowerCase().includes(needle)) ||
    (languageAliases[needle] || needle) === (languageAliases[language] || language))
  const active = Math.min(selected, Math.max(0, matches.length - 1))
  const choose = (language: BuiltInLanguage) => {
    editor.codeBlock.setCodeBlockLanguage(language, { at: element })
    close(); ReactEditor.focus(editor)
  }
  useLayoutEffect(() => { input.current?.focus({ preventScroll: true }) }, [])
  useLayoutEffect(() => {
    const menu = panel.current, win = dest.ownerDocument.defaultView!
    if (!menu) return
    const update = () => {
      if (!dest.isConnected) { close(); return }
      const anchor = dest.getBoundingClientRect(), edge = 8, gap = 8
      const natural = Math.min(360, (search.current?.offsetHeight || 0) + (list.current?.scrollHeight || 0) + 14)
      const above = Math.max(0, anchor.top - gap - edge)
      const below = Math.max(0, win.innerHeight - anchor.bottom - gap - edge)
      const up = below < natural && above > below, maxHeight = Math.min(natural, up ? above : below)
      const next = { left: Math.max(edge, Math.min(anchor.right - menu.offsetWidth, win.innerWidth - menu.offsetWidth - edge)),
        top: up ? anchor.top - gap - maxHeight : anchor.bottom + gap, maxHeight }
      setPosition(old => old.left === next.left && old.top === next.top && old.maxHeight === next.maxHeight ? old : next)
    }
    update()
    const observer = new ResizeObserver(update); observer.observe(menu); observer.observe(dest)
    win.addEventListener('resize', update); dest.ownerDocument.addEventListener('scroll', update, true)
    return () => { observer.disconnect(); win.removeEventListener('resize', update); dest.ownerDocument.removeEventListener('scroll', update, true) }
  }, [dest, query, close])
  useLayoutEffect(() => {
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, query])
  return <>
    <CloseMask close={close} />
    <$Languages ref={panel} style={position} data-wysimark-language-menu
      onMouseDown={event => event.stopPropagation()} onKeyDown={event => {
        event.stopPropagation()
        if (event.nativeEvent.isComposing) return
        if (event.key === 'Escape') { event.preventDefault(); close(); ReactEditor.focus(editor) }
        else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          if (matches.length) setSelected((active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length)
        } else if (event.key === 'Enter') { event.preventDefault(); if (matches[active]) choose(matches[active]) }
      }}>
      <div className="--search" ref={search}>
        <input ref={input} value={query} placeholder={ui('搜索代码语言')} aria-label={ui('搜索代码语言')}
          role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls={id}
          aria-activedescendant={matches.length ? `${id}-${active}` : undefined}
          onChange={event => { setQuery(event.target.value); setSelected(0) }} />
      </div>
      <div ref={list} id={id} className="--languages" role="listbox" aria-label={ui('代码语言')}>
        {matches.map((language, index) => <div key={language} id={`${id}-${index}`} role="option" aria-selected={index === active}
          onMouseEnter={() => setSelected(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(language)}>
          {language === 'text' ? `text — ${ui('Plain text')}` : language}
        </div>)}
        {!matches.length && <div className="--empty">{ui('未找到：{target}', { target: query })}</div>}
      </div>
    </$Languages>
  </>
}
