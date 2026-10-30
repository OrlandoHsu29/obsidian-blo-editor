import { clsx } from "clsx"
import { useCallback, useRef } from "react"
import type { FunctionComponent, RefObject } from 'react'
import { ReactEditor, useSlate, useSlateStatic } from "slate-react"

import { formatHotkey, Menu, MenuItemData } from "../../../shared-overlays"
import { useLayer } from "../../../use-layer"
import { tooltipLabel } from "../../../use-tooltip"
import { r } from "../../../utils/translations"

import { $ToolbarButton } from "../../styles"

export function ToolbarButton({
  item,
  inOverflow = false,
  menuAnchor,
  menuAnchorRef,
  submenuRef,
  closeOverflow,
  menuToggle = false,
}: {
  item: Exclude<MenuItemData, "divider">
  inOverflow?: boolean
  menuAnchor?: HTMLElement
  menuAnchorRef?: RefObject<HTMLElement | null>
  submenuRef?: RefObject<HTMLDivElement | null>
  closeOverflow?: () => void
  menuToggle?: boolean
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
  const menuLayer = useLayer(inOverflow ? 'toolbar-submenu' : 'menu')
  const openedComponent = useRef<FunctionComponent<Record<string, never>> | null>(null)
  const menuOpen = menuToggle && !!menuLayer.layer && menuLayer.layer.Component === openedComponent.current

  const openMenu = useCallback(() => {
    const dest = menuAnchorRef?.current ?? menuAnchor ?? ref.current
    const items = item.children
    const Component = item.Component
    if (!dest) return
    if (!items && !Component) return
    const render = () => <div ref={submenuRef} data-toolbar-submenu={inOverflow||undefined}>
      {items ? <Menu dest={dest} items={items} close={menuLayer.close} /> : Component ? <Component dest={dest} close={menuLayer.close} /> : null}
    </div>
    openedComponent.current = render
    menuLayer.open(render)
  }, [item, menuAnchor, menuAnchorRef, submenuRef])

  const onClick = useCallback(() => {
    if (isDisabled) return
    if (item.action) {
      item.action(staticEditor)
      if (item.focusEditor !== false) ReactEditor.focus(staticEditor)
      if (inOverflow) { menuLayer.close(); closeOverflow?.() }
      return
    }
    if (menuToggle) {
      if (menuOpen) menuLayer.close()
      else openMenu()
    } else if (menuLayer.layer && !inOverflow && !menuAnchor) {
      menuLayer.close()
    } else {
      openMenu()
    }
  }, [menuLayer.layer, item, isDisabled, inOverflow, menuAnchor, closeOverflow, menuToggle, menuOpen, openMenu])

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
      if (menuLayer.layer && !inOverflow && !menuToggle) openMenu()
    },
    [menuLayer.layer, openMenu, inOverflow, menuToggle]
  )

  return (
    <$ToolbarButton
      data-item-type="button"
      role={inOverflow ? 'menuitem' : 'button'}
      data-toolbar-title={item.title}
      aria-label={tooltip}
      data-tooltip-position="bottom"
      aria-pressed={menuToggle ? menuOpen : item.active ? !!isActive : undefined}
      aria-expanded={menuToggle ? menuOpen : undefined}
      aria-haspopup={menuToggle ? 'menu' : undefined}
      aria-disabled={isDisabled || undefined}
      ref={ref}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      tabIndex={menuToggle ? 0 : undefined}
      onKeyDown={menuToggle ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() } } : undefined}
      className={clsx({
        "--active": isActive && !r(item?.title)?.includes('Depth'),
        "--menu-open": menuOpen,
        "--more": item.more,
        "--disabled": isDisabled,
        "blo-toolbar-overflow-item": inOverflow
      })}
    >
      <item.icon />
    </$ToolbarButton>
  )
}
