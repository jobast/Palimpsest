import type { ManuscriptItem } from '../types/project.js'

/**
 * Ordered list of chapter ids (pre-order traversal). The model is flat today,
 * but children are flattened in order for robustness.
 */
export function flattenChapterIds(items: ManuscriptItem[]): string[] {
  const ids: string[] = []
  const walk = (list: ManuscriptItem[]) => {
    for (const item of list) {
      ids.push(item.id)
      if (item.children && item.children.length > 0) walk(item.children)
    }
  }
  walk(items)
  return ids
}

/**
 * Ordered ids of CHAPTER items (type === 'chapter') not yet present in the
 * integrations map. Folders and scenes are skipped; children are traversed.
 */
export function chaptersToAnalyze(items: ManuscriptItem[], integrated: Record<string, unknown>): string[] {
  const ids: string[] = []
  const walk = (list: ManuscriptItem[]) => {
    for (const item of list) {
      if (item.type === 'chapter' && !integrated[item.id]) ids.push(item.id)
      if (item.children && item.children.length > 0) walk(item.children)
    }
  }
  walk(items)
  return ids
}
