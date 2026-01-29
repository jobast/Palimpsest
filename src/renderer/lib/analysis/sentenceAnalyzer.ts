// Sentence analysis for French text

import type { SentenceData, AnalysisIssue } from './types'
import { countWords, ABBREVIATION_REGEX } from './frenchNLP'

/**
 * Segment text into sentences, handling French punctuation and abbreviations
 */
export function segmentSentences(text: string, baseOffset: number = 0): SentenceData[] {
  const sentences: SentenceData[] = []
  let searchIndex = 0

  // Replace abbreviations with placeholders to avoid false sentence breaks
  const placeholderMap = new Map<string, string>()
  let processedText = text.replace(ABBREVIATION_REGEX, (match) => {
    const placeholder = `__ABBR${placeholderMap.size}__`
    placeholderMap.set(placeholder, match)
    return placeholder
  })

  // Split on sentence-ending punctuation
  // Handle: . ! ? and combinations like ?! or ...
  // Also handle French dialogue with guillemets
  const sentenceRegex = /[^.!?…]+(?:[.!?…]+(?:\s*[»"'])?|\s*$)/g
  let match

  while ((match = sentenceRegex.exec(processedText)) !== null) {
    let sentenceText = match[0]

    // Restore abbreviations
    placeholderMap.forEach((original, placeholder) => {
      sentenceText = sentenceText.replace(placeholder, original)
    })

    sentenceText = sentenceText.trim()

    if (sentenceText.length > 0) {
      // Calculate actual position in original text by forward search
      const foundIndex = text.indexOf(sentenceText, searchIndex)
      const from = foundIndex >= 0 ? baseOffset + foundIndex : baseOffset + match.index
      const to = from + sentenceText.length

      if (foundIndex >= 0) {
        searchIndex = foundIndex + sentenceText.length
      }

      sentences.push({
        text: sentenceText,
        from,
        to,
        wordCount: countWords(sentenceText),
        index: sentences.length
      })
    }

  }

  return sentences
}

/**
 * Analyze sentences and return issues for long/very long sentences
 */
export function analyzeSentences(
  sentences: SentenceData[],
  longThreshold: number,
  veryLongThreshold: number
): AnalysisIssue[] {
  const issues: AnalysisIssue[] = []

  for (const sentence of sentences) {
    if (sentence.wordCount >= veryLongThreshold) {
      issues.push({
        id: `sentence-${sentence.index}-verylong`,
        type: 'very-long-sentence',
        severity: 'critical',
        from: sentence.from,
        to: sentence.to,
        text: truncateText(sentence.text, 60),
        message: `Phrase très longue (${sentence.wordCount} mots)`,
        wordCount: sentence.wordCount
      })
    } else if (sentence.wordCount >= longThreshold) {
      issues.push({
        id: `sentence-${sentence.index}-long`,
        type: 'long-sentence',
        severity: 'warning',
        from: sentence.from,
        to: sentence.to,
        text: truncateText(sentence.text, 60),
        message: `Phrase longue (${sentence.wordCount} mots)`,
        wordCount: sentence.wordCount
      })
    }
  }

  return issues
}

/**
 * Calculate sentence statistics
 */
export function calculateSentenceStats(sentences: SentenceData[], longThreshold: number, veryLongThreshold: number) {
  if (sentences.length === 0) {
    return {
      totalSentences: 0,
      averageSentenceLength: 0,
      longSentenceCount: 0,
      veryLongSentenceCount: 0
    }
  }

  const totalWords = sentences.reduce((sum, s) => sum + s.wordCount, 0)
  const longCount = sentences.filter(s => s.wordCount >= longThreshold && s.wordCount < veryLongThreshold).length
  const veryLongCount = sentences.filter(s => s.wordCount >= veryLongThreshold).length

  return {
    totalSentences: sentences.length,
    averageSentenceLength: Math.round((totalWords / sentences.length) * 10) / 10,
    longSentenceCount: longCount,
    veryLongSentenceCount: veryLongCount
  }
}

/**
 * Truncate text for display with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}
