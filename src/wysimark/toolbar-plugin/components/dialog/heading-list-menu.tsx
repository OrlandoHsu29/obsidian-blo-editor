import { useEffect, useId, useRef } from 'react'
import { ReactEditor, useSlate } from 'slate-react'
import { headingListState, setHeadingListStyle, toggleHeadingListLevel } from '../../../../blocks/heading-numbering'
import type { HeadingListStyle } from '../../../../blocks/heading-numbering'
import { $Panel, CloseMask } from '../../../shared-overlays'
import { useAnchoredPanelPosition } from '../../../use-reposition/hooks/use-block-toolbar-position'
import { ui } from '../../../utils/translations'
import { HeadingHashes, ListNumbers } from '../../icons'

export function HeadingListMenu({ dest, close }: { dest: HTMLElement; close: () => void }) {
  const labelId = useId()
  const editor = useSlate(), ref = useRef<HTMLDivElement>(null)
  const state = headingListState(editor)
  const style = useAnchoredPanelPosition(dest, ref, { close })
  const disabled = editor.wysimark.readOnly
  useEffect(() => {
    const doc = dest.ownerDocument
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault(); event.stopImmediatePropagation(); close(); ReactEditor.focus(editor)
    }
    doc.addEventListener('keydown', onKey, true)
    return () => doc.removeEventListener('keydown', onKey, true)
  }, [close, dest, editor])
  const choices = [
    { value: 'hash' as const, title: ui('无序列表'), Icon: HeadingHashes },
    { value: 'number' as const, title: ui('有序列表'), Icon: ListNumbers },
  ]
  const choose = (value: HeadingListStyle) => setHeadingListStyle(editor, value)
  return <>
    <CloseMask close={close} />
    <$Panel ref={ref} style={style} className="blo-heading-list-menu" role="dialog" aria-labelledby={labelId}
      onMouseDown={event => event.preventDefault()}>
      <span id={labelId} hidden>{ui('标题列表')}</span>
      <span id={labelId + '-style'} hidden>{ui('标题前缀样式')}</span>
      <span id={labelId + '-levels'} hidden>{ui('标题级别')}</span>
      <div className="blo-heading-style-choices" role="radiogroup" aria-labelledby={labelId + '-style'}>
        {choices.map(({ value, title, Icon }) => <button key={value} type="button" role="radio" aria-checked={state.style === value}
          tabIndex={state.style === value ? 0 : -1} disabled={disabled} data-heading-style={value} onClick={() => choose(value)}
          onKeyDown={event => {
            if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return
            event.preventDefault()
            const next = value === 'hash' ? 'number' : 'hash'
            choose(next); ref.current?.querySelector<HTMLButtonElement>(`[data-heading-style="${next}"]`)?.focus()
          }}>
          <Icon /><span>{title}</span><span className="blo-heading-style-check" aria-hidden="true">✓</span>
        </button>)}
      </div>
      <div className="blo-heading-list-divider" role="separator" />
      <div className="blo-heading-level-buttons" role="group" aria-labelledby={labelId + '-levels'}>
        {([1, 2, 3, 4] as const).map(level => <button key={level} type="button" disabled={disabled} aria-pressed={state.levels.includes(level)}
          data-heading-level={level} onClick={() => toggleHeadingListLevel(editor, level)}>H{level}</button>)}
      </div>
      <div className="blo-heading-list-hint">{ui('点击各级别应用或清除样式，不包含子标题。')}</div>
    </$Panel>
  </>
}
