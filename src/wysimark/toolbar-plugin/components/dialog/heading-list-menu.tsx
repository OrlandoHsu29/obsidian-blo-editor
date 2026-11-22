import { useEffect, useId, useRef } from 'react'
import { ReactEditor, useReadOnly, useSlateSelector, useSlateStatic } from 'slate-react'
import { headingListState, toggleHeadingListLevel } from '../../../../blocks/heading-numbering'
import { headingLevels } from '../../../../blocks/heading-defaults'
import { $Panel, CloseMask } from '../../../shared-overlays'
import { useAnchoredPanelPosition } from '../../../use-reposition/hooks/use-block-toolbar-position'
import { ui } from '../../../utils/translations'

export function HeadingListMenu({ dest, close }: { dest: HTMLElement; close: () => void }) {
  const labelId = useId()
  const editor = useSlateStatic(), ref = useRef<HTMLDivElement>(null)
  const state = useSlateSelector(headingListState)
  const style = useAnchoredPanelPosition(dest, ref, { close })
  const disabled = useReadOnly()
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
    { value: 'hash', title: ui('无序列表') },
    { value: 'number', title: ui('有序列表') },
  ] as const
  return <>
    <CloseMask close={close} isInside={target => dest.contains(target)} />
    <$Panel ref={ref} style={style} className="blo-heading-list-menu" role="dialog" aria-labelledby={labelId}
      onMouseDown={event => event.preventDefault()}>
      <span id={labelId} hidden>{ui('标题列表')}</span>
      {choices.map(({ value, title }) => <div key={value} className="blo-heading-list-group" role="group" aria-labelledby={`${labelId}-${value}`}>
        <span id={`${labelId}-${value}`}>{title}</span>
        <div className="blo-heading-level-buttons">
          {headingLevels.map(level => <button key={level} type="button" disabled={disabled} aria-pressed={state.activeLevels[value].includes(level)}
            data-heading-level={level} data-heading-style={value} onClick={() => toggleHeadingListLevel(editor, level, value)}>H{level}</button>)}
        </div>
      </div>)}
    </$Panel>
  </>
}
