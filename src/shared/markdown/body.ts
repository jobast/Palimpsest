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

// --- Parsing: markdown body → doc content nodes ----------------------------

function unescapeInline(text: string): string {
  return text.replace(/\\([*_\\#>+\-.])/g, '$1')
}

// Tokenize a single paragraph's text into text nodes carrying bold/italic.
// Order matters: *** then ** then *.
function parseInline(line: string): TipTapNode[] {
  const tokens: TipTapNode[] = []
  const re = /\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let last = 0
  let m: RegExpExecArray | null
  const pushText = (raw: string, marks?: string[]) => {
    if (!raw) return
    const node: TipTapNode = { type: 'text', text: unescapeInline(raw) }
    if (marks?.length) node.marks = marks.map(type => ({ type }))
    tokens.push(node)
  }
  while ((m = re.exec(line)) !== null) {
    pushText(line.slice(last, m.index))
    if (m[1] !== undefined) pushText(m[1], ['bold', 'italic'])
    else if (m[2] !== undefined) pushText(m[2], ['bold'])
    else if (m[3] !== undefined) pushText(m[3], ['italic'])
    last = re.lastIndex
  }
  pushText(line.slice(last))
  return tokens
}

function parseBlock(raw: string): TipTapNode | null {
  const block = raw.replace(/^\n+|\n+$/g, '')
  if (!block) return null
  if (/^\*\s\*\s\*$/.test(block.trim())) return { type: 'sceneBreak' }
  const heading = block.match(/^(#{1,3})\s+(.*)$/)
  if (heading) {
    return { type: 'heading', attrs: { level: heading[1].length }, content: parseInline(heading[2]) }
  }
  // Join soft-wrapped lines; CommonMark hard break (two trailing spaces) → hardBreak.
  const lines = block.split('\n')
  const content: TipTapNode[] = []
  lines.forEach((line, i) => {
    const hard = /  $/.test(line)
    content.push(...parseInline(line.replace(/\s+$/, '')))
    if (i < lines.length - 1) content.push(hard ? { type: 'hardBreak' } : { type: 'text', text: ' ' })
  })
  return { type: 'paragraph', content }
}

/**
 * markdown body → array of content nodes. The first paragraph becomes a
 * `firstParagraph` node (no first-line indent after the chapter title).
 */
export function markdownBodyToContent(body: string): TipTapNode[] {
  const blocks = body.split(/\n[ \t]*\n/)
  const nodes: TipTapNode[] = []
  for (const raw of blocks) {
    const node = parseBlock(raw)
    if (node) nodes.push(node)
  }
  const first = nodes.find(n => n.type === 'paragraph')
  if (first) first.type = 'firstParagraph'
  return nodes
}
