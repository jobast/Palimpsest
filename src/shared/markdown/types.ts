import type { DocumentStatus } from '../types/project'

export interface ChapterFrontmatter {
  id: string
  title: string
  status?: DocumentStatus
  synopsis?: string
  pov?: string
}

export interface TipTapMark { type: string; attrs?: Record<string, unknown> }
export interface TipTapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  marks?: TipTapMark[]
  text?: string
}
export interface TipTapDoc { type: 'doc'; content: TipTapNode[] }

export interface ParsedChapter { frontmatter: ChapterFrontmatter; doc: TipTapDoc }
export interface ChapterRef { id: string; file: string }
