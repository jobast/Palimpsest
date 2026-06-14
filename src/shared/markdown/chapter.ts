import type { ChapterFrontmatter, ParsedChapter, TipTapNode } from './types.js'
import type { DocumentStatus } from '../types/project.js'
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter.js'
import { docToMarkdownBody, markdownBodyToContent } from './body.js'

const VALID_STATUS: DocumentStatus[] = ['draft', 'revision', 'final']

function genId(): string {
  // Works in both renderer (window.crypto) and node 22 (global crypto).
  return crypto.randomUUID()
}

/** chapter .md text → { frontmatter, doc } (doc carries a chapterTitle node). */
export function parseChapter(md: string, fallbackTitle: string): ParsedChapter {
  const { data, body } = parseFrontmatter(md)
  const title = typeof data.title === 'string' && data.title.trim() ? data.title : fallbackTitle
  const frontmatter: ChapterFrontmatter = {
    id: typeof data.id === 'string' && data.id ? data.id : genId(),
    title
  }
  if (typeof data.status === 'string' && (VALID_STATUS as string[]).includes(data.status)) {
    frontmatter.status = data.status as DocumentStatus
  }
  if (typeof data.synopsis === 'string') frontmatter.synopsis = data.synopsis
  if (typeof data.pov === 'string') frontmatter.pov = data.pov

  const titleNode: TipTapNode = { type: 'chapterTitle', content: [{ type: 'text', text: title }] }
  const bodyNodes = markdownBodyToContent(body)
  const content = bodyNodes.length
    ? [titleNode, ...bodyNodes]
    : [titleNode, { type: 'firstParagraph', content: [] }]

  return { frontmatter, doc: { type: 'doc', content } }
}

/** { frontmatter, doc } → chapter .md text. Title comes from frontmatter only. */
export function serializeChapter(parsed: ParsedChapter): string {
  const { frontmatter, doc } = parsed
  const data: Record<string, unknown> = { id: frontmatter.id, title: frontmatter.title }
  if (frontmatter.status) data.status = frontmatter.status
  if (frontmatter.synopsis !== undefined) data.synopsis = frontmatter.synopsis
  if (frontmatter.pov !== undefined) data.pov = frontmatter.pov
  return stringifyFrontmatter(data, docToMarkdownBody(doc))
}
