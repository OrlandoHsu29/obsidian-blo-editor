import { Element, Segment } from "../types"
import { InternalLinkOptions } from "../obsidian-links"
import { assertUnreachable } from "../utils"
import { serializeElements } from "./serialize-elements"
import { serializeCodeBlock } from "./serialize-code-block"
import { serializeImageBlock } from "./serialize-image-block"
import { serializeImageShared } from './serialize-image-shared'
import { rowImages } from '../../image-plugin/row-model'
import { serializeLine } from "./serialize-line"
import { serializeTable } from "./serialize-table"
import { ListItemElement } from "../../list-plugin/types"
import { serializeAnchor } from "./serialize-line/segment/serialize-anchor"
import { serializeMath } from "../../math-plugin/serialize"

const LIST_INDENT_SIZE = 4

function serializeListItem(element: ListItemElement, marker: string, options: InternalLinkOptions): string {
  const indent = " ".repeat(element.depth * LIST_INDENT_SIZE)
  const content = element.blockChildren
    ? serializeElements(element.children as Element[], options)
    : serializeLine(element.children as Segment[], [], [], options)
  // Continuation lines are indented exactly to the item's content column, so
  // the list parser strips all of it. Any extra indentation would be kept as
  // content inside code spans.
  const continuation = element.type === "task-list-item" ? 2 : marker.length
  return `${indent}${marker}${content.split("\n").map((line, index) =>
    index && line ? `${indent}${" ".repeat(continuation)}${line}` : line
  ).join("\n")}\n`
}

export function serializeElement(
  element: Element,
  orders: number[],
  options: InternalLinkOptions = {}
): string {
  switch (element.type) {
    case 'inline-code':
      return serializeLine([element], [], [], options)
    case "math-block":
      return serializeMath(element.latex, true)
    case "math-inline":
      return serializeMath(element.latex)
    case "anchor":
      return serializeAnchor(element, options)
    case "block-quote": {
      const children = element.children as Element[]
      if (element.footnoteIdentifier) {
        const body = serializeElements(children, options)
        return `[^${element.footnoteIdentifier}]: ${body.split("\n").map((line, index) =>
          index && line ? `    ${line}` : line
        ).join("\n")}\n\n`
      }
      const firstChild = children[0]
      const isCallout =
        firstChild?.type === "paragraph" &&
        /^\[![A-Za-z0-9_-]+\][+-]?(?:\s+.*)?$/.test(
          serializeLine(firstChild.children as Segment[])
        )
      const lines = isCallout
        ? `${serializeElement(firstChild, orders, options).trimEnd()}\n${serializeElements(
          children.slice(1),
          options
        ).trimStart()}`
        : serializeElements(children, options)
      return `${lines
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n")}\n\n`
    }
    case "heading":
      return `${"#".repeat(element.level)} ${serializeLine(
        element.children as Segment[], [], [], options
      )}\n\n`
    case "horizontal-rule":
      return "---\n\n"
    case "paragraph": {
      const content = serializeLine(
        element.children as Segment[],
        [],
        [],
        options
      )
      if (content === "") {
        return "\n"
      }
      return `${content}\n\n`
    }
    /**
     * Table
     */
    case "table":
      return serializeTable(element, options)
    case "table-row":
    case "table-cell":
    case "table-content":
      throw new Error(
        `Table elements should only be present as children of table which should be handled by serializeTable. Got ${element.type} may indicate an error in normalization.`
      )
    /**
     * List
     */
    case "unordered-list-item": {
      return serializeListItem(element, "- ", options)
    }
    case "ordered-list-item": {
      return serializeListItem(element, `${orders[element.depth]}. `, options)
    }
    case "task-list-item": {
      if (element.blockChildren) return serializeListItem(element, `- [${element.checked ? "x" : " "}] `, options)
      const indent = " ".repeat(element.depth * LIST_INDENT_SIZE)
      let line = serializeLine(element.children as Segment[], [], [], options)
      if (line.trim() === "") {
        line = "&#32;"
      }
      return `${indent}- [${element.checked ? "x" : " "}] ${line}\n`
    }
    case "image-block":
      return serializeImageBlock(element, options)
    case 'image-row': {
      const images = rowImages(element).map(image => ({ image, markdown:serializeImageShared(image, options) })).filter(item => item.markdown)
      if (images.length === 1) return `${images[0].markdown}\n\n`
      const sizes = images.map(({image}) => [image.width ?? null,image.height ?? null])
      // Save the aligned height even when an incoming image has not loaded yet.
      const metadata = sizes.some(([width,height]) => width || height)
        ? `<!-- wysimark-image-row:v1 ${encodeURIComponent(JSON.stringify(sizes))} -->\n\n` : ''
      return `${metadata}${images.map(item => item.markdown).join(' ')}\n\n`
    }
    case 'image-row-caret':
      return ''
    case "image-inline":
      return `![${element.alt || ""}](${element.url})`
    case "code-block":
      return serializeCodeBlock(element)
    case "code-block-line":
      throw new Error(
        `Code block line elements should only be present as children of code-block which should be handled by serializeCodeBlock. Got code-block-line may indicate an error in normalization.`
      )
    case "html-block":
      return `${element.html}\n\n`
    case "link-definition":
      return `${element.markdown}\n\n`
  }
  assertUnreachable(element)
}
