import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export interface WordStatsOptions {
  onUpdate?: (stats: WordStatsData) => void
  debounceMs?: number // Debounce delay for full recount (default: 300ms)
}

export interface WordStatsData {
  totalWords: number
  totalCharacters: number
  totalCharactersWithSpaces: number
  wordsAddedSinceLastUpdate: number
  wordsDeletedSinceLastUpdate: number
  paragraphs: number
  sentences: number
  readingTime: number // in minutes
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wordStats: {
      resetStats: () => ReturnType
      getStats: () => ReturnType
    }
  }
}

export const wordStatsPluginKey = new PluginKey('wordStats')

// Debounce delay for full word count recalculation
const DEFAULT_DEBOUNCE_MS = 300

/**
 * Calculate word count delta by analyzing only changed ranges
 * Uses ProseMirror's transaction steps to find modified regions
 */
function calculateWordDelta(oldDoc: ProseMirrorNode, _newDoc: ProseMirrorNode, tr: any): number {
  // Get the changed ranges from the transaction
  const changedRanges: Array<{ from: number; to: number }> = []

  tr.steps.forEach((_step: any, stepIndex: number) => {
    const stepMap = tr.mapping.maps[stepIndex]
    stepMap.forEach((_oldStart: number, _oldEnd: number, newStart: number, newEnd: number) => {
      changedRanges.push({ from: newStart, to: newEnd })
    })
  })

  if (changedRanges.length === 0) return 0

  // Merge overlapping ranges
  const mergedRanges = mergeRanges(changedRanges)

  let oldWords = 0
  let newWords = 0

  for (const range of mergedRanges) {
    // Count words in old doc at the mapped positions
    try {
      // Map back to old doc positions
      const mappedFrom = tr.mapping.invert().map(range.from)
      const mappedTo = tr.mapping.invert().map(range.to)
      oldWords += countWordsInRange(oldDoc, Math.min(mappedFrom, mappedTo), Math.max(mappedFrom, mappedTo))
    } catch {
      // If mapping fails, skip this range for old doc
    }

    // Count words in new doc at the new positions
    newWords += countWordsInRange(_newDoc, range.from, range.to)
  }

  return newWords - oldWords
}

/**
 * Merge overlapping ranges into non-overlapping ranges
 */
function mergeRanges(ranges: Array<{ from: number; to: number }>): Array<{ from: number; to: number }> {
  if (ranges.length === 0) return []

  const sorted = [...ranges].sort((a, b) => a.from - b.from)
  const merged: Array<{ from: number; to: number }> = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    const current = sorted[i]

    if (current.from <= last.to) {
      last.to = Math.max(last.to, current.to)
    } else {
      merged.push(current)
    }
  }

  return merged
}

/**
 * Count words in a specific range of the document
 */
function countWordsInRange(doc: ProseMirrorNode, from: number, to: number): number {
  let text = ''
  const clampedFrom = Math.max(0, from)
  const clampedTo = Math.min(doc.content.size, to)

  if (clampedFrom >= clampedTo) return 0

  doc.nodesBetween(clampedFrom, clampedTo, (node) => {
    if (node.isText && node.text) {
      text += node.text + ' '
    }
    return true
  })

  return countWords(text)
}

export const WordStats = Extension.create<WordStatsOptions>({
  name: 'wordStats',

  addOptions() {
    return {
      onUpdate: undefined,
      debounceMs: DEFAULT_DEBOUNCE_MS
    }
  },

  addStorage() {
    return {
      previousWordCount: 0,
      wordsAdded: 0,
      wordsDeleted: 0,
      lastStats: null as WordStatsData | null,
      // New: approximate count for immediate feedback
      approximateWordCount: 0,
      // New: debounce timer for full recount
      pendingRecountTimer: null as ReturnType<typeof setTimeout> | null
    }
  },

  addCommands() {
    return {
      resetStats:
        () =>
        ({ editor }) => {
          // Clear any pending recount timer
          if (this.storage.pendingRecountTimer) {
            clearTimeout(this.storage.pendingRecountTimer)
            this.storage.pendingRecountTimer = null
          }

          this.storage.wordsAdded = 0
          this.storage.wordsDeleted = 0
          const wordCount = countWords(editor.state.doc.textContent)
          this.storage.previousWordCount = wordCount
          this.storage.approximateWordCount = wordCount
          return true
        },

      getStats:
        () =>
        ({ editor }) => {
          const text = editor.state.doc.textContent
          const stats = calculateStats(text)
          this.storage.lastStats = stats
          return true
        }
    }
  },

  addProseMirrorPlugins() {
    const extension = this
    const debounceMs = extension.options.debounceMs ?? DEFAULT_DEBOUNCE_MS

    return [
      new Plugin({
        key: wordStatsPluginKey,
        view: () => ({
          update: (view, prevState) => {
            if (prevState.doc.eq(view.state.doc)) return

            // Get the transaction that caused this update
            const tr = view.state.tr

            // FAST PATH: Incremental delta calculation
            // Only analyze the changed ranges, not the entire document
            let delta = 0
            try {
              delta = calculateWordDelta(prevState.doc, view.state.doc, tr)
            } catch {
              // Fallback: if incremental calc fails, use approximate from storage
              // Will be corrected by the debounced full recount
              delta = 0
            }

            // Update approximate count immediately (O(1) operation)
            extension.storage.approximateWordCount += delta

            // Track added/deleted
            if (delta > 0) {
              extension.storage.wordsAdded += delta
            } else if (delta < 0) {
              extension.storage.wordsDeleted += Math.abs(delta)
            }

            // Notify with approximate stats for immediate UI feedback
            if (extension.options.onUpdate) {
              // Create lightweight stats object with approximate word count
              const approxStats: WordStatsData = {
                totalWords: extension.storage.approximateWordCount,
                totalCharacters: 0, // Will be updated in debounced recount
                totalCharactersWithSpaces: 0,
                wordsAddedSinceLastUpdate: delta > 0 ? delta : 0,
                wordsDeletedSinceLastUpdate: delta < 0 ? Math.abs(delta) : 0,
                paragraphs: 0,
                sentences: 0,
                readingTime: Math.ceil(extension.storage.approximateWordCount / 225)
              }
              extension.options.onUpdate(approxStats)
            }

            // DEBOUNCED: Full recount for accuracy
            // Clear existing timer
            if (extension.storage.pendingRecountTimer) {
              clearTimeout(extension.storage.pendingRecountTimer)
            }

            // Schedule full recount after typing pause
            extension.storage.pendingRecountTimer = setTimeout(() => {
              const text = view.state.doc.textContent
              const confirmedWordCount = countWords(text)

              // Sync the counts
              const previousWordCount = extension.storage.previousWordCount
              const totalDiff = confirmedWordCount - previousWordCount

              extension.storage.previousWordCount = confirmedWordCount
              extension.storage.approximateWordCount = confirmedWordCount

              // Calculate full stats
              const stats = calculateStats(text)
              stats.wordsAddedSinceLastUpdate = totalDiff > 0 ? totalDiff : 0
              stats.wordsDeletedSinceLastUpdate = totalDiff < 0 ? Math.abs(totalDiff) : 0
              extension.storage.lastStats = stats

              // Update with confirmed stats
              if (extension.options.onUpdate) {
                extension.options.onUpdate(stats)
              }
            }, debounceMs)
          },

          destroy: () => {
            // Clean up timer on unmount
            if (extension.storage.pendingRecountTimer) {
              clearTimeout(extension.storage.pendingRecountTimer)
              extension.storage.pendingRecountTimer = null
            }
          }
        })
      })
    ]
  }
})

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0).length
}

function countSentences(text: string): number {
  // Match sentence-ending punctuation followed by space or end of string
  const matches = text.match(/[.!?]+[\s]|[.!?]+$/g)
  return matches ? matches.length : 0
}

function countParagraphs(text: string): number {
  return text
    .split(/\n\n+/)
    .filter(p => p.trim().length > 0).length
}

function calculateStats(text: string): WordStatsData {
  const words = countWords(text)
  const characters = text.replace(/\s/g, '').length
  const charactersWithSpaces = text.length
  const sentences = countSentences(text)
  const paragraphs = countParagraphs(text)

  // Average reading speed: 200-250 words per minute
  const readingTime = Math.ceil(words / 225)

  return {
    totalWords: words,
    totalCharacters: characters,
    totalCharactersWithSpaces: charactersWithSpaces,
    wordsAddedSinceLastUpdate: 0,
    wordsDeletedSinceLastUpdate: 0,
    paragraphs,
    sentences,
    readingTime
  }
}
