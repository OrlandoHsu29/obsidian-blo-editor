import { ui } from "../../utils/translations"
import { MouseEvent, useCallback } from "react"

import { serialize } from "../../convert"
import { $CodeBlockActionButton, $CodeBlockActions } from "../styles"
import { CodeBlockElement } from "../types"

type CodeBlockActionsProps = {
  element: CodeBlockElement
}

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  throw new Error("Clipboard API is unavailable")
}

export function CodeBlockActions({ element }: CodeBlockActionsProps) {

  const copyBlock = useCallback(
    async (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      try {
        await writeClipboardText(serialize([element]).trimEnd())
      } catch {
        // The block remains selected so the user can use the browser shortcut.
      }
    },
    [element]
  )


  return (
    <$CodeBlockActions contentEditable={false}>
      <$CodeBlockActionButton
        aria-label={ui("Copy code block")}
        type="button"
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onClick={(event) => void copyBlock(event)}
      >
        <svg width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </$CodeBlockActionButton>
    </$CodeBlockActions>
  )
}
