import { ui } from "../../utils/translations"
import { useCallback, useRef } from "react"
import { Editor, Node, Transforms } from "slate"
import { ReactEditor, useFocused, useSelected, useSlateStatic, useReadOnly } from "slate-react"

import { ConstrainedRenderElementProps } from "../../sink"
import { useLayer } from "../../use-layer"
import { ChevronDownIcon } from "../icons/ChevronDownIcon"
import { $CodeBlock, $CodeBlockControls, $CodeBlockLanguage, $CodeBlockLines, $CodeBlockScroller } from "../styles"
import { CodeBlockElement } from "../types"
import { LanguageMenu } from './LanguageMenu'
import { CodeBlockActions } from "./CodeBlockActions"
import { useBlockSelection } from '../../../blocks/use-block-selection'

export function CodeBlock({
  element,
  attributes,
  children,
}: ConstrainedRenderElementProps<CodeBlockElement>) {
  const ref = useRef<HTMLButtonElement>(null)
  const editor = useSlateStatic()
  const selected = useSelected()
  const blockSelected = useBlockSelection(element)
  const focused = useFocused()
  const readOnly = useReadOnly()
  const dropdown = useLayer("code-block-dropdown")
  const onClick = useCallback(() => {
    if (readOnly) return
    if (dropdown.layer) { dropdown.close(); return }
    const dest = ref.current
    if (dest === null) return
    dropdown.open(() => (
      <LanguageMenu dest={dest} element={element} close={dropdown.close} />
    ))
  }, [element, readOnly, dropdown])

  const isMermaid = element.language.toLowerCase() === "mermaid"
  if (isMermaid && !(selected && focused) && editor.wysimark.renderMermaidPreview) {
    const code = element.children.map((line) => Node.string(line)).join("\n")
    return (
      <$CodeBlock
        data-wysimark-code-block
        data-block-selected={blockSelected && !readOnly || undefined}
        className={blockSelected && !readOnly ? "--selected" : ""}
        {...attributes}
        onMouseDown={(event) => {
          event.preventDefault()
          const path = ReactEditor.findPath(editor, element)
          Transforms.select(editor, Editor.start(editor, path))
          ReactEditor.focus(editor)
        }}
      >
        <div contentEditable={false} style={{ padding: "1em", overflowX: "auto" }}>
          {editor.wysimark.renderMermaidPreview(code)}
        </div>
        <div aria-hidden="true" style={{ display: "none" }}>{children}</div>
      </$CodeBlock>
    )
  }

  return (
    <$CodeBlock data-wysimark-code-block data-block-selected={blockSelected && !readOnly || undefined} className={blockSelected && !readOnly ? "--selected" : ""} {...attributes}>
      <$CodeBlockScroller data-wysimark-code-scroller>
        <$CodeBlockLines data-wysimark-code-lines>{children}</$CodeBlockLines>
        <$CodeBlockControls contentEditable={false} data-wysimark-code-controls>
          {selected && focused && !readOnly ? <CodeBlockActions element={element} /> : null}
          <$CodeBlockLanguage data-wysimark-code-language type="button" disabled={readOnly} aria-label={ui("代码语言")} onMouseDown={event => { event.preventDefault(); event.stopPropagation() }} onClick={onClick} ref={ref}>
            <span>{element.language || "text"}</span>
            <ChevronDownIcon />
          </$CodeBlockLanguage>
        </$CodeBlockControls>
      </$CodeBlockScroller>
    </$CodeBlock>
  )
}
