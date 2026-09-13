import type { TipTapDoc, TipTapNode } from './types.js'
import { MARK_ORDER, SUPPORTED_MARK_TYPES } from './body.js'

/**
 * What the Markdown projection keeps of a document. This is the oracle of the
 * codec property test: markdownBodyToContent(docToMarkdownBody(doc)) must equal
 * projectMarkdown(doc).content. Every deliberate loss of the .md is encoded here
 * (the sidecar keeps the exact document).
 */
export function projectMarkdown(doc: TipTapDoc): TipTapDoc {
  const content = projectBlocks(doc.content ?? [])
  const first = content.find(n => n.type === 'paragraph')
  if (first) first.type = 'firstParagraph'
  return { type: 'doc', content }
}

function inlineTextOf(node: TipTapNode): string {
  if (node.type === 'text') return node.text ?? ''
  return (node.content ?? []).map(inlineTextOf).join('')
}

function projectInline(nodes: TipTapNode[] | undefined): TipTapNode[] {
  const out: TipTapNode[] = []
  for (const n of nodes ?? []) {
    if (n.type === 'hardBreak') { out.push({ type: 'hardBreak' }); continue }
    if (n.type !== 'text' || !n.text) continue
    const marks = Array.from(new Set((n.marks ?? []).map(m => m.type)))
      .filter(t => SUPPORTED_MARK_TYPES.has(t))
      .sort((a, b) => MARK_ORDER.indexOf(a) - MARK_ORDER.indexOf(b))
    const node: TipTapNode = { type: 'text', text: n.text }
    if (marks.length) node.marks = marks.map(type => ({ type }))
    const prev = out[out.length - 1]
    if (prev && prev.type === 'text' && sameMarks(prev, node)) prev.text = (prev.text ?? '') + n.text
    else out.push(node)
  }
  return out
}

function sameMarks(a: TipTapNode, b: TipTapNode): boolean {
  return JSON.stringify(a.marks ?? []) === JSON.stringify(b.marks ?? [])
}

function projectBlocks(nodes: TipTapNode[]): TipTapNode[] {
  const out: TipTapNode[] = []
  for (const n of nodes) {
    switch (n.type) {
      case 'chapterTitle':
        break
      case 'paragraph':
      case 'firstParagraph': {
        const content = projectInline(n.content)
        if (content.length) out.push({ type: 'paragraph', content })
        break
      }
      case 'heading': {
        const level = Math.min(3, Math.max(1, Number(n.attrs?.level ?? 2)))
        out.push({ type: 'heading', attrs: { level }, content: projectInline(n.content) })
        break
      }
      case 'sceneBreak':
      case 'horizontalRule':
        out.push({ type: n.type })
        break
      case 'codeBlock': {
        const language = typeof n.attrs?.language === 'string' && n.attrs.language ? n.attrs.language : null
        const text = inlineTextOf(n)
        const node: TipTapNode = { type: 'codeBlock', attrs: { language } }
        if (text) node.content = [{ type: 'text', text }]
        out.push(node)
        break
      }
      case 'blockquote':
        out.push({ type: 'blockquote', content: projectBlocks(n.content ?? []) })
        break
      case 'bulletList':
        out.push({ type: 'bulletList', content: (n.content ?? []).map(li => ({ type: 'listItem', content: projectBlocks(li.content ?? []) })) })
        break
      case 'orderedList':
        out.push({ type: 'orderedList', attrs: { start: Number(n.attrs?.start ?? 1) }, content: (n.content ?? []).map(li => ({ type: 'listItem', content: projectBlocks(li.content ?? []) })) })
        break
      default: {
        // Unknown block → its text as one paragraph (serializer fallback)
        const text = inlineTextOf(n)
        if (text) out.push({ type: 'paragraph', content: [{ type: 'text', text }] })
      }
    }
  }
  return out
}
