import type { TipTapDoc, TipTapNode } from '../markdown/types.js'
import type { PageTemplate } from '../types/templates.js'
import type { Project } from '../types/project.js'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function serializeInline(nodes: TipTapNode[] | undefined): string {
  if (!nodes) return ''
  let out = ''
  for (const node of nodes) {
    if (node.type === 'hardBreak') { out += '<br>'; continue }
    if (node.type !== 'text' || typeof node.text !== 'string') continue
    let html = escapeHtml(node.text)
    const marks = node.marks?.map(m => m.type) ?? []
    if (marks.includes('italic')) html = `<em>${html}</em>`
    if (marks.includes('bold')) html = `<strong>${html}</strong>`
    out += html
  }
  return out
}

function alignStyle(node: TipTapNode): string {
  const align = node.attrs?.textAlign
  return typeof align === 'string' && align ? ` style="text-align:${align}"` : ''
}

function serializeBlock(node: TipTapNode): string {
  switch (node.type) {
    case 'chapterTitle':
      return `<h1 class="chapter-title">${serializeInline(node.content)}</h1>`
    case 'sceneBreak':
      return `<p class="scene-break">* * *</p>`
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 2)))
      return `<h${level}>${serializeInline(node.content)}</h${level}>`
    }
    case 'firstParagraph':
      return `<p class="first-paragraph"${alignStyle(node)}>${serializeInline(node.content)}</p>`
    case 'paragraph':
      return `<p${alignStyle(node)}>${serializeInline(node.content)}</p>`
    default:
      // Anti-loss fallback for unexpected nodes.
      return `<p${alignStyle(node)}>${serializeInline(node.content)}</p>`
  }
}

/** chapter doc JSON → HTML fragment (no <html>/<body> wrapper). */
export function docToPrintHtml(doc: TipTapDoc): string {
  return (doc.content ?? []).map(serializeBlock).join('\n')
}

/** Assemble a standalone print HTML document from chapter fragments + template CSS. */
export function buildBookHtml(chapterHtmls: string[], template: PageTemplate, project: Project): string {
  const { page, typography } = template
  const css = `
    @page { size: ${page.width} ${page.height}; margin: ${page.marginTop} ${page.marginRight} ${page.marginBottom} ${page.marginLeft}; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ${typography.fontFamily}; font-size: ${typography.fontSize}; line-height: ${typography.lineHeight}; color: #000; }
    p { margin: 0; text-align: justify; text-indent: ${typography.firstLineIndent}; }
    p.first-paragraph { text-indent: 0; }
    p.scene-break { text-align: center; text-indent: 0; margin: 1em 0; }
    h1.chapter-title { text-align: center; font-weight: bold; text-indent: 0; margin: 0 0 2em; break-after: avoid; }
    h1, h2, h3 { text-indent: 0; }
    section.chapter { break-before: page; }
    section.chapter:first-of-type { break-before: avoid; }
  `
  const body = chapterHtmls.map(h => `<section class="chapter">${h}</section>`).join('\n')
  const title = escapeHtml(project.meta.name ?? '')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head><body>${body}</body></html>`
}

/** Build Chromium printToPDF header/footer templates from the page template. */
export function buildPrintHeaderFooter(
  template: PageTemplate,
  project: Project
): { displayHeaderFooter: boolean; headerTemplate: string; footerTemplate: string } {
  const headerOn = !!template.header?.show
  const footerOn = !!(template.footer?.show && template.footer.showPageNumber)
  const author = escapeHtml(project.meta.author ?? '')
  const title = escapeHtml(project.meta.name ?? '')
  const empty = '<span></span>'

  let headerTemplate = empty
  if (headerOn) {
    const content = (template.header!.content || '')
      .replace(/\{author\}/g, author)
      .replace(/\{title\}/g, title)
      .replace(/\{page\}/g, '<span class="pageNumber"></span>')
    const fs = template.header!.fontSize || '9pt'
    headerTemplate = `<div style="font-size:${fs}; width:100%; text-align:center; padding:0 8mm;">${content}</div>`
  }

  let footerTemplate = empty
  if (footerOn) {
    const fs = template.footer!.fontSize || '9pt'
    footerTemplate = `<div style="font-size:${fs}; width:100%; text-align:center;"><span class="pageNumber"></span></div>`
  }

  return { displayHeaderFooter: headerOn || footerOn, headerTemplate, footerTemplate }
}
