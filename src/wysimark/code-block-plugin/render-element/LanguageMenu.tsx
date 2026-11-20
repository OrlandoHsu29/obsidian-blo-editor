import { useId, useLayoutEffect, useRef, useState } from 'react'
import { ReactEditor, useSlateStatic } from 'slate-react'
import styled from '@emotion/styled'
import { CloseMask } from '../../shared-overlays'
import { $Menu } from '../../toolbar-plugin/styles'
import { ui } from '../../utils/translations'
import { languageAliases, LanguageList } from '../languages'
import { BuiltInLanguage, CodeBlockElement } from '../types'
import { useAnchoredPanelPosition } from '../../use-reposition/hooks/use-block-toolbar-position'

const $Languages = styled($Menu)`
  position: fixed;
  display: flex;
  flex-direction: column;
  width: 192px;
  min-width: 0;
  padding: 4px;
  font-size: var(--blo-popup-font-size, var(--font-ui-small, 13px));
  line-height: 1.35;
  overflow: hidden;
  transition: none;
  .--search { flex: none; padding: 3px 3px 5px; }
  input { width: 100%; height: 26px; padding-inline: 6px; box-sizing: border-box; font-size: inherit; }
  .--languages { overflow-y: auto; min-height: 0; }
  [role="option"] { padding: 3px 7px; border-radius: 4px; cursor: pointer; }
  [role="option"][aria-selected="true"] { background: var(--background-modifier-hover); color: var(--text-accent); }
  .--empty { padding: 6px 7px; color: var(--text-muted); }
`

export function LanguageMenu({ dest, element, close }: {
  dest: HTMLElement; element: CodeBlockElement; close: () => void
}) {
  const editor = useSlateStatic(), id = useId()
  const panel = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState(''), [selected, setSelected] = useState(0)
  const position = useAnchoredPanelPosition(dest, panel, { close, alignment: 'end', maxHeight: 270 })
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
      <div className="--search">
        <input ref={input} value={query} placeholder={ui('搜索代码语言')} aria-label={ui('搜索代码语言')}
          role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls={id}
          aria-activedescendant={matches.length ? `${id}-${active}` : undefined}
          onChange={event => { setQuery(event.target.value); setSelected(0) }} />
      </div>
      <span id={`${id}-label`} hidden>{ui('代码语言')}</span>
      <div ref={list} id={id} className="--languages" role="listbox" aria-labelledby={`${id}-label`}>
        {matches.map((language, index) => <div key={language} id={`${id}-${index}`} role="option" aria-selected={index === active}
          onMouseEnter={() => setSelected(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(language)}>
          {language === 'text' ? `text — ${ui('Plain text')}` : language}
        </div>)}
        {!matches.length && <div className="--empty">{ui('未找到：{target}', { target: query })}</div>}
      </div>
    </$Languages>
  </>
}
