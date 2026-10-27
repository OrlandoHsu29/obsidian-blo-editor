import { Descendant } from "slate"
import type { ReactNode } from "react"
import type { ToolbarPreferences } from '../../toolbar-preferences'
import type { IntegrationPreferences } from '../../integration-preferences'

/**
 * Handler for saving image files to vault
 * @param file - The file to save
 * @param path - The path within the vault to save the file
 * @returns The final path/reference to use in markdown
 */
export type OnImageSaveHandler = (file: File, path: string) => Promise<string>
export type RenderInternalLinkPreview = (target: string) => ReactNode
export type RenderInternalEmbed = (spec: string) => ReactNode
export type RenderMermaidPreview = (code: string) => ReactNode
export type OpenInternalLinkHandler = (target: string, newLeaf?: boolean) => void | Promise<void>
export type GetVaultImagePathsHandler = () => string[]
export type GetVaultFilePathsHandler = () => string[]

export type WysimarkEditor = {
  /**
   * Private state for the wysimark editor.
   */
  wysimark: {
    documentTitle?: ReactNode
    openSearch?: (replace?: boolean) => void
    normalizeInternalLink?: (value: string) => { target: string; display?: string }
    resolveInternalMedia?: (target: string) => string | undefined
    getReferencedMedia?: (url: string) => { target: string; name: string; path: string } | undefined
    toolbarPreferences?: ToolbarPreferences
    integrationPreferences?: IntegrationPreferences
    resolveImageUrl?: (url: string) => string
    save?: () => Promise<void>
    toggleReading?: () => Promise<void>
    readOnly?: boolean
    openTextColor?: () => void
    insertDrawing?: () => void | Promise<void>
    getTextColor?: () => string | null
    setTextColor?: (color: string | null) => void
    getTableDefaults?: () => { headerRow: boolean; headerColumn: boolean }
    setTableDefaults?: (defaults: { headerRow: boolean; headerColumn: boolean }) => void
    enableInternalLinks?: boolean
    disableCodeBlock?: boolean
    disableHighlight?: boolean
    disableTaskList?: boolean

    prevValue?: {
      markdown: string
      children: Descendant[]
    }

    /**
     * Handler for saving image to vault
     */
    onImageSave?: OnImageSaveHandler
    /** Download a remote file for an explicit attachment import. Saving is a separate step. */
    downloadAttachment?: (url: string) => Promise<File>

    /**
     * Get the current image paths available in the host vault.
     */
    getVaultImagePaths?: GetVaultImagePathsHandler

    /**
     * Get the current file paths available in the host vault.
     */
    getVaultFilePaths?: GetVaultFilePathsHandler

    /**
     * Handler for image change (drag/drop)
     */
    onImageChange?: (file: File) => Promise<string>

    /**
     * Render preview content for an internal link target.
     */
    renderInternalLinkPreview?: RenderInternalLinkPreview

    /**
     * Render inline content for an internal embed (`![[spec]]`).
     */
    renderInternalEmbed?: RenderInternalEmbed
    /** Host recognition also covers renamed Excalidraw Markdown files. */
    isDrawingEmbed?: (url: string) => boolean

    /**
     * Render a Mermaid code block using the host environment.
     */
    renderMermaidPreview?: RenderMermaidPreview

    /**
     * Open an internal link target.
     */
    openInternalLink?: OpenInternalLinkHandler
  }
  /**
   * Public methods for the wysimark editor.
   */
  getMarkdown: () => string
  setMarkdown: (markdown: string) => void
}
