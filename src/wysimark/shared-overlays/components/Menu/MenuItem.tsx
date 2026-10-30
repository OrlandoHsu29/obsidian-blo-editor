import { useCallback, useContext } from "react"
import { Editor } from "slate"

import { $MenuItem } from "../../../toolbar-plugin/styles"
import { LayerContext, useLayer } from "../../../use-layer"
import { MenuItemData } from "../../types"
import { runMenuAction } from '../../menu-action'
import { formatHotkey } from "./formatHotkey"

export function MenuItem({
  editor,
  item,
  close,
  dest,
}: {
  editor: Editor
  item: Exclude<MenuItemData, "divider">
  close: () => void
  dest: HTMLElement
}) {
  const layer = useContext(LayerContext)
  const menuLayer = useLayer(layer?.type || 'menu')
  const disabled = !!item.disabled?.(editor)

  const onClick = useCallback(() => {
    if (disabled) return
    if (item.Component) {
      const Component = item.Component
      menuLayer.open(() => <Component dest={dest} close={menuLayer.close} />)
    } else if (item.action) {
      if (runMenuAction(item, editor)) close()
    }
  }, [editor, item, disabled, dest, close, menuLayer])
  return (
    <>
      <$MenuItem onClick={onClick} aria-disabled={disabled || undefined} style={disabled ? { opacity: 0.45, cursor: 'default' } : undefined}>
        <div className="--icon">
          <item.icon />
        </div>
        <div className="--title">{item.title}</div>
        <div className="--hotkey">
          {item.hotkey ? formatHotkey(item.hotkey) : undefined}
        </div>
      </$MenuItem>
    </>
  )
}
