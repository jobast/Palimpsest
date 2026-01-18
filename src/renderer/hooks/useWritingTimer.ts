import { useEffect, useRef, useCallback, useState } from 'react'
import { useStatsStore, PAUSE_TIMEOUT } from '@/stores/statsStore'
import { useEditorStore } from '@/stores/editorStore'

interface UseWritingTimerReturn {
  // Timer state
  duration: number            // Current session duration in ms
  isActive: boolean           // Is a session active
  isWriting: boolean          // Is actively writing
  isPaused: boolean           // Is paused (inactive)

  // Formatted values
  formattedTime: string       // HH:MM:SS or MM:SS

  // Manual controls (usually automatic)
  startTimer: () => void
  stopTimer: () => void
}

/**
 * Hook for managing writing timer and activity detection
 *
 * Automatically:
 * - Starts timer when document is opened
 * - Detects pause after PAUSE_TIMEOUT of inactivity
 * - Resumes when writing continues
 * - Ends session when document is closed or component unmounts
 */
export function useWritingTimer(): UseWritingTimerReturn {
  const { editor } = useEditorStore()
  const {
    currentSession,
    startSession,
    pauseSession,
    endSession,
    getSessionDuration,
    isWriting,
    isPaused
  } = useStatsStore()

  const [duration, setDuration] = useState(0)
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  // Format duration to HH:MM:SS or MM:SS
  const formatDuration = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }, [])

  // Clear pause timeout
  const clearPauseTimeout = useCallback(() => {
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current)
      pauseTimeoutRef.current = null
    }
  }, [])

  // Set pause timeout
  const setPauseTimeout = useCallback(() => {
    clearPauseTimeout()
    pauseTimeoutRef.current = setTimeout(() => {
      pauseSession()
    }, PAUSE_TIMEOUT)
  }, [clearPauseTimeout, pauseSession])

  // Start timer
  const startTimer = useCallback(() => {
    if (currentSession.state !== 'idle' || !editor) return

    const wordCount = editor.storage.characterCount?.words() ?? 0
    startSession(wordCount)
    setPauseTimeout()
  }, [currentSession.state, editor, startSession, setPauseTimeout])

  // Stop timer
  const stopTimer = useCallback(() => {
    clearPauseTimeout()
    endSession()
  }, [clearPauseTimeout, endSession])

  // Handle editor content changes - only for timer/pause management
  // Word tracking is handled by WordStats extension in EditorArea
  useEffect(() => {
    if (!editor) return

    const handleUpdate = ({ editor: ed }: { editor: typeof editor }) => {
      const wordCount = ed.storage.characterCount?.words() ?? 0
      lastActivityRef.current = Date.now()

      // If session not started, start it
      if (currentSession.state === 'idle') {
        startSession(wordCount)
        setPauseTimeout()
        return
      }

      // Reset pause timeout on any activity (word tracking is done by WordStats)
      setPauseTimeout()
    }

    editor.on('update', handleUpdate)

    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, currentSession.state, startSession, setPauseTimeout])

  // Update duration display every second
  useEffect(() => {
    if (currentSession.state === 'idle') {
      setDuration(0)
      return
    }

    const updateDuration = () => {
      setDuration(getSessionDuration())
    }

    // Update immediately
    updateDuration()

    // Update every second
    durationIntervalRef.current = setInterval(updateDuration, 1000)

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }
  }, [currentSession.state, getSessionDuration])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPauseTimeout()
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
      // End session on unmount
      endSession()
    }
  }, [clearPauseTimeout, endSession])

  // Handle window/document visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page hidden, consider it a pause
        clearPauseTimeout()
        if (currentSession.state === 'writing') {
          pauseSession()
        }
      } else {
        // Page visible again
        if (currentSession.state !== 'idle') {
          setPauseTimeout()
        }
      }
    }

    const handleBeforeUnload = () => {
      // Save session before leaving
      endSession()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [currentSession.state, clearPauseTimeout, setPauseTimeout, pauseSession, endSession])

  return {
    duration,
    isActive: currentSession.state !== 'idle',
    isWriting: isWriting(),
    isPaused: isPaused(),
    formattedTime: formatDuration(duration),
    startTimer,
    stopTimer
  }
}
