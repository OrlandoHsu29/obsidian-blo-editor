import { clsx } from "clsx"
import { useCallback, useRef } from "react"
import { ReactEditor, useSlate, useSlateStatic } from "slate-react"

import { formatHotkey, Menu, MenuItemData } from "../../../shared-overlays"
import { useLayer } from "../../../use-layer"
import { tooltipLabel } from "../../../use-tooltip"
import { r } from "../../../utils/translations"

import { $ToolbarButton } from "../../styles"

export function ToolbarButton({
  item,
}: {
  item: Exclude<MenuItemData, "divider">
}) {
  const staticEditor = useSlateStatic()
  const editor = useSlate()  // エディタの状態変更を検知
  const isActive = item.active ? item.active(editor) : false
  const isDisabled = item.disabled ? item.disabled(editor) : !isActive && !!r(item.title)?.includes('Depth')
  const ref = useRef<HTMLDivElement>(null)
  const tooltip = tooltipLabel({
    title: item.title,
    hotkey: () => (item.hotkey ? formatHotkey(item.hotkey) : undefined),
  })
  const menuLayer = useLayer("menu")

  const openMenu = useCallback(() => {
    const dest = ref.current
    const items = item.children
    const Component = item.Component
    if (!dest) return
    if (items) {
      menuLayer.open(() => (
        <Menu dest={dest} items={items} close={menuLayer.close} />
      ))
    } else if (Component) {
      menuLayer.open(() => <Component dest={dest} close={menuLayer.close} />)
    }
  }, [item])

  const onClick = useCallback(() => {
    if (isDisabled) return
    if (item.action) {
      item.action(staticEditor)
      if (item.focusEditor !== false) ReactEditor.focus(staticEditor)
      return
    }
    if (menuLayer.layer) {
      menuLayer.close()
    } else {
      openMenu()
    }
  }, [menuLayer.layer, item, isDisabled])

  /**
   * On hover
   */
  const onMouseEnter = useCallback(
    () => {
      /**
       * If any `menu` is already open, then we open up the currently hovered
       * `menu` automatically. This replicates behavior in menus in windowing
       * systems.
       */
      if (menuLayer.layer) openMenu()
    },
    [menuLayer.layer, openMenu]
  )

  return (
    <$ToolbarButton
      data-item-type="button"
      role="button"
      data-toolbar-title={item.title}
      aria-label={tooltip}
      data-tooltip-position="bottom"
      aria-pressed={item.active ? !!isActive : undefined}
      aria-disabled={isDisabled || undefined}
      ref={ref}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={clsx({
        "--active": isActive && !r(item?.title)?.includes('Depth'),
        "--more": item.more,
        "--disabled": isDisabled
      })}
    >
      <item.icon />
    </$ToolbarButton>
  )
}
