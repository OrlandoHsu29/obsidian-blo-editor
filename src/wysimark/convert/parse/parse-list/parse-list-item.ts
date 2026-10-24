import type { ListItem } from "mdast"

import { InternalLinkOptions } from "../../obsidian-links"
import { Element } from "../../types"
import { parseListItemChild } from "./parse-list-item-child"
import { parseContents } from "../parse-content"

export function parseListItem(
  listItem: ListItem,
  options: { depth: number; ordered: boolean },
  internalLinkOptions: InternalLinkOptions = {}
): Element[] {
  const type = typeof listItem.checked === "boolean" ? "task-list-item"
    : options.ordered ? "ordered-list-item" : "unordered-list-item"
  if (!listItem.children.length) return [{
    type, depth: options.depth,
    ...(type === "task-list-item" ? { checked: !!listItem.checked } : {}),
    children: [{ text: "" }],
  } as Element]
  const complex = listItem.children.filter((child) => child.type === "paragraph").length > 1 ||
    listItem.children.some((child) => child.type !== "paragraph" && child.type !== "list")
  if (complex) {
    return [{
      type,
      depth: options.depth,
      blockChildren: true,
      ...(type === "task-list-item" ? { checked: !!listItem.checked } : {}),
      children: parseContents(listItem.children, internalLinkOptions),
    } as Element]
  }
  const elements: Element[] = []
  for (const child of listItem.children) {
    elements.push(
      ...parseListItemChild(
        child,
        { ...options, checked: listItem.checked },
        internalLinkOptions
      )
    )
  }
  return elements
}
