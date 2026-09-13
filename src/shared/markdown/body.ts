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

// --- Inline parsing -----------------------------------------------------------

/** Index of the next unescaped `delim` at or after `from`, or -1. */
function findClose(line: string, from: number, delim: string): number {
  let i = from
  while (i < line.length) {
    if (line[i] === '\\') { i += 2; continue }
    if (line[i] === '`') {
      const close = line.indexOf('`', i + 1)
      if (close !== -1) { i = close + 1; continue }
    }
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

// --- Supported blocks ---------------------------------------------------------

export const SUPPORTED_BLOCK_TYPES: ReadonlySet<string> = new Set([
  'paragraph', 'firstParagraph', 'heading', 'sceneBreak', 'chapterTitle', 'horizontalRule',
  'bulletList', 'orderedList', 'listItem', 'blockquote', 'codeBlock', 'hardBreak', 'text'
])

// --- Block serialization ------------------------------------------------------

/**
 * Escape block openers at the very start of a paragraph. `-` is deliberately
 * NOT escaped: a leading dash is French dialogue, and the reader never treats
 * `- ` as a list (see parseBlocks).
 */
function escapeLeading(line: string): string {
  return line
    .replace(/^(\s*)([#>+])/, '$1\\$2')
    .replace(/^(\s*)(\* )/, '$1\\* ')
    .replace(/^(\s*)(\d+)\. /, '$1$2\\. ')
    .replace(/^(\s*)(```)/, '$1\\```')
    .replace(/^(\s*)(---+)$/, '$1\\$2')
}

function inlineTextOf(node: TipTapNode): string {
  if (node.type === 'text') return node.text ?? ''
  return (node.content ?? []).map(inlineTextOf).join('')
}

function quoteLines(text: string): string {
  return text.split('\n').map(l => (l ? `> ${l}` : '>')).join('\n')
}

function serializeListItem(item: TipTapNode, marker: string): string {
  const body = serializeBlocks(item.content)
  const pad = ' '.repeat(marker.length)
  return body.split('\n').map((l, i) => (i === 0 ? marker + l : l ? pad + l : '')).join('\n')
}

function serializeBlocks(nodes: TipTapNode[] | undefined): string {
  const blocks: string[] = []
  for (const node of nodes ?? []) {
    const block = serializeBlock(node)
    if (block !== null && block !== '') blocks.push(block)
  }
  return blocks.join('\n\n')
}

function serializeBlock(node: TipTapNode): string | null {
  switch (node.type) {
    case 'chapterTitle':
      return null // title lives in frontmatter, never in the body
    case 'sceneBreak':
      return '* * *'
    case 'horizontalRule':
      return '---'
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 2)))
      return `${'#'.repeat(level)} ${serializeInline(node.content)}`
    }
    case 'paragraph':
    case 'firstParagraph':
      // Every physical line matters: a hard break starts a new one, and that line
      // must be escaped too or it would read back as a block of its own.
      return serializeInline(node.content).split('\n').map(escapeLeading).join('\n')
    case 'codeBlock': {
      const lang = typeof node.attrs?.language === 'string' ? node.attrs.language : ''
      const text = inlineTextOf(node)
      // CommonMark: the fence must be longer than the longest backtick run inside.
      const longest = (text.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0)
      const fence = '`'.repeat(Math.max(3, longest + 1))
      return fence + lang + '\n' + text + '\n' + fence
    }
    case 'blockquote':
      return quoteLines(serializeBlocks(node.content))
    case 'bulletList':
      return (node.content ?? []).map(li => serializeListItem(li, '+ ')).join('\n')
    case 'orderedList': {
      const start = Number(node.attrs?.start ?? 1)
      return (node.content ?? []).map((li, i) => serializeListItem(li, `${start + i}. `)).join('\n')
    }
    default:
      // Anti-loss fallback for unknown nodes: keep their text readable.
      return escapeLeading(inlineTextOf(node))
  }
}

/** doc JSON → markdown body (no frontmatter, no chapter title). */
export function docToMarkdownBody(doc: TipTapDoc): string {
  const body = serializeBlocks(doc.content)
  return body ? body + '\n' : ''
}

// --- Block parsing (line based) ----------------------------------------------

const RE_SCENE = /^\* \* \*$/
const RE_HR = /^---+$/
const RE_HEADING = /^(#{1,6}) (.*)$/
const RE_FENCE_OPEN = /^(`{3,})([\w+-]*)\s*$/
const RE_FENCE_CLOSE = /^(`{3,})\s*$/
const RE_QUOTE = /^>( |$)/
const RE_BULLET = /^([+*]) (.*)$/
const RE_ORDERED = /^(\d+)\. (.*)$/

function isBlockStart(line: string): boolean {
  const t = line.trim()
  return RE_SCENE.test(t) || RE_HR.test(t) || RE_HEADING.test(line) || RE_FENCE_OPEN.test(line)
    || RE_QUOTE.test(line) || RE_BULLET.test(line) || RE_ORDERED.test(line)
}

function leadingSpaces(line: string): number {
  return (line.match(/^ */) as RegExpMatchArray)[0].length
}

function parseList(lines: string[], start: number): { node: TipTapNode; next: number } {
  const ordered = RE_ORDERED.test(lines[start])
  const re = ordered ? RE_ORDERED : RE_BULLET
  const items: TipTapNode[] = []
  let startNum = 1
  let i = start
  while (i < lines.length) {
    const m = lines[i].match(re)
    if (!m) break
    if (items.length === 0 && ordered) startNum = Number(m[1])
    const markerLen = lines[i].length - m[2].length
    const body: string[] = [m[2]]
    i++
    while (i < lines.length) {
      const l = lines[i]
      if (l.trim() === '') {
        const n = lines[i + 1]
        if (n !== undefined && n.trim() !== '' && leadingSpaces(n) >= markerLen) { body.push(''); i++; continue }
        if (n !== undefined && re.test(n)) { i++ } // blank between items: same list
        break
      }
      if (leadingSpaces(l) >= markerLen) { body.push(l.slice(markerLen)); i++; continue }
      break
    }
    items.push({ type: 'listItem', content: parseBlocks(body) })
  }
  const node: TipTapNode = ordered
    ? { type: 'orderedList', attrs: { start: startNum }, content: items }
    : { type: 'bulletList', content: items }
  return { node, next: i }
}

function parseBlocks(lines: string[]): TipTapNode[] {
  const out: TipTapNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const t = line.trim()
    if (t === '') { i++; continue }
    if (RE_SCENE.test(t)) { out.push({ type: 'sceneBreak' }); i++; continue }
    if (RE_HR.test(t)) { out.push({ type: 'horizontalRule' }); i++; continue }
    const h = line.match(RE_HEADING)
    if (h) {
      out.push({ type: 'heading', attrs: { level: Math.min(3, h[1].length) }, content: parseInline(h[2]) })
      i++
      continue
    }
    const f = line.match(RE_FENCE_OPEN)
    if (f) {
      const fenceLen = f[1].length
      const code: string[] = []
      i++
      while (i < lines.length) {
        const close = lines[i].match(RE_FENCE_CLOSE)
        if (close && close[1].length >= fenceLen) break
        code.push(lines[i++])
      }
      i++ // closing fence, or past the end if unterminated
      const node: TipTapNode = { type: 'codeBlock', attrs: { language: f[2] || null } }
      // An empty block must stay contentless: an empty text node is not a valid TipTap node.
      const text = code.join('\n')
      if (text) node.content = [{ type: 'text', text }]
      out.push(node)
      continue
    }
    if (RE_QUOTE.test(line)) {
      const inner: string[] = []
      while (i < lines.length && RE_QUOTE.test(lines[i])) inner.push(lines[i++].replace(/^> ?/, ''))
      out.push({ type: 'blockquote', content: parseBlocks(inner) })
      continue
    }
    if (RE_BULLET.test(line) || RE_ORDERED.test(line)) {
      const r = parseList(lines, i)
      out.push(r.node)
      i = r.next
      continue
    }
    // Paragraph: one physical line, unless it ends with `\` or two spaces (hard break).
    const parts: TipTapNode[] = []
    let cur = line
    for (;;) {
      const hard = /(\\| {2})$/.test(cur)
      let text = cur.replace(/\s+$/, '')
      if (hard && text.endsWith('\\')) text = text.slice(0, -1)
      parts.push(...parseInline(text))
      const next = lines[i + 1]
      if (hard && next !== undefined && next.trim() !== '' && !isBlockStart(next)) {
        parts.push({ type: 'hardBreak' })
        cur = next
        i++
        continue
      }
      break
    }
    out.push({ type: 'paragraph', content: parts })
    i++
  }
  return out
}

/**
 * markdown body → content nodes. Every non-blank line is a paragraph unless it
 * opens a block; the first top-level paragraph becomes `firstParagraph`.
 */
export function markdownBodyToContent(body: string): TipTapNode[] {
  const lines = body.replace(/\r\n?/g, '\n').split('\n')
  const nodes = parseBlocks(lines)
  const first = nodes.find(n => n.type === 'paragraph')
  if (first) first.type = 'firstParagraph'
  return nodes
}
