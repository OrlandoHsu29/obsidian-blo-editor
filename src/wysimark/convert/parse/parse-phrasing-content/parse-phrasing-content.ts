import type { PhrasingContent } from "mdast"

import { MarkProps, Segment } from "../../types"
import { assertUnreachable } from "../../utils"
import { normalizeSegments } from "./normalize-segments"
import { parseInlineImage } from "./parse-inline-image"
import {
  InternalLinkOptions,
  restoreEscapedWikiLinks,
  wikiEmbedUrl,
  wikiLinkDisplayText,
  wikiLinkHref,
} from "../../obsidian-links"
import { unescapeMarkdown } from "../../utils"

/**
 * Parse inline HTML content, with special handling for <mark> tags
 */
function parseInlineHtml(htmlValue: string, marks: MarkProps): Segment[] {
  htmlValue = restoreEscapedWikiLinks(htmlValue, true)
  // Check for <br> / <br/> / <br /> tags — treat as soft line break
  if (/^<br\s*\/?>$/i.test(htmlValue)) {
    return [{ text: "\n", ...marks }]
  }
  // Check for <mark>...</mark> pattern when the parser keeps it in one node.
  const markMatch = htmlValue.match(/^<mark\b[^>]*>(.+?)<\/mark>$/is)
  if (markMatch) {
    return [{ text: markMatch[1], ...marks, highlight: true }]
  }
  // Preserve unsupported HTML as source, rather than wrapping it in backticks.
  return [{ text: htmlValue, ...marks, html: true }]
}

function parseObsidianLinks(value: string, marks: MarkProps): Segment[] {
  const segments: Segment[] = []
  const pattern = /(!)?\[\[((?:\\.|[^\]\\\n])+?)\]\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value)) !== null) {
    const start = match.index
    if (start > 0 && value[start - 1] === "\\") continue
    if (start > lastIndex) {
      segments.push({
        text: restoreEscapedWikiLinks(value.slice(lastIndex, start)),
        ...marks,
      })
    }

    const rawSpec = unescapeMarkdown(restoreEscapedWikiLinks(match[2])).trim()
    if (match[1]) {
      segments.push({
        type: "image-inline",
        url: wikiEmbedUrl(rawSpec),
        alt: rawSpec,
        children: [{ text: "" }],
      })
    } else {
      segments.push({
        type: "anchor",
        href: wikiLinkHref(rawSpec),
        children: [{ text: wikiLinkDisplayText(rawSpec), ...marks }],
      })
    }
    lastIndex = start + match[0].length
  }

  if (lastIndex === 0) return [{ text: restoreEscapedWikiLinks(value), ...marks }]
  if (lastIndex < value.length) {
    segments.push({ text: restoreEscapedWikiLinks(value.slice(lastIndex)), ...marks })
  }
  return segments
}

const INLINE_TAG_MARKS: Record<string, keyof MarkProps> = {
  kbd: "kbd",
  sup: "sup",
  sub: "sub",
  u: "underline",
  code: "code",
  mark: "highlight",
  strong: "bold", b: "bold", em: "italic", i: "italic", s: "strike", del: "strike",
}

function parseInlineTag(
  phrasingContent: PhrasingContent
): { name: string; closing: boolean; style?: string } | null {
  if (phrasingContent.type !== "html") return null
  const tag =
    /^<(\/?)(kbd|sup|sub|u|code|strong|b|em|i|s|del)>$/i.exec(phrasingContent.value) ??
    /^<(\/?)(mark|span|font)\b[^>]*>$/i.exec(phrasingContent.value)
  if (!tag) return null
  const declared = /\bstyle\s*=\s*["']([^"']*)["']/i.exec(phrasingContent.value)?.[1] || ''
  const colors = declared.split(';').map(part => part.trim()).filter(part => /^(?:color|background-color)\s*:\s*(?:#[\da-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\))$/i.test(part)).map(part => part.replace(/\s*:\s*/, ':'))
  const fontColor = /\bcolor\s*=\s*["']([^"']*)["']/i.exec(phrasingContent.value)?.[1]
  if (fontColor && /^(?:#[\da-f]{3,8}|[a-z]+)$/i.test(fontColor)) colors.push('color:' + fontColor)
  if (/^(?:span|font)$/i.test(tag[2]) && !tag[1] && !colors.length) return null
  return { name: tag[2].toLowerCase(), closing: !!tag[1], style: colors.join(';') }
}

/**
 * Returns the indexes of formatting tags that have a matching open/close tag
 * among the same siblings. Only these become marks: an unmatched tag is kept
 * as raw HTML, so it is neither dropped on save nor applied to the rest of
 * the paragraph.
 */
function findPairedInlineTags(phrasingContents: PhrasingContent[]): Set<number> {
  const paired = new Set<number>()
  const openTags: Record<string, number[]> = {}
  phrasingContents.forEach((phrasingContent, index) => {
    const tag = parseInlineTag(phrasingContent)
    if (!tag) return
    const stack = (openTags[tag.name] ??= [])
    if (!tag.closing) {
      stack.push(index)
    } else if (stack.length) {
      paired.add(stack.pop())
      paired.add(index)
    }
  })
  return paired
}

export function parsePhrasingContents(
  phrasingContents: PhrasingContent[],
  marks: MarkProps = {},
  options: InternalLinkOptions = {}
): Segment[] {
  // Convert paired Obsidian highlight delimiters into the existing mark schema.
  const highlights = phrasingContents.flatMap((node, index) => node.type === 'text' ? [...node.value.matchAll(/==/g)].map(m => ({ index, offset: m.index! })) : [])
  if (highlights.length >= 2) {
    const paired = highlights.slice(0, highlights.length - highlights.length % 2)
    let sequence = 0
    phrasingContents = phrasingContents.flatMap((node, index): PhrasingContent[] => {
      const tokens = paired.filter(t => t.index === index); if (node.type !== 'text' || !tokens.length) return [node]
      const result: PhrasingContent[] = []; let cursor = 0
      for (const token of tokens) {
        if (token.offset > cursor) result.push({ type: 'text', value: node.value.slice(cursor, token.offset) })
        result.push({ type: 'html', value: sequence++ % 2 ? '</mark>' : '<mark>' }); cursor = token.offset + 2
      }
      if (cursor < node.value.length) result.push({ type: 'text', value: node.value.slice(cursor) }); return result
    })
  }
  const segments: Segment[] = []
  const pairedTags = findPairedInlineTags(phrasingContents)
  const tagDepths: Record<string, number> = {}
  let activeMarks = { ...marks }
  const styleStack: { name: string; style: string }[] = []
  phrasingContents.forEach((phrasingContent, index) => {
    const tag = pairedTags.has(index) ? parseInlineTag(phrasingContent) : null
    if (tag) {
      if (tag.name === 'span' || tag.name === 'font' || tag.name === 'mark' && (tag.style || styleStack.at(-1)?.name === 'mark')) {
        if (tag.closing) styleStack.pop(); else styleStack.push({ name: tag.name, style: tag.style || '' })
        activeMarks = { ...activeMarks, inlineStyle: [marks.inlineStyle, ...styleStack.map(s => s.style)].filter(Boolean).join(';') || undefined }
        if (tag.name !== 'mark') return
      }
      const key = INLINE_TAG_MARKS[tag.name]
      activeMarks = { ...activeMarks }
      tagDepths[key] = (tagDepths[key] || 0) + (tag.closing ? -1 : 1)
      if (tagDepths[key] > 0 || marks[key]) {
        activeMarks = { ...activeMarks, [key]: marks[key] || true }
      } else {
        delete activeMarks[key]
      }
      return
    }
    segments.push(...parsePhrasingContent(phrasingContent, activeMarks, options))
  })
  const nextInlines = normalizeSegments(segments)
  return nextInlines
}

function parsePhrasingContent(
  phrasingContent: PhrasingContent,
  marks: MarkProps = {},
  options: InternalLinkOptions = {}
): Segment[] {
  switch (phrasingContent.type) {
    case "delete":
      return parsePhrasingContents(
        phrasingContent.children,
        { ...marks, strike: true },
        options
      )
    case "emphasis":
      return parsePhrasingContents(
        phrasingContent.children,
        { ...marks, italic: true },
        options
      )
    case "footnoteReference":
      return [{ text: phrasingContent.identifier, ...marks, footnote: phrasingContent.identifier }]
    case "html":
      return parseInlineHtml(phrasingContent.value, marks)
    case "image":
      return parseInlineImage(phrasingContent)
    case "inlineCode": {
      return [
        { text: restoreEscapedWikiLinks(phrasingContent.value, true), ...marks, code: true },
      ]
    }
    case "link":
      return [
        {
          type: "anchor",
          href: phrasingContent.url,
          ...(phrasingContent.data?.markdownSyntax === "literal" || phrasingContent.data?.markdownSyntax === "autolink"
            ? { markdownSyntax: phrasingContent.data.markdownSyntax } : {}),
          title:
            /**
             * Ensure that `title` is undefined if it's null.
             */
            phrasingContent.title == null ? undefined : phrasingContent.title,
          children: parsePhrasingContents(
            phrasingContent.children,
            marks,
            options
          ),
        },
      ]
    case "strong":
      return parsePhrasingContents(
        phrasingContent.children,
        { ...marks, bold: true },
        options
      )
    case "text":
      return phrasingContent.value.split("\n").flatMap((line, index) => [
        ...(index ? [{ text: "\n", ...marks, softBreak: true as const }] : []),
        ...(options.enableInternalLinks && !marks.code
          ? parseObsidianLinks(line, marks)
          : [{ text: restoreEscapedWikiLinks(line, !!marks.code), ...marks }]),
      ])
    case "linkReference":
    case "imageReference":
      throw new Error(
        `linkReference and imageReference should be converted to link and image through our transformInlineLinks function`
      )
    case "break":
      return [{ text: "\n", ...marks }]
    case "footnote":
      /**
       * TODO: Support footnotes
       *
       * This is a footnote, and should be converte to a suitable alternative or
       * for us to explicitly support a Footnote type in the future. At the
       * moment, we don't explicitly support a footnote as it's (a) not part of
       * GFM and (b) not really that useful while (c) adding complexity to the
       * UI for something that's not used.
       */
      throw new Error("footnote is not supported yet")
  }
  assertUnreachable(phrasingContent)
}
