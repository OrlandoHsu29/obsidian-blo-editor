import { Element } from "../types"
import { InternalLinkOptions } from "../obsidian-links"
import { normalizeElementListDepths } from "./normalize/normalizeElementListDepths"
import { serializeElements } from "./serialize-elements"
import { withLineEnding } from "../line-endings"
import { needsBlockMetadata, serializeBlockDocument } from '../../../blocks/persistence'

export function serialize(
  elements: Element[],
  options: InternalLinkOptions = { enableInternalLinks: true }
): string {
  if(needsBlockMetadata(elements))return serializeBlockDocument(elements,(node,number)=>serializeElements([node],options,number===undefined?undefined:new Map([[node,number]])))
  const normalizedElements = normalizeElementListDepths(elements)
  const lineEnding = elements.find((element) => element.__markdownLineEnding)?.__markdownLineEnding || "\n"
  return withLineEnding(serializeElements(normalizedElements, options), lineEnding)
}
