// Types for text analysis feature

export type IssueType =
  | 'long-sentence'
  | 'very-long-sentence'
  | 'repetition-word'
  | 'repetition-phrase'
  | 'repetition-starter'
  | 'adverb'
  | 'adjective'
  | 'weak-verb'

export type IssueSeverity = 'info' | 'warning' | 'critical'

export interface AnalysisIssue {
  id: string
  type: IssueType
  severity: IssueSeverity
  from: number              // Document position start
  to: number                // Document position end
  text: string              // The flagged text
  message: string           // French description
  wordCount?: number        // For sentences
  occurrences?: number      // For repetitions
}

export interface SentenceData {
  text: string
  from: number
  to: number
  wordCount: number
  index: number             // Sentence index in document
}

export interface RepetitionData {
  word: string
  normalized: string        // Lowercase, no accents
  occurrences: Array<{
    from: number
    to: number
    sentenceIndex: number
  }>
  count: number
  isClose: boolean          // Within proximity window
}

export interface WordTypeData {
  word: string
  type: 'adjective' | 'adverb' | 'weak-verb'
  from: number
  to: number
}

export interface AnalysisStats {
  totalSentences: number
  averageSentenceLength: number
  longSentenceCount: number
  veryLongSentenceCount: number
  adjectiveCount: number
  adverbCount: number
  weakVerbCount: number
  repetitionCount: number
}

export interface AnalysisResult {
  sentences: SentenceData[]
  issues: AnalysisIssue[]
  repetitions: RepetitionData[]
  wordTypes: WordTypeData[]
  stats: AnalysisStats
  timestamp: number
  documentId: string
}

export interface AnalysisSettings {
  longSentenceThreshold: number       // Default: 25
  veryLongSentenceThreshold: number   // Default: 40
  repetitionWindow: number            // Default: 100 words
  minRepetitionCount: number          // Default: 3
  ignoreCommonWords: boolean          // Default: true
  highlightEnabled: boolean           // Default: true
  highlightTypes: IssueType[]         // Which types to highlight
}

export const DEFAULT_ANALYSIS_SETTINGS: AnalysisSettings = {
  longSentenceThreshold: 25,
  veryLongSentenceThreshold: 40,
  repetitionWindow: 100,
  minRepetitionCount: 3,
  ignoreCommonWords: true,
  highlightEnabled: true,
  highlightTypes: ['long-sentence', 'very-long-sentence', 'repetition-word']
}
