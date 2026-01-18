import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export interface WordStatsOptions {
  onUpdate?: (stats: WordStatsData) => void
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

export const WordStats = Extension.create<WordStatsOptions>({
  name: 'wordStats',

  addOptions() {
    return {
      onUpdate: undefined
    }
  },

  addStorage() {
    return {
      previousWordCount: 0,
      wordsAdded: 0,
      wordsDeleted: 0,
      lastStats: null as WordStatsData | null
    }
  },

  addCommands() {
    return {
      resetStats:
        () =>
        ({ editor }) => {
          this.storage.wordsAdded = 0
          this.storage.wordsDeleted = 0
          this.storage.previousWordCount = countWords(editor.state.doc.textContent)
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

    return [
      new Plugin({
        key: wordStatsPluginKey,
        view: () => ({
          update: (view, prevState) => {
            if (prevState.doc.eq(view.state.doc)) return

            const text = view.state.doc.textContent
            const currentWordCount = countWords(text)
            const previousWordCount = extension.storage.previousWordCount

            const diff = currentWordCount - previousWordCount

            if (diff > 0) {
              extension.storage.wordsAdded += diff
            } else if (diff < 0) {
              extension.storage.wordsDeleted += Math.abs(diff)
            }

            extension.storage.previousWordCount = currentWordCount

            const stats = calculateStats(text)
            stats.wordsAddedSinceLastUpdate = diff > 0 ? diff : 0
            stats.wordsDeletedSinceLastUpdate = diff < 0 ? Math.abs(diff) : 0
            extension.storage.lastStats = stats

            if (extension.options.onUpdate) {
              extension.options.onUpdate(stats)
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
