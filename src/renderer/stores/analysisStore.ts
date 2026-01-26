import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AnalysisResult,
  AnalysisSettings,
  AnalysisIssue,
  IssueType
} from '@/lib/analysis/types'
import { DEFAULT_ANALYSIS_SETTINGS } from '@/lib/analysis/types'
import type { WorkerResponse } from '@/lib/analysis/analysisWorker'

// Analysis modes - one at a time
export type AnalysisMode = 'sentences' | 'repetitions' | 'style'

// Analysis progress tracking
interface AnalysisProgress {
  step: string
  progress: number // 0-100
}

interface AnalysisState {
  // Results
  result: AnalysisResult | null
  isAnalyzing: boolean
  lastAnalyzedDocumentId: string | null

  // Progress tracking for UI feedback
  analysisProgress: AnalysisProgress | null

  // Settings (persisted)
  settings: AnalysisSettings

  // UI state - simplified
  activeMode: AnalysisMode | null  // Which mode is active (null = none)
  selectedIssueId: string | null

  // Worker instance (not persisted)
  _worker: Worker | null
  _currentAnalysisId: string | null

  // Actions
  runAnalysis: (text: string, documentId: string) => Promise<void>
  cancelAnalysis: () => void
  clearResults: () => void
  updateSettings: (updates: Partial<AnalysisSettings>) => void
  setActiveMode: (mode: AnalysisMode | null) => void
  selectIssue: (id: string | null) => void

  // Getters
  getActiveIssues: () => AnalysisIssue[]
  getActiveTypesForHighlight: () => IssueType[]
}

/**
 * Create or get the analysis worker instance
 */
function getOrCreateWorker(state: AnalysisState): Worker {
  if (state._worker) return state._worker

  // Create worker using Vite's worker syntax
  const worker = new Worker(
    new URL('../lib/analysis/analysisWorker.ts', import.meta.url),
    { type: 'module' }
  )

  return worker
}

/**
 * Generate unique analysis ID
 */
function generateAnalysisId(): string {
  return `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set, get) => ({
      // Initial state
      result: null,
      isAnalyzing: false,
      lastAnalyzedDocumentId: null,
      analysisProgress: null,
      settings: DEFAULT_ANALYSIS_SETTINGS,
      activeMode: null,
      selectedIssueId: null,
      _worker: null,
      _currentAnalysisId: null,

      // Run analysis on text using Web Worker (non-blocking)
      runAnalysis: async (text: string, documentId: string) => {
        const state = get()

        // Cancel any existing analysis
        if (state._currentAnalysisId && state._worker) {
          state._worker.postMessage({ type: 'cancel', id: state._currentAnalysisId })
        }

        const analysisId = generateAnalysisId()
        const worker = getOrCreateWorker(state)

        set({
          isAnalyzing: true,
          analysisProgress: { step: 'Initialisation...', progress: 0 },
          _worker: worker,
          _currentAnalysisId: analysisId
        })

        return new Promise<void>((resolve, reject) => {
          const handleMessage = (event: MessageEvent<WorkerResponse>) => {
            const message = event.data

            // Ignore messages from other analysis runs
            if (message.id !== analysisId) return

            if (message.type === 'progress') {
              set({ analysisProgress: { step: message.step, progress: message.progress } })
            }

            if (message.type === 'result') {
              const hasIssues = message.result.issues.some(
                i => i.type === 'long-sentence' ||
                     i.type === 'very-long-sentence' ||
                     i.type.startsWith('repetition')
              )

              set({
                result: message.result,
                isAnalyzing: false,
                lastAnalyzedDocumentId: documentId,
                analysisProgress: null,
                activeMode: hasIssues ? 'sentences' : null,
                _currentAnalysisId: null
              })

              worker.removeEventListener('message', handleMessage)
              resolve()
            }

            if (message.type === 'error') {
              console.error('Analysis worker error:', message.error)

              // Only update state if this was the current analysis
              if (get()._currentAnalysisId === analysisId) {
                set({
                  isAnalyzing: false,
                  analysisProgress: null,
                  _currentAnalysisId: null
                })
              }

              worker.removeEventListener('message', handleMessage)

              if (message.error === 'Cancelled') {
                resolve() // Cancellation is not an error
              } else {
                reject(new Error(message.error))
              }
            }
          }

          worker.addEventListener('message', handleMessage)

          // Send analysis request to worker
          worker.postMessage({
            type: 'analyze',
            id: analysisId,
            text,
            settings: state.settings,
            documentId
          })
        })
      },

      // Cancel ongoing analysis
      cancelAnalysis: () => {
        const { _worker, _currentAnalysisId } = get()
        if (_worker && _currentAnalysisId) {
          _worker.postMessage({ type: 'cancel', id: _currentAnalysisId })
          set({
            isAnalyzing: false,
            analysisProgress: null,
            _currentAnalysisId: null
          })
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
        // Explicitly exclude: result, isAnalyzing, analysisProgress, _worker, _currentAnalysisId
      }),
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        ...persistedState,
        // Ensure non-persisted state is reset on load
        result: null,
        isAnalyzing: false,
        analysisProgress: null,
        _worker: null,
        _currentAnalysisId: null
      })
    }
  )
)

// Helper to get issues of a specific type
export function getIssuesByType(result: AnalysisResult | null, type: IssueType): AnalysisIssue[] {
  if (!result) return []
  return result.issues.filter(i => i.type === type)
}
