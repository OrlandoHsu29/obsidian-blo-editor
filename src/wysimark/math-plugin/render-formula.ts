import { loadMathJax, renderMath } from 'obsidian'

let mathReady: Promise<void> | undefined

export function loadFormulaRenderer(): Promise<void> {
  return mathReady ??= loadMathJax().catch(error => { mathReady = undefined; throw error })
}

export function renderFormula(source: string, display: boolean): HTMLElement {
  const rendered = renderMath(source, display)
  const error = 'mjx-merror,[data-mjx-error]'
  if (rendered.matches(error) || rendered.querySelector(error)) throw new Error('Invalid formula')
  return rendered
}
