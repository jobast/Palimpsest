/**
 * Web Worker for text analysis
 *
 * Runs stylistic analysis in a separate thread to avoid blocking the UI.
 * This is critical for large manuscripts (100,000+ words).
 */

import type {
  AnalysisResult,
  AnalysisSettings,
  SentenceData,
  RepetitionData,
  WordTypeData,
  AnalysisIssue
} from './types'
import { segmentSentences, analyzeSentences, calculateSentenceStats } from './sentenceAnalyzer'
import { detectRepetitions, detectRepeatedStarters, repetitionsToIssues } from './repetitionAnalyzer'
import { analyzeWordTypes, calculateWordTypeStats, wordTypesToIssues } from './wordTypeAnalyzer'

// Message types
interface AnalyzeMessage {
  type: 'analyze'
  id: string
  text: string
  settings: AnalysisSettings
  documentId: string
}

interface CancelMessage {
  type: 'cancel'
  id: string
}

type WorkerMessage = AnalyzeMessage | CancelMessage

interface ResultMessage {
  type: 'result'
  id: string
  result: AnalysisResult
}

interface ErrorMessage {
  type: 'error'
  id: string
  error: string
}

interface ProgressMessage {
  type: 'progress'
  id: string
  step: string
  progress: number // 0-100
}

type WorkerResponse = ResultMessage | ErrorMessage | ProgressMessage

// Track active analysis tasks for cancellation
const activeTasks = new Set<string>()

/**
 * Post a progress update to the main thread
 */
function postProgress(id: string, step: string, progress: number) {
  const message: ProgressMessage = { type: 'progress', id, step, progress }
  self.postMessage(message)
}

/**
 * Check if a task has been cancelled
 */
function isCancelled(id: string): boolean {
  return !activeTasks.has(id)
}

/**
 * Run the full analysis pipeline
 */
function runAnalysis(
  id: string,
  text: string,
  settings: AnalysisSettings,
  documentId: string
): AnalysisResult {
  // Step 1: Segment sentences (20%)
  postProgress(id, 'Segmentation des phrases...', 10)
  if (isCancelled(id)) throw new Error('Cancelled')

  const sentences: SentenceData[] = segmentSentences(text)
  postProgress(id, 'Segmentation des phrases...', 20)
  if (isCancelled(id)) throw new Error('Cancelled')

  // Step 2: Analyze sentences for length issues (40%)
  postProgress(id, 'Analyse des phrases...', 30)
  if (isCancelled(id)) throw new Error('Cancelled')

  const sentenceIssues: AnalysisIssue[] = analyzeSentences(
    sentences,
    settings.longSentenceThreshold,
    settings.veryLongSentenceThreshold
  )
  postProgress(id, 'Analyse des phrases...', 40)
  if (isCancelled(id)) throw new Error('Cancelled')

  // Step 3: Detect repetitions (60%)
  postProgress(id, 'Détection des répétitions...', 50)
  if (isCancelled(id)) throw new Error('Cancelled')

  const wordRepetitions: RepetitionData[] = detectRepetitions(
    text,
    sentences,
    0,
    settings.repetitionWindow,
    settings.minRepetitionCount,
    settings.ignoreCommonWords
  )
  const starterRepetitions: RepetitionData[] = detectRepeatedStarters(
    sentences,
    settings.minRepetitionCount
  )
  const repetitionIssues: AnalysisIssue[] = repetitionsToIssues(wordRepetitions, starterRepetitions)
  postProgress(id, 'Détection des répétitions...', 60)
  if (isCancelled(id)) throw new Error('Cancelled')

  // Step 4: Analyze word types (80%)
  postProgress(id, 'Analyse stylistique...', 70)
  if (isCancelled(id)) throw new Error('Cancelled')

  const wordTypes: WordTypeData[] = analyzeWordTypes(text)
  const wordTypeIssues: AnalysisIssue[] = wordTypesToIssues(wordTypes, true, true)
  postProgress(id, 'Analyse stylistique...', 80)
  if (isCancelled(id)) throw new Error('Cancelled')

  // Step 5: Calculate statistics (100%)
  postProgress(id, 'Calcul des statistiques...', 90)

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

  postProgress(id, 'Terminé', 100)

  return result
}

/**
 * Handle incoming messages from the main thread
 */
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data

  if (message.type === 'cancel') {
    activeTasks.delete(message.id)
    return
  }

  if (message.type === 'analyze') {
    const { id, text, settings, documentId } = message

    // Mark task as active
    activeTasks.add(id)

    try {
      const result = runAnalysis(id, text, settings, documentId)

      // Only send result if not cancelled
      if (activeTasks.has(id)) {
        const response: ResultMessage = { type: 'result', id, result }
        self.postMessage(response)
      }
    } catch (error) {
      // Only send error if not cancelled
      if (activeTasks.has(id)) {
        const response: ErrorMessage = {
          type: 'error',
          id,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        self.postMessage(response)
      }
    } finally {
      activeTasks.delete(id)
    }
  }
}

// Export types for the main thread
export type { WorkerMessage, WorkerResponse, AnalyzeMessage, CancelMessage }
