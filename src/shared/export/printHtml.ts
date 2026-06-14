import type { TipTapDoc, TipTapNode } from '../markdown/types.js'

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
