import type { ManuscriptItem } from '../types/project.js'
import type { TipTapDoc } from '../markdown/types.js'

/** Document of a brand new chapter: its title and an empty first paragraph. */
export function defaultChapterDoc(title: string): TipTapDoc {
  return {
    type: 'doc',
    content: [
      { type: 'chapterTitle', content: [{ type: 'text', text: title }] },
      { type: 'firstParagraph', content: [] }
    ]
  }
}

/**
 * Immutable update marking one chapter unreadable. Used when the document cannot
 * be loaded into the editor: the banner and the read-only path then apply, and
 * saveProject stops rewriting the file we could not read.
 */
export function markItemUnreadable(items: ManuscriptItem[], id: string): ManuscriptItem[] {
  return items.map(item => {
    if (item.id === id) return { ...item, loadState: 'unreadable' }
    if (item.children) return { ...item, children: markItemUnreadable(item.children, id) }
    return item
  })
}

export interface DuplicatedItem {
  clone: ManuscriptItem
  /** source id → clone id, in tree order, to copy the document contents over. */
  idPairs: Array<{ from: string; to: string }>
}

/**
 * Deep copy under fresh ids. `loadState` is deliberately not copied: the clone is
 * a new chapter whose file does not exist yet. Carrying 'unreadable' over would
 * make saveProject skip it forever, so the manifest would keep a ref to a file
 * that is never written.
 */
export function duplicateItem(item: ManuscriptItem, newId: () => string): DuplicatedItem {
  const idPairs: Array<{ from: string; to: string }> = []
  const clone = (src: ManuscriptItem, isRoot: boolean): ManuscriptItem => {
    const id = newId()
    idPairs.push({ from: src.id, to: id })
    const copy: ManuscriptItem = {
      id,
      type: src.type,
      title: isRoot ? `${src.title} (copie)` : src.title,
      status: src.status,
      wordCount: src.wordCount
    }
    if (src.synopsis !== undefined) copy.synopsis = src.synopsis
    if (src.pov !== undefined) copy.pov = src.pov
    if (src.location !== undefined) copy.location = src.location
    if (src.children) copy.children = src.children.map(child => clone(child, false))
    return copy
  }
  return { clone: clone(item, true), idPairs }
}

export type ChapterSavePlan =
  | { action: 'skip'; reason: 'unreadable' | 'no-content' | 'invalid-content' }
  | { action: 'write'; doc: TipTapDoc }

/**
 * What to do with one chapter at save time.
 * - unreadable: never serialized, never rewritten (spec 6).
 * - loaded from disk but absent from memory: never rewritten either, a title-only
 *   default document would wipe its whole body.
 * - created in session: the default document.
 */
export function planChapterSave(
  item: Pick<ManuscriptItem, 'title' | 'loadState'>,
  json: string | undefined
): ChapterSavePlan {
  if (item.loadState === 'unreadable') return { action: 'skip', reason: 'unreadable' }
  if (!json) {
    if (item.loadState) return { action: 'skip', reason: 'no-content' }
    return { action: 'write', doc: defaultChapterDoc(item.title) }
  }
  try {
    return { action: 'write', doc: JSON.parse(json) as TipTapDoc }
  } catch {
    return { action: 'skip', reason: 'invalid-content' }
  }
}
