import { ui } from "../../utils/translations"
import styled from "@emotion/styled"
import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { useSlateStatic } from "slate-react"

import { $Panel } from "../../shared-overlays"
import {
  isWikiLinkHref,
  wikiLinkSpecFromHref,
  wikiLinkTarget,
} from "../../convert/obsidian-links"
import { useLayer } from "../../use-layer"
import { positionInside, useAbsoluteReposition } from "../../use-reposition"
import { tooltipLabel } from "../../use-tooltip"
import { AnchorElement } from "../index"
import { AnchorEditDialog } from "./AnchorEditDialog"
import { CloseIcon, ExternalLinkIcon, LinkOffIcon, PencilIcon } from "./icons"
import { DraggableHeader } from "../../toolbar-plugin/components/dialog/DraggableHeader"

const $AnchorDialog = styled($Panel)`
  position: absolute;
  width: 20em;
  z-index: 1000;
  padding: 0;
  overflow: hidden;
  color: var(--shade-400);

  .--icons {
    display: flex;
    gap: 0.75em;
    overflow: visible;
    flex: 0 0 auto;
  }

  .--internal-icons {
    margin-bottom: 0.75em;
  }

  .--link {
    text-decoration: none;
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    color: var(--shade-400);
    &:hover {
      color: var(--blue-600);
    }
    transition: all 200ms;
  }

  .--internal-link {
    cursor: pointer;
  }

  .--internal-content {
    flex: 1 1 auto;
    min-width: 0;
  }

  .--internal-title {
    margin-bottom: 0.5em;
    max-width: 100%;
    color: var(--blue-600);
    font-size: 0.875em;
    font-weight: 600;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .--internal-preview {
    box-sizing: border-box;
    width: 100%;
    max-height: 14em;
    overflow: auto;
    border: 1px solid var(--shade-200);
    border-radius: 0.375em;
    padding: 0.625em 0.75em;
    color: var(--shade-600);
    background: var(--shade-100);
    font-size: 0.8125em;
    line-height: 1.45;
    overflow-wrap: break-word;
  }

  .--internal-preview,
  .--internal-preview * {
    box-sizing: border-box;
    max-width: 100%;
    overflow-wrap: anywhere;
    word-break: break-word;
    white-space: normal;
  }

  .--internal-preview:empty {
    display: none;
  }

  .--internal-preview .markdown-preview-view {
    padding: 0;
  }

  .--internal-preview a {
    display: inline;
    overflow-wrap: anywhere;
    word-break: break-all;
  }

  .--internal-preview p:first-child {
    margin-top: 0;
  }

  .--internal-preview p:last-child {
    margin-bottom: 0;
  }

  .--url {
    margin-left: 0.5em;
    .--hostname {
      font-size: 0.875em;
      max-width: 14em;
      line-height: 1.5em;
      color: var(--blue-600);
      overflow-wrap: break-word;
      /* width: 13.5em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis; */
    }
    .--pathname {
      margin-top: 0.125em;
      font-size: 0.75em;
      max-width: 16.25em;
      line-height: 1.5em;
      overflow-wrap: break-word;
    }
    .--tooltip {
      box-sizing: border-box;
      position: relative;
      margin-top: 1em;
      font-size: 0.875em;
      max-width: 14em;
      line-height: 1.5em;
      background: var(--shade-200);
      border-radius: 0.5em;
      padding: 0.5em 0.75em;
      color: var(--shade-600);
      overflow-wrap: break-word;
    }
    .--tooltip::before {
      content: "";
      position: absolute;
      top: -0.5em; /* Height of the triangle */
      left: 0.5em; /* Position it on the left side */
      border-left: 0.5em solid transparent; /* Half the width of the triangle */
      border-right: 0.5em solid transparent; /* Half the width of the triangle */
      border-bottom: 0.5em solid var(--shade-200); /* Height and color of the triangle */
    }
  }

  .--icon {
    cursor: pointer;
    &:hover {
      color: var(--blue-600);
    }
  }

  svg {
    flex: 0 0 auto;
    width: 1.25em;
    height: 1.25em;
    stroke-width: 1.5;
  }
`

function parseUrl(s: string): { hostname: string; pathname: string } {
  try {
    const url = new URL(s)
    return { hostname: url.hostname, pathname: url.pathname }
  } catch {
    return { hostname: "", pathname: "" }
  }
}

function internalLinkPath(target: string): string {
  return target.trim() || target
}

export function AnchorDialog({
  destAnchor,
  destStartEdge,
  element,
  embed,
}: {
  destAnchor: HTMLElement
  destStartEdge: HTMLElement
  element?: AnchorElement
  embed?: {
    target: string
    file?: { name: string; path: string }
    onEdit: () => void
    onRemove: () => void
  }
}) {
  const dialog = useLayer("dialog")
  const editor = useSlateStatic()
  const ref = useRef<HTMLDivElement>(null)
  const isEmbed = !!embed
  const href = element?.href ?? ""
  const url = parseUrl(href)
  const isInternalLink = isEmbed || isWikiLinkHref(href)
  const internalTarget = isEmbed
    ? embed.target
    : isWikiLinkHref(href)
      ? wikiLinkTarget(wikiLinkSpecFromHref(href))
      : ""
  const internalTitle = isInternalLink ? internalLinkPath(internalTarget) : ""
  const internalPreview = isInternalLink && !isEmbed
    ? editor.wysimark.renderInternalLinkPreview?.(internalTarget)
    : null
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [, refreshGeometry] = useState(0)
  useLayoutEffect(() => {
    const doc = destAnchor.ownerDocument
    const win = doc.defaultView!
    let frame = 0
    const refresh = () => {
      if (!frame) frame = win.requestAnimationFrame(() => {
        frame = 0
        refreshGeometry(value => value + 1)
      })
    }
    const observer = new win.ResizeObserver(refresh)
    // Media resize state lives below the portal's owner, so the information
    // card must measure its anchor even when its own React props do not change.
    for (const element of new Set([destAnchor, destStartEdge, ref.current])) {
      if (element) observer.observe(element)
    }
    // Scroll events from nested editor panes do not reach the window listener
    // used by useAbsoluteReposition. Capture them on the owner document too.
    doc.addEventListener('scroll', refresh, true)
    return () => { doc.removeEventListener('scroll', refresh, true); observer.disconnect(); if (frame) win.cancelAnimationFrame(frame) }
  }, [destAnchor, destStartEdge])

  const handleDrag = useCallback((deltaX: number, deltaY: number) => {
    setDragOffset(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }))
  }, [])

  const baseStyle = useAbsoluteReposition(
    { src: ref, destAnchor, destStartEdge },
    ({ src, destAnchor, destStartEdge }, viewport) => {
      return positionInside(
        src,
        viewport,
        {
          left: destStartEdge.left,
          top: destAnchor.top + destAnchor.height,
        },
        { margin: 16 }
      )
    }
  )

  const style = {
    ...baseStyle,
    left: baseStyle.left + dragOffset.x,
    top: baseStyle.top + dragOffset.y,
  }

  const removeTooltip = tooltipLabel({ title: ui("删除链接") })
  const openTooltip = tooltipLabel({ title: ui("打开链接") })
  const editTooltip = tooltipLabel({ title: ui("编辑链接") })
  const closeTooltip = tooltipLabel({ title: ui("关闭") })

  const closeDialog = useCallback(() => {
    dialog.close()
  }, [dialog])

  const openInternalLink = useCallback(() => {
    if (!isInternalLink) return
    void editor.wysimark.openInternalLink?.(internalTarget)
    dialog.close()
  }, [dialog, editor, internalTarget, isInternalLink])

  const removeLink = useCallback(() => {
    if (embed) {
      embed.onRemove()
      dialog.close()
      return
    }
    if (element) editor.anchor.removeLink({ at: element })
    // Close the dialog after removing the link
    dialog.close()
  }, [editor, dialog, embed, element])

  const openEditDialog = useCallback(() => {
    if (embed) {
      embed.onEdit()
      return
    }
    if (!element) return
    dialog.open(() => {
      return (
        <AnchorEditDialog
          destAnchor={destAnchor}
          destStartEdge={destStartEdge}
          element={element}
        />
      )
    })
  }, [destAnchor, destStartEdge, element, embed, dialog])

  const iconButtons = (
    <span className={`--icons${isInternalLink && !embed?.file ? " --internal-icons" : ""}`}>
      {isInternalLink && !embed?.file ? (
        <span
          className="--icon --internal-link"
          onClick={openInternalLink}
          aria-label={openTooltip}
          data-tooltip-position="top"
        >
          <ExternalLinkIcon />
        </span>
      ) : null}
      <span
        className="--icon"
        onClick={removeLink}
        aria-label={removeTooltip}
          data-tooltip-position="top"
      >
        <LinkOffIcon />
      </span>
      <span
        className="--icon"
        aria-label={editTooltip}
          data-tooltip-position="top"
        onClick={openEditDialog}
      >
        <PencilIcon />
      </span>
      <span
        className="--icon"
        onClick={closeDialog}
        aria-label={closeTooltip}
          data-tooltip-position="top"
      >
        <CloseIcon />
      </span>
    </span>
  )

  return (
    <$AnchorDialog ref={ref} contentEditable={false} style={style} data-blo-reference-popover={embed?.file ? true : undefined}>
      <DraggableHeader onDrag={handleDrag} />
      <div style={{ padding: "1em" }}>
        {embed?.file ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75em' }}>
            <span className="--link --internal-link" onClick={openInternalLink} aria-label={openTooltip}>
              <ExternalLinkIcon />
              <span className="--url" style={{ minWidth: 0 }}>
                <span className="--hostname" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{embed.file.name}</span>
                <span className="--pathname" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{embed.file.path}</span>
              </span>
            </span>
            {iconButtons}
          </div>
        ) : isInternalLink ? (
          <div className="--internal-content">
            <div className="--internal-title" title={internalTarget}>
              {internalTitle}
            </div>
            {iconButtons}
            {!isEmbed ? (
              <div className="--internal-preview">
                {internalPreview ?? internalTarget}
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ display: "flex", gap: "0.75em" }}>
            <a
              className="--link"
              href={href}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLinkIcon />
              <div className="--url">
                <div className="--hostname">{url.hostname}</div>
                {url.pathname === "" || url.pathname === "/" ? null : (
                  <div className="--pathname">{url.pathname}</div>
                )}
                {element?.title == null || element.title === "" ? null : (
                  <div className="--tooltip">{element.title}</div>
                )}
              </div>
            </a>
            {iconButtons}
          </div>
        )}
      </div>
    </$AnchorDialog>
  )
}
