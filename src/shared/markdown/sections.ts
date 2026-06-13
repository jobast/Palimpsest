import type { TipTapDoc, TipTapNode } from './types.js'

/**
 * Number of sections in a chapter doc = (# top-level sceneBreak nodes) + 1.
 * Returns 0 for empty/invalid input or a doc with no content (nothing to show).
 */
export function countSections(docJson: string | undefined): number {
  if (!docJson) return 0
  let doc: TipTapDoc
  try {
    doc = JSON.parse(docJson) as TipTapDoc
  } catch {
    return 0
  }
  const content: TipTapNode[] = Array.isArray(doc?.content) ? doc.content : []
  if (content.length === 0) return 0
  const breaks = content.filter(n => n.type === 'sceneBreak').length
  return breaks + 1
}
