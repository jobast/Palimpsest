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
 * Check if a character is a word character (including French accents)
 */
function isWordChar(char: string): boolean {
  if (!char) return false
  return /[\p{L}\p{N}]/u.test(char)
}

/**
 * Find all occurrences of a word in a ProseMirror document
 * Returns array of {from, to} positions with proper word boundaries
 */
function findWordInDocument(
  doc: ProseMirrorNode,
  word: string
): Array<{ from: number; to: number }> {
  const results: Array<{ from: number; to: number }> = []
  const searchWord = word.toLowerCase()

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const text = node.text
      const textLower = text.toLowerCase()
      let searchStart = 0

      while (searchStart < textLower.length) {
        const matchIndex = textLower.indexOf(searchWord, searchStart)
        if (matchIndex === -1) break

        // Check word boundaries more carefully
        const charBefore = matchIndex > 0 ? text[matchIndex - 1] : ''
        const charAfter = matchIndex + searchWord.length < text.length
          ? text[matchIndex + searchWord.length]
          : ''

        const isStartOfWord = !isWordChar(charBefore)
        const isEndOfWord = !isWordChar(charAfter)

        if (isStartOfWord && isEndOfWord) {
          // Use the actual length from the original text (preserves case)
          const actualWord = text.slice(matchIndex, matchIndex + searchWord.length)
          results.push({
            from: pos + matchIndex,
            to: pos + matchIndex + actualWord.length
          })
        }

        searchStart = matchIndex + 1
      }
    }
    return true
  })

  return results
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
                const occurrences = findWordInDocument(doc, rep.word)

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
                  const occurrences = findWordInDocument(doc, issue.text)

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
