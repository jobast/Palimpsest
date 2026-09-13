import type { TipTapDoc, TipTapNode } from './types.js'

// --- Supported schema ---------------------------------------------------------

export const SUPPORTED_MARK_TYPES: ReadonlySet<string> = new Set([
  'bold', 'italic', 'strike', 'code', 'underline', 'highlight'
])

/** Nesting order when writing, outermost first. `code` is always innermost. */
export const MARK_ORDER: readonly string[] = ['highlight', 'underline', 'strike', 'italic', 'bold', 'code']

const MARK_DELIMS: Record<string, [open: string, close: string]> = {
  highlight: ['==', '=='],
  underline: ['<u>', '</u>'],
  strike: ['~~', '~~'],
  italic: ['*', '*'],
  bold: ['**', '**'],
  code: ['`', '`']
}

// Delimiters tried by the reader, longest first so ** wins over *.
const INLINE_DELIMS: Array<[type: string, open: string, close: string]> = [
  ['bold', '**', '**'],
  ['italic', '*', '*'],
  ['strike', '~~', '~~'],
  ['highlight', '==', '=='],
  ['underline', '<u>', '</u>']
]

const ESCAPABLE = new Set(['*', '_', '\\', '`', '~', '=', '<', '>', '#', '+', '-', '.'])

// --- Serialization: doc JSON → markdown body -------------------------------

/** Escape characters/sequences that would open a mark when read back. */
function escapeInline(text: string): string {
  return text
    .replace(/([*_\\`])/g, '\\$1')
    .replace(/~~/g, '\\~~')
    .replace(/==/g, '\\==')
    .replace(/<(\/?u)>/g, '\\<$1>')
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

function sortMarks(types: string[]): string[] {
  return Array.from(new Set(types))
    .filter(t => SUPPORTED_MARK_TYPES.has(t))
    .sort((a, b) => MARK_ORDER.indexOf(a) - MARK_ORDER.indexOf(b))
}

function wrapMarks(text: string, types: string[]): string {
  let out = text
  // innermost first: walk MARK_ORDER from the end
  for (let i = MARK_ORDER.length - 1; i >= 0; i--) {
    const t = MARK_ORDER[i]
    if (types.includes(t)) out = MARK_DELIMS[t][0] + out + MARK_DELIMS[t][1]
  }
  return out
}

export function serializeInline(nodes: TipTapNode[] | undefined): string {
  if (!nodes) return ''
  let out = ''
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      out += '\\\n'
      continue
    }
    if (node.type !== 'text' || typeof node.text !== 'string') continue
    const types = sortMarks((node.marks ?? []).map(m => m.type))
    const raw = types.includes('code') ? node.text : escapeInline(node.text)
    out += wrapMarks(raw, types)
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

// --- Inline parsing -----------------------------------------------------------

/** Index of the next unescaped `delim` at or after `from`, or -1. */
function findClose(line: string, from: number, delim: string): number {
  let i = from
  while (i < line.length) {
    if (line[i] === '\\') { i += 2; continue }
    if (line.startsWith(delim, i)) return i
    i++
  }
  return -1
}

/**
 * Tokenize one physical line into text nodes carrying marks. Delimiters toggle
 * marks; an opener with no matching closer on the line is literal text; `\x`
 * yields a literal x for every escapable x (legacy \- and \. included).
 */
export function parseInline(line: string): TipTapNode[] {
  const out: TipTapNode[] = []
  const open: string[] = []
  let buf = ''
  const flush = () => {
    if (!buf) return
    const node: TipTapNode = { type: 'text', text: buf }
    if (open.length) node.marks = sortMarks(open).map(type => ({ type }))
    out.push(node)
    buf = ''
  }
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (ch === '\\' && i + 1 < line.length && ESCAPABLE.has(line[i + 1])) {
      buf += line[i + 1]
      i += 2
      continue
    }
    if (ch === '`') {
      const close = line.indexOf('`', i + 1)
      if (close > i) {
        flush()
        open.push('code')
        buf = line.slice(i + 1, close)
        flush()
        open.pop()
        i = close + 1
        continue
      }
    }
    let matched = false
    for (const [type, openD, closeD] of INLINE_DELIMS) {
      if (open.includes(type)) {
        if (line.startsWith(closeD, i)) {
          flush()
          open.splice(open.indexOf(type), 1)
          i += closeD.length
          matched = true
          break
        }
      } else if (line.startsWith(openD, i) && findClose(line, i + openD.length, closeD) !== -1) {
        flush()
        open.push(type)
        i += openD.length
        matched = true
        break
      }
    }
    if (matched) continue
    buf += ch
    i++
  }
  flush()
  return out
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
