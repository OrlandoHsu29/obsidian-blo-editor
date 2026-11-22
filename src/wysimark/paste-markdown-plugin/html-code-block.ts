import { serializeCodeBlock } from '../convert/serialize/serialize-code-block'

const codeWrapper = 'code-block,.code-block,.code-block-wrapper,[data-code-block],[data-testid="code-block"]'
const toolbar = '.code-toolbar,.code-block-header,[data-testid="code-block-header"],[data-testid="code-block-toolbar"]'
const controls = `button,[role="button"],[role="toolbar"],svg,script,style,[aria-hidden="true"],${toolbar}`

function languageOf(element: Element): string | undefined {
  const values = [element.getAttribute('data-language'), element.getAttribute('data-lang'),
    ...Array.from(element.classList, name => name.match(/^(?:language|lang)-(.+)$/i)?.[1])]
  return values.find((value): value is string => !!value && /^[\w.+#-]+$/u.test(value))
}

function isCodeToolbar(element: Element): boolean {
  return element.matches(toolbar) || Array.from(element.querySelectorAll('button,[role="button"]')).some(button =>
    [button.getAttribute('aria-label'), button.getAttribute('title'), button.textContent?.trim()]
      .some(value => !!value && /^(?:copy(?: code)?|download(?: code)?|复制(?:代码)?|下载(?:代码)?)$/iu.test(value)))
}

function codeText(element: Element): string {
  const parts: string[] = []
  let endedLine = false
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? ''
      if (endedLine && !text.startsWith('\n')) parts.push('\n')
      parts.push(text)
      endedLine = false
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const node = child as Element
      if (node.matches(controls)) continue
      const line = node.matches('div,p,li,.line,.code-line,[data-line]')
      const text = node.localName === 'br' ? '\n' :
        line && node.childNodes.length === 1 && node.firstElementChild?.localName === 'br' ? '' : codeText(node)
      if ((endedLine || line && parts.length && !parts.at(-1)?.endsWith('\n')) && !text.startsWith('\n')) parts.push('\n')
      parts.push(text)
      endedLine = line && !text.endsWith('\n')
    }
  }
  return parts.join('')
}

function codeSource(element: HTMLElement): Element | undefined {
  if (element.matches(`pre,${codeWrapper}`)) {
    const nestedPre = element.querySelectorAll('pre')
    if (nestedPre.length > 1) return
    const pre = nestedPre[0]
    return pre?.querySelector('code') ?? pre ?? element.querySelector('code') ?? element
  }
  if (element.localName === 'code') return element.style.display === 'block' ? element : undefined
  if (element.closest(`pre,code,${codeWrapper}`)) return
  const preformatted = /^(pre|pre-wrap|break-spaces)$/.test(element.style.whiteSpace)
  if (!preformatted || element.querySelector('pre,blockquote,table,ul,ol')) return
  if (element.children.length === 1 && element.firstElementChild?.localName === 'code') return element.firstElementChild
  if (/mono|courier|consolas|menlo/i.test(element.style.fontFamily)) return element
}

/** Let Obsidian mark a fence's Markdown context, then restore its literal contents. */
export function prepareClipboardCodeBlocks(body: HTMLElement, marker: string): string[] {
  const blocks: string[] = []
  for (const element of body.querySelectorAll<HTMLElement>(`pre,${codeWrapper},div[style],code[style]`)) {
    if (!body.contains(element) || element.closest('td,th') || element.matches(controls)) continue
    const source = codeSource(element)
    if (!source) continue
    const pre = source.closest('pre')
    const language = languageOf(source) ?? (pre && languageOf(pre)) ?? languageOf(element) ?? 'text'
    const header = element.previousElementSibling
    // Some copied web fragments keep a separate language row and action toolbar.
    if (header && isCodeToolbar(header)) {
      const label = header.previousElementSibling
      const labelText = label?.textContent?.trim()
      if (label?.matches('div,span') && labelText?.toLowerCase() === language.toLowerCase()) label.remove()
      header.remove()
    }
    const text = codeText(source).replace(/\r\n?/g, '\n').replace(/\n$/, '')
    const block = serializeCodeBlock({ type: 'code-block', language, children: text.split('\n').map(text => ({
      type: 'code-block-line', children: [{ text }],
    })) }).trimEnd()
    replaceClipboardFencedBlock(element, `${marker}${blocks.push(block) - 1}\uE001`)
  }
  return blocks
}

export function replaceClipboardFencedBlock(element: Element, token: string) {
  const pre = element.ownerDocument.createElement('pre')
  const code = element.ownerDocument.createElement('code')
  code.textContent = token
  pre.append(code)
  element.replaceWith(pre)
}

export function restoreClipboardCodeBlocks(markdown: string, marker: string, blocks: string[]): string {
  if (!blocks.length) return markdown
  const token = new RegExp(`${marker}(\\d+)\uE001`)
  const lines = markdown.split('\n')
  const result: string[] = []
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index + 1]?.match(token)
    if (match && blocks[Number(match[1])] && /```[ \t]*$/.test(lines[index]) && /```[ \t]*$/.test(lines[index + 2] ?? '')) {
      const block = blocks[Number(match[1])].split('\n')
      const prefix = lines[index + 1].slice(0, match.index)
      result.push(lines[index].replace(/```[ \t]*$/, () => block[0]))
      for (const line of block.slice(1, -1)) result.push(prefix + line)
      result.push(lines[index + 2].replace(/```[ \t]*$/, () => block.at(-1)!))
      index += 2
    } else {
      result.push(lines[index].replace(token, (_, id: string) => blocks[Number(id)] ?? ''))
    }
  }
  return result.join('\n')
}
