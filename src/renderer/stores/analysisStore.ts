import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AnalysisResult,
  AnalysisSettings,
  AnalysisIssue,
  IssueType
} from '@/lib/analysis/types'
import { DEFAULT_ANALYSIS_SETTINGS } from '@/lib/analysis/types'
import {
  segmentSentences,
  analyzeSentences,
  calculateSentenceStats
} from '@/lib/analysis/sentenceAnalyzer'
import {
  detectRepetitions,
  detectRepeatedStarters,
  repetitionsToIssues
} from '@/lib/analysis/repetitionAnalyzer'
import {
  analyzeWordTypes,
  calculateWordTypeStats,
  wordTypesToIssues
} from '@/lib/analysis/wordTypeAnalyzer'

// Analysis modes - one at a time
export type AnalysisMode = 'sentences' | 'repetitions' | 'style'

interface AnalysisState {
  // Results
  result: AnalysisResult | null
  isAnalyzing: boolean
  lastAnalyzedDocumentId: string | null

  // Settings (persisted)
  settings: AnalysisSettings

  // UI state - simplified
  activeMode: AnalysisMode | null  // Which mode is active (null = none)
  selectedIssueId: string | null

  // Actions
  runAnalysis: (text: string, documentId: string) => Promise<void>
  clearResults: () => void
  updateSettings: (updates: Partial<AnalysisSettings>) => void
  setActiveMode: (mode: AnalysisMode | null) => void
  selectIssue: (id: string | null) => void

  // Getters
  getActiveIssues: () => AnalysisIssue[]
  getActiveTypesForHighlight: () => IssueType[]
}

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set, get) => ({
      // Initial state
      result: null,
      isAnalyzing: false,
      lastAnalyzedDocumentId: null,
      settings: DEFAULT_ANALYSIS_SETTINGS,
      activeMode: null,
      selectedIssueId: null,

      // Run analysis on text
      runAnalysis: async (text: string, documentId: string) => {
        set({ isAnalyzing: true })

        try {
          const { settings } = get()

          // Small delay to allow UI to update
          await new Promise(resolve => setTimeout(resolve, 10))

          // 1. Segment sentences
          const sentences = segmentSentences(text)

          // 2. Analyze sentences
          const sentenceIssues = analyzeSentences(
            sentences,
            settings.longSentenceThreshold,
            settings.veryLongSentenceThreshold
          )

          // 3. Detect repetitions
          const wordRepetitions = detectRepetitions(
            text,
            sentences,
            0,
            settings.repetitionWindow,
            settings.minRepetitionCount,
            settings.ignoreCommonWords
          )
          const starterRepetitions = detectRepeatedStarters(sentences, settings.minRepetitionCount)
          const repetitionIssues = repetitionsToIssues(wordRepetitions, starterRepetitions)

          // 4. Analyze word types
          const wordTypes = analyzeWordTypes(text)
          const wordTypeIssues = wordTypesToIssues(wordTypes, true, true)

          // 5. Calculate stats
          const sentenceStats = calculateSentenceStats(
            sentences,
            settings.longSentenceThreshold,
            settings.veryLongSentenceThreshold
          )
          const wordTypeStats = calculateWordTypeStats(wordTypes, sentences.length)

          // Combine all issues
          const allIssues = [...sentenceIssues, ...repetitionIssues, ...wordTypeIssues]

          // Create result
          const result: AnalysisResult = {
            sentences,
            issues: allIssues,
            repetitions: [...wordRepetitions, ...starterRepetitions],
            wordTypes,
            stats: {
              ...sentenceStats,
              ...wordTypeStats,
              repetitionCount: wordRepetitions.length + starterRepetitions.length
            },
            timestamp: Date.now(),
            documentId
          }

          // Set result and auto-activate sentences mode if issues found
          const hasIssues = sentenceIssues.length > 0 || repetitionIssues.length > 0
          set({
            result,
            isAnalyzing: false,
            lastAnalyzedDocumentId: documentId,
            activeMode: hasIssues ? 'sentences' : null
          })
        } catch (error) {
          console.error('Analysis error:', error)
          set({ isAnalyzing: false })
        }
      },

      // Clear results
      clearResults: () => {
        set({
          result: null,
          lastAnalyzedDocumentId: null,
          selectedIssueId: null,
          activeMode: null
        })
      },

      // Update settings
      updateSettings: (updates: Partial<AnalysisSettings>) => {
        set(state => ({
          settings: { ...state.settings, ...updates }
        }))
      },

      // Set active mode
      setActiveMode: (mode: AnalysisMode | null) => {
        set({ activeMode: mode, selectedIssueId: null })
      },

      // Select an issue
      selectIssue: (id: string | null) => {
        set({ selectedIssueId: id })
      },

      // Get issues for the active mode
      getActiveIssues: () => {
        const { result, activeMode } = get()
        if (!result || !activeMode) return []

        switch (activeMode) {
          case 'sentences':
            return result.issues.filter(i =>
              i.type === 'long-sentence' || i.type === 'very-long-sentence'
            )
          case 'repetitions':
            return result.issues.filter(i =>
              i.type === 'repetition-word' ||
              i.type === 'repetition-phrase' ||
              i.type === 'repetition-starter'
            )
          case 'style':
            return result.issues.filter(i =>
              i.type === 'adverb' || i.type === 'weak-verb'
            )
          default:
            return []
        }
      },

      // Get issue types to highlight for active mode
      getActiveTypesForHighlight: (): IssueType[] => {
        const { activeMode } = get()
        if (!activeMode) return []

        switch (activeMode) {
          case 'sentences':
            return ['long-sentence', 'very-long-sentence']
          case 'repetitions':
            return ['repetition-word', 'repetition-phrase', 'repetition-starter']
          case 'style':
            return ['adverb', 'weak-verb']
          default:
            return []
        }
      }
    }),
    {
      name: 'palimpseste-analysis',
      partialize: (state) => ({
        settings: state.settings,
        activeMode: state.activeMode
      }),
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        ...persistedState
      })
    }
  )
)

// Helper to get issues of a specific type
export function getIssuesByType(result: AnalysisResult | null, type: IssueType): AnalysisIssue[] {
  if (!result) return []
  return result.issues.filter(i => i.type === type)
}
