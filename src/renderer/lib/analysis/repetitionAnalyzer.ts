// Repetition detection for French text

import type { RepetitionData, AnalysisIssue, SentenceData } from './types'
import { tokenize, normalizeWord, isCommonWord } from './frenchNLP'

interface TokenWithSentence {
  word: string
  normalized: string
  from: number
  to: number
  sentenceIndex: number
  wordIndex: number
}

/**
 * Detect word repetitions in text
 */
export function detectRepetitions(
  _text: string,
  sentences: SentenceData[],
  _baseOffset: number = 0,
  windowSize: number = 100,
  minCount: number = 3,
  ignoreCommon: boolean = true
): RepetitionData[] {
  // Tokenize with sentence information
  const tokens: TokenWithSentence[] = []
  let wordIndex = 0

  for (const sentence of sentences) {
    const sentenceTokens = tokenize(sentence.text)
    for (const token of sentenceTokens) {
      tokens.push({
        word: token.word,
        normalized: normalizeWord(token.word),
        from: sentence.from + token.from,
        to: sentence.from + token.to,
        sentenceIndex: sentence.index,
        wordIndex: wordIndex++
      })
    }
  }

  // Group tokens by normalized form
  const wordGroups = new Map<string, TokenWithSentence[]>()

  for (const token of tokens) {
    // Skip short words (1-2 chars) and common words if configured
    if (token.normalized.length < 3) continue
    if (ignoreCommon && isCommonWord(token.word)) continue

    const existing = wordGroups.get(token.normalized) || []
    existing.push(token)
    wordGroups.set(token.normalized, existing)
  }

  // Find repetitions
  const repetitions: RepetitionData[] = []

  for (const [normalized, occurrences] of wordGroups) {
    if (occurrences.length < minCount) continue

    // Check if any occurrences are within the window
    const closeOccurrences = findCloseOccurrences(occurrences, windowSize)

    if (closeOccurrences.length >= minCount) {
      repetitions.push({
        word: occurrences[0].word,  // Use original form
        normalized,
        occurrences: closeOccurrences.map(t => ({
          from: t.from,
          to: t.to,
          sentenceIndex: t.sentenceIndex
        })),
        count: closeOccurrences.length,
        isClose: true
      })
    }
  }

  // Sort by count (most repeated first)
  return repetitions.sort((a, b) => b.count - a.count)
}

/**
 * Find occurrences that are within the proximity window
 */
function findCloseOccurrences(
  occurrences: TokenWithSentence[],
  windowSize: number
): TokenWithSentence[] {
  if (occurrences.length < 2) return []

  // Find the longest sequence of close occurrences
  let bestSequence: TokenWithSentence[] = []

  for (let i = 0; i < occurrences.length; i++) {
    const sequence: TokenWithSentence[] = [occurrences[i]]

    for (let j = i + 1; j < occurrences.length; j++) {
      const lastInSeq = sequence[sequence.length - 1]
      const current = occurrences[j]

      // Check if within window (by word index, not character position)
      if (current.wordIndex - lastInSeq.wordIndex <= windowSize) {
        sequence.push(current)
      }
    }

    if (sequence.length > bestSequence.length) {
      bestSequence = sequence
    }
  }

  return bestSequence
}

/**
 * Detect repeated sentence starters
 */
export function detectRepeatedStarters(
  sentences: SentenceData[],
  minCount: number = 3
): RepetitionData[] {
  const starters = new Map<string, Array<{ from: number; to: number; sentenceIndex: number }>>()

  for (const sentence of sentences) {
    // Get first 2-3 words as the starter
    const words = sentence.text.match(/[\wÀ-ÿ]+/g)
    if (!words || words.length < 2) continue

    const starter = normalizeWord(words.slice(0, 2).join(' '))
    const starterText = words.slice(0, 2).join(' ')

    const existing = starters.get(starter) || []
    existing.push({
      from: sentence.from,
      to: sentence.from + starterText.length,
      sentenceIndex: sentence.index
    })
    starters.set(starter, existing)
  }

  const repetitions: RepetitionData[] = []

  for (const [normalized, occurrences] of starters) {
    if (occurrences.length >= minCount) {
      // Get the original text from the first occurrence
      const firstSentence = sentences.find(s => s.index === occurrences[0].sentenceIndex)
      const originalText = firstSentence?.text.match(/[\wÀ-ÿ]+\s+[\wÀ-ÿ]+/)?.[0] || normalized

      repetitions.push({
        word: originalText,
        normalized,
        occurrences,
        count: occurrences.length,
        isClose: false  // Starters aren't measured by proximity
      })
    }
  }

  return repetitions.sort((a, b) => b.count - a.count)
}

/**
 * Convert repetitions to analysis issues
 */
export function repetitionsToIssues(
  wordRepetitions: RepetitionData[],
  starterRepetitions: RepetitionData[]
): AnalysisIssue[] {
  const issues: AnalysisIssue[] = []

  // Word repetitions
  for (const rep of wordRepetitions) {
    // Create one issue per repetition group, highlighting all occurrences
    issues.push({
      id: `repetition-word-${rep.normalized}`,
      type: 'repetition-word',
      severity: rep.count >= 5 ? 'critical' : 'warning',
      from: rep.occurrences[0].from,
      to: rep.occurrences[0].to,
      text: `"${rep.word}" ×${rep.count}`,
      message: `Mot répété ${rep.count} fois${rep.isClose ? ' (proches)' : ''}`,
      occurrences: rep.count
    })
  }

  // Sentence starter repetitions
  for (const rep of starterRepetitions) {
    issues.push({
      id: `repetition-starter-${rep.normalized}`,
      type: 'repetition-starter',
      severity: 'info',
      from: rep.occurrences[0].from,
      to: rep.occurrences[0].to,
      text: `"${rep.word}..." ×${rep.count}`,
      message: `Début de phrase répété ${rep.count} fois`,
      occurrences: rep.count
    })
  }

  return issues
}
