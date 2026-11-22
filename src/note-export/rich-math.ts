import { Node } from 'slate'
import type { Descendant } from 'slate'
import { loadFormulaRenderer } from '../wysimark/math-plugin/render-formula'

type FormulaImage = { src: string; width: number; height: number }
const mathNamespace = 'http://www.w3.org/1998/Math/MathML'
const formulaStyle = 'padding:3px 5px;font:16px serif;color:#222;line-height:normal'
const key = (latex: string, display: boolean) => (display ? 'block:' : 'inline:') + latex

function portableMathMarkup(doc: Document, source: string): Element | undefined {
  const parsed = new doc.defaultView!.DOMParser().parseFromString(source, 'application/xml')
  const math = parsed.documentElement
  if (math.localName !== 'math' || math.namespaceURI !== mathNamespace || math.querySelector('merror')) return
  for (const child of [...math.querySelectorAll('*')]) {
    if (child.namespaceURI !== mathNamespace || child.localName === 'annotation-xml') child.remove()
  }
  for (const element of [math, ...math.querySelectorAll('*')]) {
    for (const attribute of [...element.attributes]) {
      if (/^(?:on|href$|src$|style$)/i.test(attribute.localName)) element.removeAttributeNode(attribute)
    }
  }
  return doc.importNode(math, true)
}

async function formulaImage(host: HTMLElement, math: Element): Promise<FormulaImage | undefined> {
  const doc = host.ownerDocument
  host.replaceChildren(math)
  const bounds = host.getBoundingClientRect()
  if (!bounds.width || !bounds.height) return
  const width = Math.ceil(bounds.width), height = Math.ceil(bounds.height)
  const scale = Math.min(2, 4096 / width, 4096 / height)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width * scale)}" height="${Math.ceil(height * scale)}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="${formulaStyle}">${new doc.defaultView!.XMLSerializer().serializeToString(math)}</div></foreignObject></svg>`
  const image = doc.createElement('img')
  image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  await image.decode()
  const canvas = doc.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) return
  context.drawImage(image, 0, 0)
  return { src: canvas.toDataURL('image/png'), width, height }
}

/** Cloud editors commonly accept images but strip browser-specific math markup. */
export async function prepareRichMath(doc: Document, fragment: Descendant[]) {
  const formulas = new Map<string, { latex: string; display: boolean }>()
  for (const root of fragment) {
    for (const [node] of Node.elements(root)) {
      if ((node.type === 'math-inline' || node.type === 'math-block') && node.latex.trim()) {
        const display = node.type === 'math-block'
        formulas.set(key(node.latex, display), { latex: node.latex, display })
      }
    }
  }
  const images = new Map<string, FormulaImage>()
  const lookup = (latex: string, display: boolean) => images.get(key(latex, display))
  if (!formulas.size) return lookup
  try { await loadFormulaRenderer() } catch { return lookup }
  const mathJax = (doc.defaultView as Window & {
    MathJax?: { tex2mmlPromise?: (latex: string, options: { display: boolean }) => Promise<string> }
  } | null)?.MathJax
  if (!mathJax?.tex2mmlPromise) return lookup

  const host = doc.createElement('div')
  host.style.cssText = 'position:fixed;left:-100000px;top:0;width:max-content;' + formulaStyle
  doc.body.append(host)
  try {
    for (const [id, { latex, display }] of formulas) {
      try {
        const math = portableMathMarkup(doc, await mathJax.tex2mmlPromise(latex, { display }))
        const image = math && await formulaImage(host, math)
        if (image) images.set(id, image)
      } catch { /* Failed formulas retain their portable TeX source. */ }
    }
  } finally { host.remove() }
  return lookup
}
