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
 * Format duration to HH:MM:SS or MM:SS
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Controller hook for writing session lifecycle.
 * Must be mounted once (EditorArea).
 */
export function useWritingTimerController(): void {
  const { editor } = useEditorStore()
  const {
    currentSession,
    startSession,
    pauseSession,
    endSession
  } = useStatsStore()

  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPauseTimeout = useCallback(() => {
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current)
      pauseTimeoutRef.current = null
    }
  }, [])

  const setPauseTimeout = useCallback(() => {
    clearPauseTimeout()
    pauseTimeoutRef.current = setTimeout(() => {
      pauseSession()
    }, PAUSE_TIMEOUT)
  }, [clearPauseTimeout, pauseSession])

  // Handle editor content changes for session state/pause tracking
  useEffect(() => {
    if (!editor) return

    const handleUpdate = ({ editor: ed }: { editor: typeof editor }) => {
      const wordCount = ed.storage.characterCount?.words() ?? 0

      // Start a session on first activity
      if (currentSession.state === 'idle') {
        startSession(wordCount)
        setPauseTimeout()
        return
      }

      // Any activity resets pause detection timeout
      setPauseTimeout()
    }

    editor.on('update', handleUpdate)

    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, currentSession.state, startSession, setPauseTimeout])

  // Handle app visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearPauseTimeout()
        if (currentSession.state === 'writing') {
          pauseSession()
        }
      } else if (currentSession.state !== 'idle') {
        setPauseTimeout()
      }
    }

    const handleBeforeUnload = () => {
      endSession()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [currentSession.state, clearPauseTimeout, setPauseTimeout, pauseSession, endSession])

  // Final cleanup when editor area unmounts
  useEffect(() => {
    return () => {
      clearPauseTimeout()
      endSession()
    }
  }, [clearPauseTimeout, endSession])
}

/**
 * Display hook for UI components.
 * Read-only timer state without lifecycle side effects.
 */
export function useWritingTimer(): UseWritingTimerReturn {
  const { editor } = useEditorStore()
  const {
    currentSession,
    getSessionDuration,
    isWriting,
    isPaused,
    startSession,
    endSession
  } = useStatsStore()

  const [duration, setDuration] = useState(0)
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (currentSession.state === 'idle') {
      setDuration(0)
      return
    }

    const updateDuration = () => {
      setDuration(getSessionDuration())
    }

    updateDuration()
    durationIntervalRef.current = setInterval(updateDuration, 1000)

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }
  }, [currentSession.state, getSessionDuration])

  const startTimer = useCallback(() => {
    if (currentSession.state !== 'idle' || !editor) return
    const wordCount = editor.storage.characterCount?.words() ?? 0
    startSession(wordCount)
  }, [currentSession.state, editor, startSession])

  const stopTimer = useCallback(() => {
    endSession()
  }, [endSession])

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
