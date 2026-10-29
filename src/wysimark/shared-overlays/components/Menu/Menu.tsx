import { useRef } from "react"
import { useSlateStatic } from "slate-react"

import { useAnchoredPanelPosition } from '../../../use-reposition/hooks/use-block-toolbar-position'

import { $Menu, $MenuDivider } from "../../../toolbar-plugin/styles"
import { MenuItemData } from "../../types"
import { CloseMask } from "../CloseMask"
import { MenuItem } from "./MenuItem"

export function Menu({
  dest,
  items,
  close,
}: {
  dest: HTMLElement
  close: () => void
  items: MenuItemData[]
}) {
  const editor = useSlateStatic()
  const ref = useRef<HTMLDivElement>(null)
  const style = useAnchoredPanelPosition(dest, ref, { close, offsetX: -8 })

  return (
    <>
      <CloseMask close={close} />
      <$Menu ref={ref} style={style}>
        {items.map((item, index) => {
          if (item === "divider") {
            return <$MenuDivider key={index} />
          } else if (item.show && !item.show(editor)) {
            return null
          } else {
            return (
              <MenuItem
                key={index}
                editor={editor}
                item={item}
                close={close}
                dest={dest}
              />
            )
          }
        })}
      </$Menu>
    </>
  )
}
