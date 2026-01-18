// Word type analysis (adjectives, adverbs, weak verbs)

import type { WordTypeData, AnalysisIssue } from './types'
import { tokenize, isLikelyAdjective, isLikelyAdverb, isWeakVerb } from './frenchNLP'

/**
 * Analyze text for word types
 */
export function analyzeWordTypes(
  text: string,
  baseOffset: number = 0
): WordTypeData[] {
  const wordTypes: WordTypeData[] = []
  const tokens = tokenize(text)

  for (const token of tokens) {
    const word = token.word

    if (isLikelyAdverb(word)) {
      wordTypes.push({
        word,
        type: 'adverb',
        from: baseOffset + token.from,
        to: baseOffset + token.to
      })
    } else if (isLikelyAdjective(word)) {
      wordTypes.push({
        word,
        type: 'adjective',
        from: baseOffset + token.from,
        to: baseOffset + token.to
      })
    } else if (isWeakVerb(word)) {
      wordTypes.push({
        word,
        type: 'weak-verb',
        from: baseOffset + token.from,
        to: baseOffset + token.to
      })
    }
  }

  return wordTypes
}

/**
 * Calculate word type statistics
 */
export function calculateWordTypeStats(
  wordTypes: WordTypeData[],
  totalSentences: number
) {
  const adjectives = wordTypes.filter(w => w.type === 'adjective')
  const adverbs = wordTypes.filter(w => w.type === 'adverb')
  const weakVerbs = wordTypes.filter(w => w.type === 'weak-verb')

  return {
    adjectiveCount: adjectives.length,
    adverbCount: adverbs.length,
    weakVerbCount: weakVerbs.length,
    adjectivesPerSentence: totalSentences > 0
      ? Math.round((adjectives.length / totalSentences) * 10) / 10
      : 0,
    adverbsPerSentence: totalSentences > 0
      ? Math.round((adverbs.length / totalSentences) * 10) / 10
      : 0
  }
}

/**
 * Convert word types to issues (for highlighting)
 * Only creates issues for adverbs and weak verbs (adjectives are informational)
 */
export function wordTypesToIssues(
  wordTypes: WordTypeData[],
  includeAdverbs: boolean = true,
  includeWeakVerbs: boolean = true
): AnalysisIssue[] {
  const issues: AnalysisIssue[] = []

  for (const wt of wordTypes) {
    if (wt.type === 'adverb' && includeAdverbs) {
      issues.push({
        id: `adverb-${wt.from}`,
        type: 'adverb',
        severity: 'info',
        from: wt.from,
        to: wt.to,
        text: wt.word,
        message: `Adverbe en -ment`
      })
    } else if (wt.type === 'weak-verb' && includeWeakVerbs) {
      issues.push({
        id: `weak-verb-${wt.from}`,
        type: 'weak-verb',
        severity: 'info',
        from: wt.from,
        to: wt.to,
        text: wt.word,
        message: `Verbe faible (être, avoir, faire...)`
      })
    }
  }

  return issues
}

/**
 * Get a summary of word type density
 */
export function getStyleSummary(
  wordTypes: WordTypeData[],
  totalSentences: number,
  totalWords: number
) {
  const stats = calculateWordTypeStats(wordTypes, totalSentences)

  const warnings: string[] = []

  // Flag high adverb density (more than 2 per sentence average)
  if (stats.adverbsPerSentence > 2) {
    warnings.push(`Densité d'adverbes élevée (${stats.adverbsPerSentence}/phrase)`)
  }

  // Flag very high adjective density (more than 4 per sentence)
  if (stats.adjectivesPerSentence > 4) {
    warnings.push(`Beaucoup d'adjectifs (${stats.adjectivesPerSentence}/phrase)`)
  }

  // Flag high weak verb usage (more than 20% of total words)
  const weakVerbRatio = totalWords > 0 ? stats.weakVerbCount / totalWords : 0
  if (weakVerbRatio > 0.1) {
    warnings.push(`Usage fréquent de verbes faibles (${Math.round(weakVerbRatio * 100)}%)`)
  }

  return {
    ...stats,
    warnings,
    adjectiveRatio: totalWords > 0 ? Math.round((stats.adjectiveCount / totalWords) * 1000) / 10 : 0,
    adverbRatio: totalWords > 0 ? Math.round((stats.adverbCount / totalWords) * 1000) / 10 : 0
  }
}
