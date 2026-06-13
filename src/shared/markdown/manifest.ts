import type { ChapterRef } from './types.js'
import { chapterFileName, uniqueFileName } from './filename.js'

const DIR = 'chapitres'

/**
 * Map ordered chapters to file refs. Existing ids keep their file (stable
 * across rename/reorder → no git churn); new ids get a unique slug filename.
 * The numeric prefix for new files continues after the highest existing one.
 */
export function planChapterFiles(
  items: Array<{ id: string; title: string }>,
  existing: ChapterRef[]
): ChapterRef[] {
  const byId = new Map(existing.map(r => [r.id, r.file]))
  const taken = new Set(existing.map(r => r.file))
  let nextIndex = existing.length

  return items.map((item) => {
    const known = byId.get(item.id)
    if (known) return { id: item.id, file: known }
    const base = `${DIR}/${chapterFileName(nextIndex, item.title)}`
    const file = uniqueFileName(base, taken)
    taken.add(file)
    nextIndex += 1
    return { id: item.id, file }
  })
}

/** Files referenced before but not after - safe to delete. */
export function orphanFiles(oldRefs: ChapterRef[], newRefs: ChapterRef[]): string[] {
  const kept = new Set(newRefs.map(r => r.file))
  return oldRefs.filter(r => !kept.has(r.file)).map(r => r.file)
}
