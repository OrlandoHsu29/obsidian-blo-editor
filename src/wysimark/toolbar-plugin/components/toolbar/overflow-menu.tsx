import { useEffect, useRef } from 'react'
import type { MenuItemData } from '../../../shared-overlays/types'
import { CloseMask } from '../../../shared-overlays'
import { useAnchoredPanelPosition } from '../../../use-reposition/hooks/use-block-toolbar-position'
import { $Menu, $MenuDivider } from '../../styles'
import { ToolbarButton } from './toolbar-button'
import { useLayer } from '../../../use-layer'

export function ToolbarOverflowMenu({ dest, items, close }: { dest: HTMLElement; items: MenuItemData[]; close: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const child = useRef<HTMLDivElement>(null)
  const submenu = useLayer('toolbar-submenu')
  useEffect(() => () => submenu.close(), [])
  const style = useAnchoredPanelPosition(dest, panel, { close })
  const content = [...items]
  while (content[0] === 'divider') content.shift()
  while (content[content.length - 1] === 'divider') content.pop()
  return <>
    <CloseMask close={close} isInside={target => dest.contains(target) || !!child.current?.contains(target)} />
    <$Menu ref={panel} style={style} className="blo-toolbar-overflow-menu" role="menu" data-overlay-placement="below">
      {content.map((item, index) => item === 'divider'
        ? <$MenuDivider key={index} className="blo-toolbar-overflow-divider" />
        : <ToolbarButton key={item.title} item={item} inOverflow menuAnchorRef={panel} submenuRef={child} closeOverflow={close} />)}
    </$Menu>
  </>
}
