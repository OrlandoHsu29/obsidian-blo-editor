import { serializeMath } from '../math-plugin/serialize'
import { replaceClipboardFencedBlock } from './html-code-block'

const texScript = 'script[type="math/tex" i],script[type^="math/tex;" i]'
const texAnnotation = 'annotation[encoding="application/x-tex" i]'
const renderedMath = '.katex-display,.katex,.katex-mathml,.MathJax_Display,.MathJax,.MathJax_SVG_Display,.MathJax_SVG,mjx-container'
const displayMath = '.katex-display,.MathJax_Display,.MathJax_SVG_Display,mjx-container[display="true"],math[display="block"]'

export function prepareClipboardMath(body: HTMLElement, inlineToken: (markdown: string) => string, blockToken: (markdown: string) => string) {
  const inlinePlaceholders = new WeakSet<Text>()
  for (const formula of body.querySelectorAll(`${renderedMath},math,${texScript}`)) {
    if (!body.contains(formula) || formula.closest('pre,code')) continue
    const next = formula.nextElementSibling
    const script = formula.matches(texScript) ? formula :
      formula.querySelector(texScript) ?? (formula.matches(renderedMath) && next?.matches(texScript) ? next : null)
    const math = formula.matches('math') ? formula : formula.querySelector('math')
    const annotation = math?.querySelector(texAnnotation)
    const latex = annotation?.textContent?.trim() || script?.textContent?.trim()
    const visualSibling = formula.matches('.katex-mathml') && next?.matches('.katex-html') ? next : null
    const preview = formula.previousElementSibling
    const table = Boolean(formula.closest('td,th'))
    const display = !table && (formula.matches(displayMath) || math?.matches(displayMath) ||
      /;\s*mode\s*=\s*display\b/i.test(script?.getAttribute('type') ?? ''))

    if (latex) {
      if (display) replaceClipboardFencedBlock(formula, blockToken(serializeMath(latex, true).trimEnd()))
      else {
        const inline = serializeMath(latex, false, table)
        const token = body.ownerDocument.createTextNode(inlineToken(table ? inline.replace(/\|/g, '\\|') : inline))
        const previous = formula.previousSibling
        if (previous?.nodeType === 3 && inlinePlaceholders.has(previous as Text)) formula.before(' ')
        formula.replaceWith(token)
        inlinePlaceholders.add(token)
      }
    } else {
      if (script === formula) continue
      // Keep one representation and discard annotations containing alternate text.
      math?.querySelectorAll('annotation,annotation-xml').forEach(element => element.remove())
      const readable = math?.textContent?.trim() || formula.getAttribute('aria-label')?.trim() ||
        (visualSibling ?? formula).textContent?.trim()
      if (!readable) continue
      formula.replaceWith(body.ownerDocument.createTextNode(readable))
    }
    if (preview?.matches('.MathJax_Preview')) preview.remove()
    if (script !== formula) script?.remove()
    visualSibling?.remove()
  }
}
