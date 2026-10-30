import { finishRenderMath, loadMathJax, renderMath } from "obsidian"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Editor, Transforms } from "slate"
import { HistoryEditor } from "slate-history"
import { ReactEditor, useReadOnly, useSelected, useSlateStatic } from "slate-react"
import type { RenderElementProps } from "slate-react"
import { ui } from "../utils/translations"
import { editMath, useMathEditing } from "./editing"
import type { MathElement } from "./types"

let mathReady: Promise<void> | undefined
function ready() {
  return mathReady ??= loadMathJax().catch(error => { mathReady = undefined; throw error })
}

export function MathFormula({ element, attributes, children }: Omit<RenderElementProps, "element"> & { element: MathElement }) {
  const editor = useSlateStatic(), readOnly = useReadOnly(), selected = useSelected()
  const editing = useMathEditing(editor, element) && !readOnly
  const input = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const preview = useRef<HTMLSpanElement>(null), changed = useRef(false)
  const [failed, setFailed] = useState(false)
  const [source, setSource] = useState(element.latex)
  const display = element.type === "math-block"
  useLayoutEffect(() => { setSource(element.latex) }, [element.latex])
  useLayoutEffect(() => {
    if (!editing) return
    changed.current = false
    input.current?.focus()
    input.current?.setSelectionRange(element.latex.length, element.latex.length)
  }, [editing])
  useEffect(() => {
    if (editing || !preview.current) return
    const target = preview.current
    let cancelled = false
    target.replaceChildren()
    setFailed(false)
    if (!element.latex.trim()) { target.textContent = "LaTeX"; return }
    void ready().then(async () => {
      if (cancelled) return
      const rendered = renderMath(element.latex, display)
      if (rendered.matches('mjx-merror,[data-mjx-error]') || rendered.querySelector('mjx-merror,[data-mjx-error]')) throw new Error("Invalid formula")
      target.replaceChildren(rendered)
      await finishRenderMath()
    }).catch(() => {
      if (!cancelled) { target.textContent = element.latex; setFailed(true) }
    })
    return () => { cancelled = true; target.replaceChildren() }
  }, [element.latex, display, editing])

  const finish = (moveCaret = false) => {
    const path = ReactEditor.findPath(editor, element)
    editMath(editor)
    if (!element.latex.trim()) Transforms.removeNodes(editor, { at: path })
    else if (moveCaret) {
      const after = Editor.after(editor, path)
      if (after) Transforms.select(editor, after)
    }
    if (moveCaret) ReactEditor.focus(editor)
  }
  const sourceProps = {
    value: source,
    'aria-label': ui('LaTeX 公式源码'),
    spellCheck: false,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const latex = event.target.value
      setSource(latex)
      const run = () => Transforms.setNodes(editor, { latex }, { at: ReactEditor.findPath(editor, element) })
      if (changed.current) HistoryEditor.withMerging(editor, run)
      else HistoryEditor.withNewBatch(editor, run)
      changed.current = true
    },
    onBlur: () => finish(),
    onBeforeInput: (event: React.FormEvent) => event.stopPropagation(),
    onInput: (event: React.FormEvent) => event.stopPropagation(),
    onPaste: (event: React.ClipboardEvent) => event.stopPropagation(),
    onMouseDown: (event: React.MouseEvent) => event.stopPropagation(),
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      event.stopPropagation()
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
      if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault()
        if (event.key.toLowerCase() === 'y' || event.shiftKey) editor.redo(); else editor.undo()
      } else if ((event.key === 'Backspace' && !event.currentTarget.value.trim()) || event.key === 'Escape' || event.key === 'Tab' || event.key === 'Enter' && (!display || !event.shiftKey)) {
        event.preventDefault(); finish(true)
      }
    },
  }
  const Wrapper = display ? "div" : "span"
  return <Wrapper {...attributes} data-blo-math={display ? "block" : "inline"} className={`blo-math${selected && !readOnly ? ' is-selected' : ''}${editing ? ' is-editing' : ''}${failed ? ' is-invalid' : ''}`}>
    <span contentEditable={false} onDoubleClick={event => {
      if (readOnly) return
      event.preventDefault(); event.stopPropagation(); editMath(editor, element)
    }} onMouseDown={event => {
      if (readOnly || editing) return
      event.preventDefault(); event.stopPropagation()
      Transforms.select(editor, ReactEditor.findPath(editor, element)); ReactEditor.focus(editor)
    }}>
      {editing ? display
        ? <textarea {...sourceProps} ref={node => { input.current = node }} rows={3} />
        : <input {...sourceProps} ref={node => { input.current = node }} type="text" style={{ width: `${Math.min(48, Math.max(8, element.latex.length + 2))}ch` }} />
        : <span ref={preview} className="blo-math-preview" aria-label={display && !readOnly ? ui('双击编辑公式') : undefined} />}
    </span>
    {children}
  </Wrapper>
}
