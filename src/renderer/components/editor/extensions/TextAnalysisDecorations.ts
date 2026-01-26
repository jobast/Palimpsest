import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { useAnalysisStore } from '@/stores/analysisStore'
import type { IssueType } from '@/lib/analysis/types'

export interface TextAnalysisDecorationsOptions {
  enabled: boolean
}

const textAnalysisPluginKey = new PluginKey('textAnalysisDecorations')

/**
 * Word position cache for O(1) lookups
 * Built once per document version, then reused for all word searches
 */
interface WordPositionCache {
  positions: Map<string, Array<{ from: number; to: number }>>
  docVersion: number // Track document version to invalidate cache
}

// Module-level cache (shared across plugin calls)
let wordPositionCache: WordPositionCache | null = null

/**
 * Get CSS class for an issue type
 */
function getIssueClass(type: IssueType): string {
  switch (type) {
    case 'long-sentence':
      return 'analysis-long-sentence'
    case 'very-long-sentence':
      return 'analysis-very-long-sentence'
    case 'repetition-word':
      return 'analysis-repetition-word'
    case 'repetition-phrase':
      return 'analysis-repetition-phrase'
    case 'repetition-starter':
      return 'analysis-repetition-starter'
    case 'adverb':
      return 'analysis-adverb'
    case 'adjective':
      return 'analysis-adjective'
    case 'weak-verb':
      return 'analysis-weak-verb'
    default:
      return ''
  }
}

/**
 * Build a complete word position cache from the document
 * This is O(n) where n is document size, but only runs once per document version
 */
function buildWordPositionCache(doc: ProseMirrorNode): Map<string, Array<{ from: number; to: number }>> {
  const positions = new Map<string, Array<{ from: number; to: number }>>()

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const text = node.text
      // Match words including French accented characters
      const wordRegex = /[\p{L}\p{N}]+/gu
      let match

      while ((match = wordRegex.exec(text)) !== null) {
        const word = match[0].toLowerCase()
        const from = pos + match.index
        const to = from + match[0].length

        const existing = positions.get(word) || []
        existing.push({ from, to })
        positions.set(word, existing)
      }
    }
    return true
  })

  return positions
}

/**
 * Get or build the word position cache for a document
 * Cache is invalidated when document version changes
 */
function getWordPositionCache(doc: ProseMirrorNode, docVersion: number): Map<string, Array<{ from: number; to: number }>> {
  // Check if cache is valid for current document version
  if (wordPositionCache && wordPositionCache.docVersion === docVersion) {
    return wordPositionCache.positions
  }

  // Build new cache
  const positions = buildWordPositionCache(doc)
  wordPositionCache = { positions, docVersion }

  return positions
}

/**
 * Find all occurrences of a word using the cache - O(1) lookup
 */
function findWordInDocumentCached(
  cache: Map<string, Array<{ from: number; to: number }>>,
  word: string
): Array<{ from: number; to: number }> {
  return cache.get(word.toLowerCase()) || []
}


/**
 * TextAnalysisDecorations Extension
 *
 * Highlights based on active analysis mode:
 * - sentences: Long/very long sentences
 * - repetitions: Only the selected word group (others dimmed)
 * - style: Adverbs and weak verbs
 */
export const TextAnalysisDecorations = Extension.create<TextAnalysisDecorationsOptions>({
  name: 'textAnalysisDecorations',

  addOptions() {
    return {
      enabled: true
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: textAnalysisPluginKey,

        props: {
          decorations(state) {
            const {
              result,
              activeMode,
              selectedIssueId,
              getActiveTypesForHighlight
            } = useAnalysisStore.getState()

            if (!activeMode || !result) {
              return DecorationSet.empty
            }

            const decorations: Decoration[] = []
            const doc = state.doc

            // Get or build word position cache - O(n) first time, O(1) subsequent
            // Use a combination of doc size and content hash as version
            // For simplicity, use transaction count which changes on each edit
            const docVersion = (state as any).tr?.time || Date.now()
            const wordCache = getWordPositionCache(doc, docVersion)

            // REPETITIONS MODE
            if (activeMode === 'repetitions') {
              // Extract the selected word from the issue ID (format: repetition-word-{normalized})
              let selectedWord: string | null = null
              if (selectedIssueId?.startsWith('repetition-word-')) {
                selectedWord = selectedIssueId.replace('repetition-word-', '')
              } else if (selectedIssueId?.startsWith('repetition-starter-')) {
                selectedWord = selectedIssueId.replace('repetition-starter-', '')
              }

              for (const rep of result.repetitions) {
                const isSelected = rep.normalized === selectedWord
                // O(1) lookup using cache instead of O(n) document traversal
                const occurrences = findWordInDocumentCached(wordCache, rep.word)

                for (const occ of occurrences) {
                  try {
                    // Selected word: strong color, others: dimmed
                    const cssClass = isSelected
                      ? 'analysis-repetition-selected'
                      : 'analysis-repetition-dimmed'

                    const decoration = Decoration.inline(occ.from, occ.to, {
                      class: cssClass,
                      'data-repetition': rep.normalized
                    })
                    decorations.push(decoration)
                  } catch {
                    // Skip invalid decorations
                  }
                }
              }

              return DecorationSet.create(doc, decorations)
            }

            // STYLE MODE (adverbs, weak verbs)
            if (activeMode === 'style') {
              const activeTypes = new Set(getActiveTypesForHighlight())
              const issuesToHighlight = result.issues.filter(issue =>
                activeTypes.has(issue.type)
              )

              for (const issue of issuesToHighlight) {
                if (issue.type === 'adverb' || issue.type === 'weak-verb') {
                  // O(1) lookup using cache instead of O(n) document traversal
                  const occurrences = findWordInDocumentCached(wordCache, issue.text)

                  for (const occ of occurrences) {
                    const cssClass = getIssueClass(issue.type)
                    try {
                      const decoration = Decoration.inline(occ.from, occ.to, {
                        class: cssClass,
                        'data-issue-type': issue.type
                      })
                      decorations.push(decoration)
                    } catch {
                      // Skip
                    }
                  }
                }
              }

              return DecorationSet.create(doc, decorations)
            }

            // SENTENCES MODE
            if (activeMode === 'sentences') {
              const activeTypes = new Set(getActiveTypesForHighlight())
              const sentenceIssues = result.issues.filter(issue =>
                activeTypes.has(issue.type) &&
                (issue.type === 'long-sentence' || issue.type === 'very-long-sentence')
              )

              for (const issue of sentenceIssues) {
                // Get the first ~30 chars of the sentence to search for
                const searchText = issue.text.endsWith('...')
                  ? issue.text.slice(0, -3).trim()
                  : issue.text

                // Search in document
                doc.descendants((node, pos) => {
                  if (!node.isText || !node.text) return true

                  const text = node.text
                  const searchStart = searchText.slice(0, Math.min(40, searchText.length))
                  const startIndex = text.indexOf(searchStart)

                  if (startIndex !== -1) {
                    // Find sentence end (. ! ? …)
                    const remaining = text.slice(startIndex)
                    const endMatch = remaining.match(/[.!?…]/)
                    const endOffset = endMatch?.index !== undefined
                      ? endMatch.index + 1
                      : remaining.length

                    const from = pos + startIndex
                    const to = Math.min(pos + startIndex + endOffset, doc.content.size)

                    const cssClass = getIssueClass(issue.type)
                    const isSelected = selectedIssueId === issue.id
                    const classes = isSelected ? `${cssClass} analysis-selected` : cssClass

                    try {
                      const decoration = Decoration.inline(from, to, {
                        class: classes,
                        'data-issue-id': issue.id
                      })
                      decorations.push(decoration)
                    } catch {
                      // Skip
                    }

                    return false // Stop searching
                  }
                  return true
                })
              }

              return DecorationSet.create(doc, decorations)
            }

            return DecorationSet.empty
          }
        }
      })
    ]
  }
})
