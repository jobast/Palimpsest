/**
 * DOCX Export Module
 *
 * Converts TipTap editor content to Microsoft Word format using the 'docx' library.
 * Supports headers, footers, page numbers, and manuscript formatting.
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  Packer,
  convertInchesToTwip,
  IRunOptions
} from 'docx'
import type { Editor } from '@tiptap/react'
import type { PageTemplate } from '@shared/types/templates'
import type { Project } from '@shared/types/project'

export interface DocxExportOptions {
  editor: Editor
  template: PageTemplate
  project: Project
  includeHeaders?: boolean
  includeFooters?: boolean
}

/**
 * Export editor content to DOCX format
 */
export async function exportToDocx(options: DocxExportOptions): Promise<Blob> {
  const {
    editor,
    template,
    project,
    includeHeaders = true,
    includeFooters = true
  } = options

  const children: Paragraph[] = []

  // Convert ProseMirror document to DOCX paragraphs
  editor.state.doc.forEach((node) => {
    const paragraph = convertNodeToParagraph(node, template)
    if (paragraph) {
      children.push(paragraph)
    }
  })

  // Create header if enabled
  const header = includeHeaders && template.header?.show
    ? createHeader(template, project)
    : undefined

  // Create footer if enabled
  const footer = includeFooters && template.footer?.show
    ? createFooter(template)
    : undefined

  // Parse page dimensions
  const pageWidth = parseInches(template.page.width)
  const pageHeight = parseInches(template.page.height)
  const marginTop = parseInches(template.page.marginTop)
  const marginBottom = parseInches(template.page.marginBottom)
  const marginLeft = parseInches(template.page.marginLeft)
  const marginRight = parseInches(template.page.marginRight)

  // Create document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            width: convertInchesToTwip(pageWidth),
            height: convertInchesToTwip(pageHeight)
          },
          margin: {
            top: convertInchesToTwip(marginTop),
            bottom: convertInchesToTwip(marginBottom),
            left: convertInchesToTwip(marginLeft),
            right: convertInchesToTwip(marginRight)
          }
        }
      },
      headers: header ? { default: header } : undefined,
      footers: footer ? { default: footer } : undefined,
      children
    }]
  })

  return await Packer.toBlob(doc)
}

/**
 * Convert a ProseMirror node to a DOCX Paragraph
 */
function convertNodeToParagraph(
  node: { type: { name: string }; attrs?: Record<string, unknown>; textContent: string; content?: { forEach: (fn: (child: unknown) => void) => void } },
  _template: PageTemplate
): Paragraph | null {
  const typeName = node.type.name

  // Chapter title
  if (typeName === 'chapterTitle') {
    return new Paragraph({
      children: [new TextRun({ text: node.textContent, bold: true, size: 32 })],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 200 }
    })
  }

  // Scene break
  if (typeName === 'sceneBreak') {
    return new Paragraph({
      children: [new TextRun({ text: '* * *' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 }
    })
  }

  // Headings
  if (typeName === 'heading') {
    const level = (node.attrs?.level as number) || 1
    return new Paragraph({
      children: [new TextRun({ text: node.textContent, bold: true })],
      heading: level === 1 ? HeadingLevel.HEADING_1 :
               level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 100 }
    })
  }

  // Regular paragraphs
  if (typeName === 'paragraph' || typeName === 'firstParagraph') {
    const runs = extractTextRuns(node)

    // Get text alignment
    const textAlign = node.attrs?.textAlign as string
    const alignment = textAlign === 'center' ? AlignmentType.CENTER :
                      textAlign === 'right' ? AlignmentType.RIGHT :
                      textAlign === 'justify' ? AlignmentType.JUSTIFIED :
                      AlignmentType.LEFT

    // Apply first-line indent (except for firstParagraph)
    const indent = typeName === 'firstParagraph' ? {} : {
      firstLine: convertInchesToTwip(0.5)
    }

    return new Paragraph({
      children: runs,
      alignment,
      indent,
      spacing: { line: 276 } // 1.5 line spacing (276 twips = 1.15 lines)
    })
  }

  // Blockquote
  if (typeName === 'blockquote') {
    return new Paragraph({
      children: [new TextRun({ text: node.textContent, italics: true })],
      indent: { left: convertInchesToTwip(0.5), right: convertInchesToTwip(0.5) },
      spacing: { before: 100, after: 100 }
    })
  }

  return null
}

/**
 * Extract TextRuns from a node, preserving inline formatting
 */
function extractTextRuns(node: { content?: { forEach: (fn: (child: unknown) => void) => void }; textContent: string }): TextRun[] {
  const runs: TextRun[] = []

  if (node.content) {
    node.content.forEach((child: unknown) => {
      const textNode = child as { isText?: boolean; text?: string; marks?: Array<{ type: { name: string } }> }
      if (textNode.isText && textNode.text) {
        // Check for marks (formatting)
        let isBold = false
        let isItalic = false
        let isUnderline = false
        let isStrike = false

        if (textNode.marks) {
          textNode.marks.forEach((mark) => {
            if (mark.type.name === 'bold') isBold = true
            if (mark.type.name === 'italic') isItalic = true
            if (mark.type.name === 'underline') isUnderline = true
            if (mark.type.name === 'strike') isStrike = true
          })
        }

        const options: IRunOptions = {
          text: textNode.text,
          bold: isBold || undefined,
          italics: isItalic || undefined,
          underline: isUnderline ? {} : undefined,
          strike: isStrike || undefined
        }

        runs.push(new TextRun(options))
      }
    })
  }

  // Fallback if no content children
  if (runs.length === 0 && node.textContent) {
    runs.push(new TextRun({ text: node.textContent }))
  }

  return runs
}

/**
 * Create document header
 */
function createHeader(template: PageTemplate, project: Project): Header {
  let content = template.header?.content || ''

  // Replace tokens
  content = content.replace(/\{title\}/g, project.meta.name || '')
  content = content.replace(/\{author\}/g, project.meta.author || '')

  return new Header({
    children: [
      new Paragraph({
        children: [new TextRun({ text: content, size: 20 })],
        alignment: AlignmentType.RIGHT
      })
    ]
  })
}

/**
 * Create document footer with page numbers
 */
function createFooter(template: PageTemplate): Footer {
  const children = template.footer?.showPageNumber
    ? [new TextRun({ children: [PageNumber.CURRENT] })]
    : []

  return new Footer({
    children: [
      new Paragraph({
        children,
        alignment: AlignmentType.CENTER
      })
    ]
  })
}

/**
 * Parse a dimension string to inches
 */
function parseInches(value: string): number {
  const match = value.match(/^([\d.]+)(in|cm|mm)?$/)
  if (!match) return 1

  const num = parseFloat(match[1])
  const unit = match[2] || 'in'

  if (unit === 'cm') return num / 2.54
  if (unit === 'mm') return num / 25.4
  return num
}

/**
 * Download DOCX file
 */
export async function downloadDocx(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
