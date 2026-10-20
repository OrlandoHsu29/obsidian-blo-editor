import { ImageSharedElement } from "../../../image-plugin/types"
import {
  InternalLinkOptions,
  isWikiEmbedUrl,
  serializeWikiEmbedUrl,
} from "../../obsidian-links"

import { serializeGenericImageUrl } from "./serialize-generic-image-url"
import { serializeLinkDestination, serializeLinkTitle } from "../serialize-link-destination"
import { serializePortiveImageUrl } from "./serialize-portive-image-url"
import { serializeUncommonmarkImageUrl } from "./serialize-uncommonmark-image-url"

const urlSerializers = [
  serializePortiveImageUrl,
  serializeUncommonmarkImageUrl,
  serializeGenericImageUrl,
]

export function serializeImageShared(
  image: ImageSharedElement,
  options: InternalLinkOptions = {}
): string {
  if (options.enableInternalLinks && isWikiEmbedUrl(image.url)) {
    return serializeWikiEmbedUrl(image.url, image.width, image.height)
  }
  // Imported HTML may specify only a width (including fractions). Keep it on
  // save instead of dropping it or inventing intrinsic dimensions.
  if (image.width && Number.isFinite(image.width) && (!image.srcWidth || !image.srcHeight || !image.height)) {
    const attribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<img src="${attribute(image.url)}" alt="${attribute(image.alt || '')}" width="${image.width}"${image.height && Number.isFinite(image.height) ? ` height="${image.height}"` : ''}${image.title ? ` title="${attribute(image.title)}"` : ''}>`
  }

  for (const urlSerializer of urlSerializers) {
    const url = urlSerializer(image)
    if (typeof url === "string") {
      /**
       * Sometimes the serialized URL will return "" which means that the URL
       * hasn't returned yet. When this happens, we don't want the markdown for
       * the image to be added to the final value because the image would be
       * invalid. This happens when the image is uploading.
       */
      if (url === "") return ""
      return `![${(image.alt || "").replace(/[\\[\]]/g, "\\$&")}](${serializeLinkDestination(url)}${
        typeof image.title === "string" ? ` "${serializeLinkTitle(image.title)}"` : ""
      })`
    }
  }
  /**
   * Shouldn't get here because the last url seializer `serializeGenericUrl`
   * always returns a value.
   */
  throw new Error(`Shouldn't get here`)
}
