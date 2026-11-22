import { finishRenderMath } from "obsidian"
import { clsx } from "clsx"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { Editor, Text, Transforms } from "slate"
import { HistoryEditor } from "slate-history"
import { ReactEditor, useReadOnly, useSelected, useSlateStatic } from "slate-react"
import type { RenderElementProps } from "slate-react"
import { ui } from "../utils/translations"
import { editMath, useMathEditing } from "./editing"
import type { MathElement } from "./types"
import { loadFormulaRenderer, renderFormula } from "./render-formula"
import { inlineStyleProps } from "../../blocks/typography"

export function MathFormula({ element, attributes, children }: Omit<RenderElementProps, "element"> & { element: MathElement }) {
  const editor = useSlateStatic(), readOnly = useReadOnly(), selected = useSelected()
  const editingHeight = useMathEditing(editor, element)
  const editing = editingHeight !== undefined && !readOnly
  const sourceLabel = useId()
  const input = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const preview = useRef<HTMLSpanElement>(null), changed = useRef(false)
  const wrapper = useRef<HTMLElement | null>(null)
  const [failed, setFailed] = useState(false)
  const [source, setSource] = useState(element.latex)
  const display = element.type === "math-block"
  // Text marks live on the formula's own leaf; the editing input stays plain.
  const leaf = element.type === "math-inline" ? element.children.find(node => Text.isText(node)) : undefined
  const marks = editing ? undefined : leaf
  const markStyle = inlineStyleProps(marks?.inlineStyle)
  // The highlight band is drawn by CSS so it can match the surrounding text.
  const markBackground = marks?.highlight ? markStyle?.backgroundColor : undefined
  const styled = markStyle ? { ...markStyle } : undefined
  if (styled && markBackground) delete styled.backgroundColor
  const decorated = !!marks && !!(marks.underline || marks.strike || marks.highlight)
  const slateRef = (attributes as { ref?: React.Ref<HTMLElement> }).ref
  const setWrapper = (node: HTMLElement | null) => {
    wrapper.current = node
    if (typeof slateRef === "function") slateRef(node)
    else if (slateRef && typeof slateRef === "object") (slateRef as React.MutableRefObject<HTMLElement | null>).current = node
  }
  useLayoutEffect(() => { setSource(element.latex) }, [element.latex])
  useLayoutEffect(() => {
    if (!editing) return
    changed.current = false
    input.current?.focus({ preventScroll: true })
    input.current?.setSelectionRange(element.latex.length, element.latex.length)
  }, [editing])
  useEffect(() => {
    if (editing || !preview.current) return
    const target = preview.current
    let cancelled = false
    target.replaceChildren()
    setFailed(false)
    if (!element.latex.trim()) { target.textContent = "LaTeX"; return }
    void loadFormulaRenderer().then(async () => {
      if (cancelled) return
      target.replaceChildren(renderFormula(element.latex, display))
      await finishRenderMath()
    }).catch(() => {
      if (!cancelled) { target.textContent = element.latex; setFailed(true) }
    })
    return () => { cancelled = true; target.replaceChildren() }
  }, [element.latex, display, editing])

  /**
   * Underline, strikethrough and highlight have to line up with the surrounding
   * text, so measure the text baseline and text band once and hand them to CSS.
   */
  useLayoutEffect(() => {
    const node = wrapper.current
    if (!decorated || display || !node) return
    const measure = () => {
      if (!node.isConnected) return
      const box = node.getBoundingClientRect()
      if (!box.width || !box.height) return
      const document = node.ownerDocument
      // A zero-size inline block rests on the text baseline; a zero-width glyph
      // in the inherited font spans exactly the text highlight band.
      const baseline = document.createElement("span")
      baseline.style.cssText = "display:inline-block;width:0;height:0;line-height:0;vertical-align:baseline;pointer-events:none"
      const band = document.createElement("span")
      band.style.cssText = "line-height:0;visibility:hidden;pointer-events:none"
      band.textContent = "\u200b"
      for (const probe of [baseline, band]) probe.setAttribute("aria-hidden", "true")
      node.append(baseline, band)
      const baselineY = baseline.getBoundingClientRect().bottom
      const bandBox = band.getBoundingClientRect()
      baseline.remove()
      band.remove()
      if (!bandBox.height) return
      const px = (value: number) => `${Math.round(value * 10) / 10}px`
      node.style.setProperty("--blo-math-baseline", px(baselineY - box.top))
      node.style.setProperty("--blo-math-text-top", px(bandBox.top - box.top))
      node.style.setProperty("--blo-math-text-bottom", px(box.bottom - bandBox.bottom))
    }
    measure()
    const frame = requestAnimationFrame(measure)
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    const window = node.ownerDocument.defaultView
    window?.addEventListener("resize", measure)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window?.removeEventListener("resize", measure)
    }
  }, [decorated, display, element.latex])

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
    'aria-labelledby': sourceLabel,
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
  return <Wrapper {...attributes} ref={setWrapper} style={{ ...styled, ...(markBackground ? { "--blo-math-highlight": markBackground } : undefined) } as React.CSSProperties} data-blo-math={display ? "block" : "inline"}
    className={clsx("blo-math", {
      "is-selected": selected && !readOnly,
      "is-editing": editing,
      "is-invalid": failed,
      "--bold": marks?.bold,
      "--italic": marks?.italic,
      "--underline": marks?.underline,
      "--strike": marks?.strike,
      "--highlight": marks?.highlight,
    })}>
    <span className="blo-math-surface" contentEditable={false} onDoubleClick={event => {
      if (readOnly || editing) return
      event.preventDefault(); event.stopPropagation(); editMath(editor, element)
    }} onMouseDown={event => {
      if (readOnly || editing) return
      event.preventDefault(); event.stopPropagation()
      Transforms.select(editor, ReactEditor.findPath(editor, element)); ReactEditor.focus(editor)
    }}>
      {editing && <span id={sourceLabel} hidden>{ui('LaTeX 公式源码')}</span>}
      {editing ? display
        ? <textarea {...sourceProps} ref={node => { input.current = node }} rows={3} style={{ minHeight: editingHeight || undefined }} />
        : <input {...sourceProps} ref={node => { input.current = node }} type="text" style={{ width: `${Math.min(48, Math.max(8, element.latex.length + 2))}ch` }} />
        : <span ref={preview} className="blo-math-preview" />}
    </span>
    {children}
  </Wrapper>
}
