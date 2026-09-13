import type { ChapterFrontmatter, TipTapDoc } from './types.js'
import { parseChapter } from './chapter.js'
import { parseSidecar } from './sidecar.js'
import { sha256Hex } from './hash.js'

export type ChapterLoadState = 'exact' | 'fromMarkdown' | 'unreadable'
export type FallbackReason = 'no-sidecar' | 'hash-mismatch' | 'corrupt' | 'unknown-version' | 'invalid-doc'

export interface ResolveInput {
  md: string | null          // null = the .md could not be read
  sidecarText: string | null // null = no sidecar file
  refId: string              // manifest id, always wins
  fallbackTitle: string
}

export interface ResolvedChapter {
  loadState: ChapterLoadState
  frontmatter: ChapterFrontmatter | null
  doc: TipTapDoc | null
  reason?: FallbackReason
}

/**
 * Decide where a chapter's document comes from. Pure: the caller does the I/O.
 * - md unreadable → 'unreadable' (never drop, never rewrite)
 * - sidecar valid and hash matches the .md → 'exact' (doc from sidecar)
 * - otherwise → 'fromMarkdown' (extended codec), with the reason
 */
export async function resolveChapterDoc(input: ResolveInput): Promise<ResolvedChapter> {
  if (input.md === null) return { loadState: 'unreadable', frontmatter: null, doc: null }
  const parsed = parseChapter(input.md, input.fallbackTitle, input.refId)
  if (input.sidecarText === null) return { loadState: 'fromMarkdown', ...parsed, reason: 'no-sidecar' }
  const sc = parseSidecar(input.sidecarText)
  if (!sc.ok) return { loadState: 'fromMarkdown', ...parsed, reason: sc.reason }
  if (sc.sidecar.mdHash !== await sha256Hex(input.md)) {
    return { loadState: 'fromMarkdown', ...parsed, reason: 'hash-mismatch' }
  }
  return { loadState: 'exact', frontmatter: parsed.frontmatter, doc: sc.sidecar.doc }
}
