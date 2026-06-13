import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

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
    const { options, storage } = this
    const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS

    return [
      new Plugin({
        key: wordStatsPluginKey,
        view: () => ({
          update: (view, prevState) => {
            if (prevState.doc.eq(view.state.doc)) return

            // Reliable word delta (handles typing + paste consistently)
            const currentWordCount = countWords(view.state.doc.textContent)
            const previousWordCount = storage.previousWordCount ?? 0
            const delta = currentWordCount - previousWordCount
            storage.previousWordCount = currentWordCount
            storage.approximateWordCount = currentWordCount

            // Track added/deleted
            if (delta > 0) {
              storage.wordsAdded += delta
            } else if (delta < 0) {
              storage.wordsDeleted += Math.abs(delta)
            }

            // Notify with approximate stats for immediate UI feedback
            if (options.onUpdate) {
              // Create lightweight stats object with approximate word count
              const approxStats: WordStatsData = {
                totalWords: currentWordCount,
                totalCharacters: 0, // Will be updated in debounced recount
                totalCharactersWithSpaces: 0,
                wordsAddedSinceLastUpdate: delta > 0 ? delta : 0,
                wordsDeletedSinceLastUpdate: delta < 0 ? Math.abs(delta) : 0,
                paragraphs: 0,
                sentences: 0,                
                readingTime: Math.ceil(currentWordCount / 225)
              }
              options.onUpdate(approxStats)
            }

            // DEBOUNCED: Full recount for accuracy
            // Clear existing timer
            if (storage.pendingRecountTimer) {
              clearTimeout(storage.pendingRecountTimer)
            }

            // Schedule full recount after typing pause
            storage.pendingRecountTimer = setTimeout(() => {
              const text = view.state.doc.textContent
              const confirmedWordCount = countWords(text)
              storage.previousWordCount = confirmedWordCount
              storage.approximateWordCount = confirmedWordCount

              // Calculate full stats
              const stats = calculateStats(text)
              // Deltas are already emitted in the fast path above; avoid double counting.
              stats.wordsAddedSinceLastUpdate = 0
              stats.wordsDeletedSinceLastUpdate = 0
              storage.lastStats = stats

              // Update with confirmed stats
              options.onUpdate?.(stats)
            }, debounceMs)
          },

          destroy: () => {
            // Clean up timer on unmount
            if (storage.pendingRecountTimer) {
              clearTimeout(storage.pendingRecountTimer)
              storage.pendingRecountTimer = null
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
