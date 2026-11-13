import { useEffect, useMemo, useRef } from 'react'
import type { MenuItemData } from '../../../shared-overlays/types'
import { CloseMask } from '../../../shared-overlays'
import { useAnchoredPanelPosition } from '../../../use-reposition/hooks/use-block-toolbar-position'
import { $Menu, $ToolbarDivider, $ToolbarDividerContainer } from '../../styles'
import { ToolbarButton } from './toolbar-button'
import { useLayer } from '../../../use-layer'

export function ToolbarOverflowMenu({ dest, items, close }: { dest: HTMLElement; items: MenuItemData[]; close: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const child = useRef<HTMLDivElement>(null)
  const submenu = useLayer('toolbar-submenu')
  useEffect(() => () => submenu.close(), [])
  const toolbarStyle = useMemo(() => {
    const toolbar = dest.closest<HTMLElement>('[data-wysimark-toolbar]')
    if (!toolbar) return {}
    const style = toolbar.ownerDocument.defaultView!.getComputedStyle(toolbar)
    // This is a second toolbar row, so use the main row's metrics rather than
    // the smaller dialog scale used by other quick-memo popups.
    return { fontSize: style.fontSize, padding: `0 ${style.paddingRight} 0 ${style.paddingLeft}`,
      borderRadius: style.borderRadius, boxShadow: style.boxShadow, transform: 'none' }
  }, [dest])
  const style = useAnchoredPanelPosition(dest, panel, { close })
  const content = [...items]
  while (content[0] === 'divider') content.shift()
  while (content[content.length - 1] === 'divider') content.pop()
  return <>
    <CloseMask close={close} isInside={target => dest.contains(target) || !!child.current?.contains(target)} />
    <$Menu ref={panel} style={{ ...style, ...toolbarStyle }} className="blo-toolbar-overflow-menu" role="menu" data-overlay-placement="below">
      {content.map((item, index) => item === 'divider'
        ? <$ToolbarDividerContainer key={index} className="blo-toolbar-overflow-divider" aria-hidden="true"><$ToolbarDivider /></$ToolbarDividerContainer>
        : <ToolbarButton key={item.title} item={item} inOverflow menuAnchorRef={panel} submenuRef={child} closeOverflow={close} />)}
    </$Menu>
  </>
}
