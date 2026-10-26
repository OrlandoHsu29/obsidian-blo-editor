import mapValues from "just-map-values"
import { RefObject } from "react"

import { isDomElement } from "../../dom-guards"

import { MapHTMLElementLikeRecordToRectRecord, Rect } from "./types"

/**
 * The document that owns a positioned element. Overlays in a popout window (the
 * quick memo panel) must be measured against that window, not the main one.
 */
export function documentForHost(host?: Element | Document | null): Document {
  if (!host) return typeof activeDocument === "undefined" ? document : activeDocument
  // `instanceof` compares against the main realm, so check the node type instead.
  if (host.nodeType === 9) return host as Document
  return (host as Element).ownerDocument ?? document
}

/** First attached element in the record; it decides which window to measure. */
export function firstHostElement<
  T extends Record<string, HTMLElement | RefObject<HTMLElement>>
>(elementLikeRecord: T): HTMLElement | null {
  for (const value of Object.values(elementLikeRecord) as (
    | HTMLElement
    | RefObject<HTMLElement>
  )[]) {
    const element = isDomElement(value) ? value : value?.current
    if (element) return element
  }
  return null
}

/**
 * Tries to convert an `HTMLElement` to a `Rect` using the supplied
 * `convertElementToRect` method.
 *
 * The input Record can have as its values either an `HTMLElement` or a
 * `RefObject<HTMLElement>`. When it is a `RefObject` then it may or may not
 * refer to an `HTMLElement` so...
 *
 * - If the value is an `HTMLElement` we convert it to a `Rect`
 * - If the value is a `RefObject<HTMLElement>` we convert it to a
 *   `Rect | null` depending on whether the `RefObject` contains the
 *   `HTMLElement`.
 */
export function mapHTMLElementLikeRecordToRectRecord<
  T extends Record<string, HTMLElement | RefObject<HTMLElement>>
>(
  elementLikeRecord: T,
  converElementToRect: (element: HTMLElement) => Rect
): MapHTMLElementLikeRecordToRectRecord<T> {
  const rectRecord = mapValues(elementLikeRecord, (value) => {
    const maybeHTMLElement = isDomElement(value) ? value : value.current
    const nextValue = maybeHTMLElement
      ? converElementToRect(maybeHTMLElement)
      : null
    return nextValue
  }) as MapHTMLElementLikeRecordToRectRecord<T>
  return rectRecord
}
