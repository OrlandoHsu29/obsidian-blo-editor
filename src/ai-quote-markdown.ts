import { Descendant, Editor, Element, Node, Point, Range, Text } from 'slate'
import { isEditorSpacer } from './blocks/model'
import { isWikiEmbedUrl, isWikiLinkHref, splitWikiSpec, wikiEmbedSpecFromUrl, wikiLinkSpecFromHref, wikiLinkTarget } from './wysimark/convert/obsidian-links'
import { normalizeElementListDepths } from './wysimark/convert/serialize/normalize/normalizeElementListDepths'
import { serializeElements } from './wysimark/convert/serialize/serialize-elements'
import { ui } from './wysimark/utils/translations'

export type QuoteLocation = { firstBlock: number; lastBlock: number; heading?: string }

export function aiQuoteLocation(editor: Editor, range: Range): QuoteLocation {
  const [start, end] = Range.edges(range)
  const endsBeforeBlock = end.path[0] > start.path[0] && Point.equals(end, Editor.start(editor, [end.path[0]]))
  const lastIndex = end.path[0] - Number(endsBeforeBlock)
  let firstBlock = 0, lastBlock = 0, heading: string | undefined
  for (let index = 0; index <= lastIndex; index++) {
    const block = editor.children[index]
    if (isEditorSpacer(block)) continue
    lastBlock++
    if (index <= start.path[0]) {
      firstBlock = lastBlock
      if (Element.isElement(block) && block.type === 'heading') heading = Node.string(block).trim()
    }
  }
  return { firstBlock: Math.max(firstBlock, 1), lastBlock, heading }
}

function cleanSelectionNode(node: Descendant, htmlToMarkdown: (html: string) => string): Descendant {
  if (Text.isText(node)) {
    const { text, code, footnote, softBreak } = node
    if (node.html) return { text: htmlToMarkdown(text) }
    return { text, code, footnote, softBreak }
  }
  if (node.type === 'inline-code') return { text: Node.string(node), code: true }
  const clean = {
    ...Object.fromEntries(Object.entries(node).filter(([key]) => !key.startsWith('__'))),
    children: Array.from<Descendant>(node.children).filter(child => !isEditorSpacer(child))
      .map(child => cleanSelectionNode(child, htmlToMarkdown)),
  } as Element
  switch (clean.type) {
    case 'table': {
      delete clean.headerRow
      delete clean.headerColumn
      const columns = clean.children.reduce((width, row) => Math.max(width, row.children.length), 0)
      clean.columns = Array.from({ length: columns }, () => ({ align: 'left' }))
      for (const row of clean.children) {
        while (row.children.length < columns) {
          row.children.push({ type: 'table-cell', children: [{ type: 'table-content', children: [{ text: '' }] }] })
        }
      }
      break
    }
    case 'html-block':
      clean.html = htmlToMarkdown(clean.html)
      break
    case 'image-inline':
    case 'image-block':
      if (isWikiEmbedUrl(clean.url)) {
        const { target, display } = splitWikiSpec(wikiEmbedSpecFromUrl(clean.url))
        clean.url = target
        clean.alt = display && !/^\d+(?:x\d+)?$/u.test(display) ? display : ''
      }
      delete clean.width
      delete clean.height
      break
    case 'anchor':
      if (isWikiLinkHref(clean.href)) clean.href = wikiLinkTarget(wikiLinkSpecFromHref(clean.href))
      break
  }
  return clean
}

export function aiQuoteMarkdown(fragment: Descendant[], htmlToMarkdown: (html: string) => string): string {
  const blocks = fragment.filter(node => Element.isElement(node) && !isEditorSpacer(node))
    .map(node => cleanSelectionNode(node, htmlToMarkdown) as Element)
  return serializeElements(normalizeElementListDepths(blocks)).trim()
}

function codeSpan(value: string): string {
  const delimiter = '`'.repeat(1 + Math.max(0, ...Array.from(value.matchAll(/`+/g), ([run]) => run.length)))
  const pad = value.startsWith('`') || value.endsWith('`') ? ' ' : ''
  return `${delimiter}${pad}${value}${pad}${delimiter}`
}

export function aiQuotePrompt(path: string, location: QuoteLocation, markdown: string): string {
  const fence = '~'.repeat(1 + Array.from(markdown.matchAll(/~{3,}/g))
    .reduce((length, [run]) => Math.max(length, run.length), 2))
  const { firstBlock, lastBlock, heading } = location
  const blocks = firstBlock === lastBlock ? String(firstBlock) : `${firstBlock}–${lastBlock}`
  return [
    ui('请参考下面的引用回答。需要更多上下文时，可读取本机笔记。'),
    '',
    `- **${ui('本机笔记路径')}** ${codeSpan(path)}`,
    `- ${ui('引用自正文块 {blocks}', { blocks })}`,
    ...(heading ? [`- **${ui('最近标题')}** ${codeSpan(heading)}`] : []),
    '',
    `${fence}markdown\n${markdown}\n${fence}`,
    '',
    '',
  ].join('\n')
}
