import type { TipTapDoc, TipTapNode } from './types.js'

// --- Serialization: doc JSON → markdown body -------------------------------

function escapeInline(text: string): string {
  return text.replace(/([*_\\])/g, '\\$1')
}

function escapeLeading(line: string): string {
  // Escape block markers only at the very start of a paragraph.
  // Note: * is only a bullet when followed by a space; ** starts bold, so we
  // match "* " (with trailing space) or use the [#+>-] set for the others.
  return line
    .replace(/^(\s*)([#>+-])/, '$1\\$2')
    .replace(/^(\s*)(\* )/, '$1\\* ')
    .replace(/^(\s*)(\d+)\./, '$1$2\\.')
}

function serializeInline(nodes: TipTapNode[] | undefined): string {
  if (!nodes) return ''
  let out = ''
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      out += '  \n'
      continue
    }
    if (node.type !== 'text' || typeof node.text !== 'string') continue
    let text = escapeInline(node.text)
    const marks = node.marks?.map(m => m.type) ?? []
    if (marks.includes('bold')) text = `**${text}**`
    if (marks.includes('italic')) text = `*${text}*`
    out += text
  }
  return out
}

function serializeBlock(node: TipTapNode): string | null {
  switch (node.type) {
    case 'chapterTitle':
      return null // title lives in frontmatter, never in the body
    case 'sceneBreak':
      return '* * *'
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 2)))
      return `${'#'.repeat(level)} ${serializeInline(node.content)}`
    }
    case 'paragraph':
    case 'firstParagraph':
      return escapeLeading(serializeInline(node.content))
    default:
      // Anti-loss fallback for unexpected nodes.
      return escapeLeading(serializeInline(node.content))
  }
}

/** doc JSON → markdown body (no frontmatter, no chapter title). */
export function docToMarkdownBody(doc: TipTapDoc): string {
  const blocks: string[] = []
  for (const node of doc.content ?? []) {
    const block = serializeBlock(node)
    if (block !== null) blocks.push(block)
  }
  return blocks.length ? blocks.join('\n\n') + '\n' : ''
}
