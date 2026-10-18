import { Editor, Element, Node, Range, Text } from 'slate'
import type { Descendant } from 'slate'
import { blockDepth, isEditorSpacer, isListBlock, resolveOrderedNumbers, rootCache } from '../../blocks/model'
import { cleanInlineStyle } from '../../blocks/typography'

/** Build semantic HTML from just the copied fragment, without editor controls/CSS. */
export function clipboardFragmentHtml(fragment: Descendant[], encoded: string, labels = new Map<Node, string>()): string {
  const document = window.document.implementation.createHTMLDocument('')
  const container = document.createElement('div')
  container.setAttribute('data-slate-fragment', encoded)
  const wrap = (tag: string, child: globalThis.Node) => {
    const element = document.createElement(tag); element.append(child); return element
  }
  const render = (node: Descendant): globalThis.Node => {
    if (Text.isText(node)) {
      let result: globalThis.Node = document.createTextNode(node.text)
      if (node.text.includes('\n')) {
        const lines = document.createDocumentFragment()
        node.text.split('\n').forEach((line, index) => { if (index) lines.append(document.createElement('br')); lines.append(document.createTextNode(line)) })
        result = lines
      }
      const marks = { code: 'code', bold: 'strong', italic: 'em', underline: 'u', strike: 's', highlight: 'mark', kbd: 'kbd', sup: 'sup', sub: 'sub' } as const
      for (const [mark, tag] of Object.entries(marks)) if (node[mark as keyof typeof marks]) result = wrap(tag, result)
      if (node.footnote) result = wrap('sup', result)
      const style = cleanInlineStyle(node.inlineStyle)
      if (style) { const span = wrap('span', result); span.setAttribute('style', style); result = span }
      return result
    }
    if (node.type === 'code-block') {
      const code = document.createElement('code')
      code.textContent = node.children.map(line => Node.string(line)).join('\n')
      if (node.language) code.className = `language-${node.language}`
      return wrap('pre', code)
    }
    if (node.type === 'html-block' || node.type === 'link-definition') {
      const source = document.createElement('pre')
      source.textContent = node.type === 'html-block' ? node.html : node.markdown
      return source
    }
    if (node.type === 'table') {
      const table = document.createElement('table')
      table.style.borderCollapse = 'collapse'
      const body = document.createElement('tbody'); table.append(body)
      node.children.forEach((row, y) => {
        const tr = document.createElement('tr'); body.append(tr)
        row.children.forEach((cell, x) => {
          const header = (node.headerRow !== false && y === 0) || (node.headerColumn && x === 0)
          const td = document.createElement(header ? 'th' : 'td')
          td.style.border = '1px solid #aaa'; td.style.padding = '6px 10px'
          td.style.textAlign = node.columns[x]?.align || 'left'
          flow(cell.children, td); tr.append(td)
        })
      })
      return table
    }
    if (node.type === 'image-inline' || node.type === 'image-block') {
      const image = document.createElement('img'); image.setAttribute('src', node.url)
      if (node.alt) image.alt = node.alt
      return image
    }
    const tag = node.type === 'heading' ? `h${node.level}` : node.type === 'paragraph' ? 'p' :
      node.type === 'block-quote' ? 'blockquote' : node.type === 'anchor' ? 'a' : node.type === 'horizontal-rule' ? 'hr' : 'div'
    const element = document.createElement(tag)
    if (node.type === 'anchor') { element.setAttribute('href', node.href); if (node.title) element.title = node.title }
    if (node.type === 'table-content') element.style.whiteSpace = 'pre-wrap'
    if (blockDepth(node) && node.type !== 'table-content') element.style.marginLeft = `${blockDepth(node) * 2}em`
    flow(node.children, element)
    if (node.type === 'paragraph' && !element.textContent && !element.querySelector('img')) element.append(document.createElement('br'))
    return element
  }
  const flow = (nodes: Descendant[], host: HTMLElement) => {
    const resolved = resolveOrderedNumbers(nodes)
    const stack: { depth: number; tag: string; list: HTMLElement; last: HTMLLIElement }[] = []
    for (const node of nodes) {
      if (isEditorSpacer(node)) continue
      if (!Element.isElement(node) || !isListBlock(node)) { stack.length = 0; host.append(render(node)); continue }
      const depth = blockDepth(node), tag = node.type === 'ordered-list-item' ? 'ol' : 'ul'
      while (stack.length && (stack[stack.length - 1].depth > depth || (stack[stack.length - 1].depth === depth && stack[stack.length - 1].tag !== tag))) stack.pop()
      let group = stack[stack.length - 1]
      const item = document.createElement('li')
      let headingLabel: string | undefined
      if (!group || group.depth < depth) {
        const list = document.createElement(tag)
        const parent = group?.last || host
        parent.append(list)
        group = { depth, tag, list, last: item }; stack.push(group)
      }
      group.list.append(item); group.last = item
      if (node.type === 'ordered-list-item') {
        const label = labels.get(node) || resolved.numberLabels.get(node) || '1.'
        const number = resolved.numbers.get(node) || 1
        item.value = /^\d+\.$/.test(label) ? Number(label.slice(0, -1)) : number
        if (group.list.children.length === 1) group.list.setAttribute('start', String(item.value))
        if (!/^\d+\.$/.test(label)) { item.style.listStyleType = 'none'; headingLabel = label }
      }
      if (node.type === 'task-list-item') {
        item.style.listStyleType = 'none'
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.disabled = true
        if (node.checked) checkbox.setAttribute('checked', '')
        item.append(checkbox, document.createTextNode(' '))
      }
      flow(node.children, item)
      if (headingLabel) {
        const target = item.firstElementChild?.matches('h1,h2,h3,h4,h5,h6') ? item.firstElementChild : item
        target.prepend(document.createTextNode(headingLabel + ' '))
      }
    }
  }
  flow(fragment, container)
  return container.outerHTML
}

export function installRichClipboard(editor: Editor): void {
  const { setFragmentData } = editor
  editor.setFragmentData = (data, origin) => {
    const result = setFragmentData(data, origin)
    const encoded = data.getData('application/x-slate-fragment')
    if (!encoded || !editor.selection) return result
    const fragment = JSON.parse(decodeURIComponent(window.atob(encoded))) as Descendant[]
    const [start] = Range.edges(editor.selection), cache = rootCache(editor), labels = new Map<Node, string>()
    fragment.forEach((node, index) => {
      const label = cache.numberLabels.get(editor.children[start.path[0] + index])
      if (label) labels.set(node, label)
    })
    data.setData('text/html', clipboardFragmentHtml(fragment, encoded, labels))
    return result
  }
}
