import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  WritingSession,
  WritingGoal,
  DailyStats,
  StreakInfo,
  ManuscriptMode,
  StatsData
} from '@shared/types/project'
import { calculateStreak, checkGoalReached, getTodayDateString } from '@/lib/stats/calculations'

// Session states
type SessionState = 'idle' | 'active' | 'writing' | 'paused'

// Chart visualization types
type ChartPeriod = '7d' | '30d' | '90d'
type ChartType = 'trend' | 'productivity' | 'cumulative'

// Pause timeout in milliseconds (60 seconds)
const PAUSE_TIMEOUT = 60_000

// Maximum days to keep session data in active memory (older data is archived)
const MAX_SESSIONS_DAYS = 90

// LocalStorage key for archived stats
const ARCHIVE_STORAGE_KEY = 'palimpseste-stats-archive'

interface CurrentSession {
  state: SessionState
  startTime: Date | null
  wordsAtStart: number
  wordsAdded: number
  wordsDeleted: number
  currentWords: number
  lastActivityTime: Date | null
  pauseAccumulator: number  // Total paused time in ms
  documentId: string | null
}

interface StatsState {
  // Persisted data
  sessions: WritingSession[]
  dailyStats: DailyStats[]
  goals: WritingGoal[]
  streak: StreakInfo
  manuscriptMode: ManuscriptMode
  totalWords: number
  statsDirty: boolean

  // Project context (not persisted)
  projectId: string | null
  archiveStorageKey: string

  // Current session (not persisted)
  currentSession: CurrentSession

  // Notification triggers (not persisted)
  pendingNotifications: Array<{
    type: 'daily_goal' | 'project_goal' | 'streak_milestone' | 'info' | 'success' | 'error'
    message: string
  }>

  // UI state for visualizations (not persisted)
  selectedDate: string | null
  chartPeriod: ChartPeriod
  chartType: ChartType
  chartsExpanded: boolean

  // Performance: O(1) lookup map for dailyStats (not persisted, rebuilt on rehydration)
  _dailyStatsMap: Map<string, number> // date → index in dailyStats array

  // Actions
  setManuscriptMode: (mode: ManuscriptMode) => void
  setProjectId: (projectId: string | null) => void
  loadStats: (stats: StatsData) => void
  exportStats: () => StatsData
  resetStats: () => void
  markStatsSaved: () => void

  // Session management
  startSession: (initialWords: number, documentId?: string) => void
  recordActivity: (currentWords: number, wordsAdded: number, wordsDeleted: number) => void
  pauseSession: () => void
  resumeSession: () => void
  endSession: () => WritingSession | null

  // Goal management
  updateGoal: (type: WritingGoal['type'], target: number, timeTarget?: number) => void
  resetDailyGoal: () => void

  // Stats
  recalculateStreak: () => void
  getTodayStats: () => DailyStats | null
  getProgress: (goalType: WritingGoal['type']) => { current: number; target: number; percentage: number }
  validateDailyState: () => void

  // Data archiving (for long-term memory optimization)
  archiveOldData: () => { archivedSessions: number; archivedDays: number }
  getArchivedStats: () => { sessions: WritingSession[]; dailyStats: DailyStats[] } | null

  // Notifications
  showNotification: (type: 'info' | 'success' | 'error', message: string) => void
  clearNotification: (index: number) => void
  clearAllNotifications: () => void

  // Session state helpers
  getSessionDuration: () => number
  isWriting: () => boolean
  isPaused: () => boolean

  // Visualization actions
  setSelectedDate: (date: string | null) => void
  setChartPeriod: (period: ChartPeriod) => void
  setChartType: (type: ChartType) => void
  toggleChartsExpanded: () => void
}

const defaultStreak: StreakInfo = {
  current: 0,
  longest: 0,
  lastWritingDate: ''
}

const defaultGoals: WritingGoal[] = [
  { type: 'daily', target: 0, current: 0 },
  { type: 'project', target: 0, current: 0 }
]

const defaultCurrentSession: CurrentSession = {
  state: 'idle',
  startTime: null,
  wordsAtStart: 0,
  wordsAdded: 0,
  wordsDeleted: 0,
  currentWords: 0,
  lastActivityTime: null,
  pauseAccumulator: 0,
  documentId: null
}

/**
 * Helper to build the dailyStats index map for O(1) lookups
 */
function buildDailyStatsMap(dailyStats: DailyStats[]): Map<string, number> {
  const map = new Map<string, number>()
  dailyStats.forEach((d, i) => map.set(d.date, i))
  return map
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      // Initial state
      sessions: [],
      dailyStats: [],
      goals: defaultGoals,
      streak: defaultStreak,
      manuscriptMode: 'drafting',
      totalWords: 0,
      statsDirty: false,
      projectId: null,
      archiveStorageKey: ARCHIVE_STORAGE_KEY,
      currentSession: { ...defaultCurrentSession },
      pendingNotifications: [],
      selectedDate: null,
      chartPeriod: '7d',
      chartType: 'trend',
      chartsExpanded: false,
      _dailyStatsMap: new Map(),

      setManuscriptMode: (mode) => {
        set({ manuscriptMode: mode, statsDirty: true })
        // Recalculate daily goal reached status based on new mode
        const state = get()
        const today = getTodayDateString()
        // O(1) lookup using map
        const todayIndex = state._dailyStatsMap.get(today)
        if (todayIndex !== undefined) {
          const todayStats = state.dailyStats[todayIndex]
          const dailyGoal = state.goals.find(g => g.type === 'daily')
          if (dailyGoal) {
            const goalReached = checkGoalReached(todayStats, dailyGoal.target, mode)
            if (goalReached !== todayStats.goalReached) {
              const updatedDailyStats = [...state.dailyStats]
              updatedDailyStats[todayIndex] = { ...todayStats, goalReached }
              set({ dailyStats: updatedDailyStats, statsDirty: true })
            }
          }
        }
      },

      setProjectId: (projectId) => {
        const archiveStorageKey = projectId
          ? `${ARCHIVE_STORAGE_KEY}:${projectId}`
          : ARCHIVE_STORAGE_KEY
        set({ projectId, archiveStorageKey })
      },

      loadStats: (stats) => {
        const dailyStats = stats.dailyStats || []
        set({
          sessions: stats.sessions || [],
          dailyStats,
          goals: stats.goals || defaultGoals,
          streak: stats.streak || defaultStreak,
          manuscriptMode: stats.manuscriptMode || 'drafting',
          totalWords: stats.totalWords || 0,
          statsDirty: false,
          currentSession: { ...defaultCurrentSession },
          pendingNotifications: [],
          _dailyStatsMap: buildDailyStatsMap(dailyStats)
        })
      },

      exportStats: () => {
        const { sessions, dailyStats, goals, streak, manuscriptMode, totalWords } = get()
        return { sessions, dailyStats, goals, streak, manuscriptMode, totalWords }
      },

      resetStats: () => {
        set({
          sessions: [],
          dailyStats: [],
          goals: defaultGoals,
          streak: defaultStreak,
          manuscriptMode: 'drafting',
          totalWords: 0,
          statsDirty: false,
          currentSession: { ...defaultCurrentSession },
          pendingNotifications: [],
          _dailyStatsMap: new Map()
        })
      },

      markStatsSaved: () => set({ statsDirty: false }),

      startSession: (initialWords, documentId) => {
        const now = new Date()
        set({
          currentSession: {
            state: 'active',
            startTime: now,
            wordsAtStart: initialWords,
            wordsAdded: 0,
            wordsDeleted: 0,
            currentWords: initialWords,
            lastActivityTime: now,
            pauseAccumulator: 0,
            documentId: documentId ?? null
          }
        })
      },

      recordActivity: (currentWords, wordsAdded, wordsDeleted) => {
        const state = get()
        const { currentSession, goals, manuscriptMode, dailyStats, streak, _dailyStatsMap } = state
        const now = new Date()

        // Update session stats
        const newWordsAdded = currentSession.wordsAdded + wordsAdded
        const newWordsDeleted = currentSession.wordsDeleted + wordsDeleted

        // Calculate pause time if resuming from pause
        let pauseAccumulator = currentSession.pauseAccumulator
        if (currentSession.state === 'paused' && currentSession.lastActivityTime) {
          pauseAccumulator += now.getTime() - currentSession.lastActivityTime.getTime()
        }

        set({
          currentSession: {
            ...currentSession,
            state: 'writing',
            wordsAdded: newWordsAdded,
            wordsDeleted: newWordsDeleted,
            currentWords: currentWords,
            lastActivityTime: now,
            pauseAccumulator
          }
        })

        // Update today's stats with O(1) lookup
        const today = getTodayDateString()
        const dailyGoal = goals.find(g => g.type === 'daily')
        const dailyTarget = dailyGoal?.target ?? 500

        // O(1) lookup for today's stats
        const todayIndex = _dailyStatsMap.get(today)
        let updatedDailyStats: DailyStats[]
        let updatedMap = _dailyStatsMap
        let previousGoalReached = false

        if (todayIndex === undefined) {
          // Create new entry for today
          const newStats: DailyStats = {
            date: today,
            totalWordsAdded: wordsAdded,
            totalWordsDeleted: wordsDeleted,
            netWords: wordsAdded - wordsDeleted,
            totalMinutes: 0, // Incremented on session end
            sessionCount: 0,
            goalReached: false
          }
          newStats.goalReached = checkGoalReached(newStats, dailyTarget, manuscriptMode)
          updatedDailyStats = [...dailyStats, newStats]

          // Update map with new index
          updatedMap = new Map(_dailyStatsMap)
          updatedMap.set(today, updatedDailyStats.length - 1)
        } else {
          // O(1) direct access to update existing entry
          const existing = dailyStats[todayIndex]
          previousGoalReached = existing.goalReached

          const updatedStats: DailyStats = {
            ...existing,
            totalWordsAdded: existing.totalWordsAdded + wordsAdded,
            totalWordsDeleted: existing.totalWordsDeleted + wordsDeleted,
            netWords: existing.netWords + wordsAdded - wordsDeleted
          }
          updatedStats.goalReached = checkGoalReached(updatedStats, dailyTarget, manuscriptMode)

          // Update array in place (create new array for immutability)
          updatedDailyStats = [...dailyStats]
          updatedDailyStats[todayIndex] = updatedStats
        }

        // Check if daily goal just reached
        const todayStats = updatedDailyStats[updatedMap.get(today)!]
        const justReachedGoal = todayStats.goalReached && !previousGoalReached

        // Update project goal current value only
        // Daily goal current is calculated dynamically in getProgress() from dailyStats
        const updatedGoals = goals.map(goal => {
          if (goal.type === 'project') {
            return { ...goal, current: state.totalWords + (currentWords - currentSession.wordsAtStart) }
          }
          return goal
        })

        const notifications = [...state.pendingNotifications]

        if (justReachedGoal) {
          notifications.push({
            type: 'daily_goal',
            message: 'Objectif quotidien atteint !'
          })

          // Recalculate streak
          const newStreak = calculateStreak(updatedDailyStats)
          const streakMilestones = [7, 30, 100, 365]
          if (newStreak.current > streak.current && streakMilestones.includes(newStreak.current)) {
            notifications.push({
              type: 'streak_milestone',
              message: `Série de ${newStreak.current} jours !`
            })
          }

          set({
            dailyStats: updatedDailyStats,
            _dailyStatsMap: updatedMap,
            goals: updatedGoals,
            streak: newStreak,
            pendingNotifications: notifications,
            statsDirty: true
          })
        } else {
          set({
            dailyStats: updatedDailyStats,
            _dailyStatsMap: updatedMap,
            goals: updatedGoals,
            pendingNotifications: notifications,
            statsDirty: true
          })
        }
      },

      pauseSession: () => {
        const { currentSession } = get()
        if (currentSession.state === 'writing') {
          set({
            currentSession: {
              ...currentSession,
              state: 'paused'
            }
          })
        }
      },

      resumeSession: () => {
        const { currentSession } = get()
        if (currentSession.state === 'paused') {
          const now = new Date()
          const pauseTime = currentSession.lastActivityTime
            ? now.getTime() - currentSession.lastActivityTime.getTime()
            : 0

          set({
            currentSession: {
              ...currentSession,
              state: 'writing',
              lastActivityTime: now,
              pauseAccumulator: currentSession.pauseAccumulator + pauseTime
            }
          })
        }
      },

      endSession: () => {
        const state = get()
        const { currentSession, sessions, dailyStats, goals, _dailyStatsMap } = state

        if (currentSession.state === 'idle' || !currentSession.startTime) {
          return null
        }

        const now = new Date()
        const totalDuration = now.getTime() - currentSession.startTime.getTime()
        const activeDuration = totalDuration - currentSession.pauseAccumulator
        const durationMinutes = Math.max(1, Math.round(activeDuration / 60000))

        const session: WritingSession = {
          id: crypto.randomUUID(),
          date: getTodayDateString(),
          startTime: currentSession.startTime.toISOString(),
          endTime: now.toISOString(),
          wordsAdded: currentSession.wordsAdded,
          wordsDeleted: currentSession.wordsDeleted,
          netWords: currentSession.wordsAdded - currentSession.wordsDeleted,
          durationMinutes
        }

        // Update daily stats with duration - O(1) lookup
        const today = getTodayDateString()
        const todayIndex = _dailyStatsMap.get(today)
        let updatedDailyStats: DailyStats[]

        if (todayIndex !== undefined) {
          const todayStats = dailyStats[todayIndex]
          updatedDailyStats = [...dailyStats]
          updatedDailyStats[todayIndex] = {
            ...todayStats,
            totalMinutes: todayStats.totalMinutes + durationMinutes,
            sessionCount: todayStats.sessionCount + 1
          }
        } else {
          // Edge case: no dailyStats for today (shouldn't happen normally)
          updatedDailyStats = dailyStats
        }

        // Update total words
        const newTotalWords = state.totalWords + session.netWords

        // Check if project goal reached
        const projectGoal = goals.find(g => g.type === 'project')
        const notifications = [...state.pendingNotifications]

        if (projectGoal && newTotalWords >= projectGoal.target && state.totalWords < projectGoal.target) {
          notifications.push({
            type: 'project_goal',
            message: 'Objectif du projet atteint !'
          })
        }

        // Recalculate streak
        const newStreak = calculateStreak(updatedDailyStats)

        set({
          sessions: [...sessions, session],
          dailyStats: updatedDailyStats,
          totalWords: newTotalWords,
          streak: newStreak,
          currentSession: { ...defaultCurrentSession },
          pendingNotifications: notifications,
          statsDirty: true,
          goals: goals.map(g => {
            if (g.type === 'project') {
              return { ...g, current: newTotalWords }
            }
            return g
          })
        })

        return session
      },

      updateGoal: (type, target, timeTarget) => {
        const { goals, dailyStats, manuscriptMode } = get()
        const updatedGoals = goals.map(g => {
          if (g.type === type) {
            const updated = { ...g, target }
            // Only add timeTarget for daily goals
            if (type === 'daily' && timeTarget !== undefined) {
              updated.timeTarget = timeTarget
            }
            return updated
          }
          return g
        })
        set({ goals: updatedGoals, statsDirty: true })

        // Recalculate daily stats goalReached if daily goal changed
        if (type === 'daily') {
          const updatedDailyStats = dailyStats.map(d => ({
            ...d,
            goalReached: checkGoalReached(d, target, manuscriptMode)
          }))
          set({ dailyStats: updatedDailyStats, statsDirty: true })

          // Recalculate streak with new goal threshold
          const newStreak = calculateStreak(updatedDailyStats)
          set({ streak: newStreak, statsDirty: true })
      }
      },

      resetDailyGoal: () => {
        const { goals } = get()
        set({
          goals: goals.map(g =>
            g.type === 'daily' ? { ...g, current: 0 } : g
          ),
          statsDirty: true
        })
      },

      recalculateStreak: () => {
        const { dailyStats } = get()
        const newStreak = calculateStreak(dailyStats)
        set({ streak: newStreak, statsDirty: true })
      },

      getTodayStats: () => {
        const { dailyStats, _dailyStatsMap } = get()
        const today = getTodayDateString()
        // O(1) lookup
        const index = _dailyStatsMap.get(today)
        return index !== undefined ? dailyStats[index] : null
      },

      getProgress: (goalType) => {
        const { goals, dailyStats, manuscriptMode, _dailyStatsMap } = get()
        const goal = goals.find(g => g.type === goalType)
        if (!goal) {
          return { current: 0, target: 0, percentage: 0 }
        }

        let current: number
        if (goalType === 'daily') {
          // Calculate daily current dynamically from today's stats
          // This ensures the counter resets naturally at midnight
          const today = getTodayDateString()
          // O(1) lookup
          const index = _dailyStatsMap.get(today)
          const todayStats = index !== undefined ? dailyStats[index] : null
          if (todayStats) {
            current = manuscriptMode === 'drafting'
              ? Math.max(0, todayStats.netWords)
              : todayStats.totalWordsAdded + todayStats.totalWordsDeleted
          } else {
            current = 0
          }
        } else {
          // For project goals, use the persisted current value
          current = goal.current
        }

        const percentage = goal.target > 0 ? Math.min(100, (current / goal.target) * 100) : 0
        return {
          current,
          target: goal.target,
          percentage
        }
      },

      validateDailyState: () => {
        // Called on app startup to ensure consistent state
        // Recalculates streak in case midnight has passed since last session
        const { dailyStats, streak } = get()
        const newStreak = calculateStreak(dailyStats)

        // Only update if streak has changed
        if (newStreak.current !== streak.current || newStreak.longest !== streak.longest) {
          set({ streak: newStreak, statsDirty: true })
        }
      },

      // Archive old session data to reduce memory usage
      // Keeps last MAX_SESSIONS_DAYS (90 days) in active memory
      archiveOldData: () => {
        const { sessions, dailyStats, archiveStorageKey } = get()

        // Calculate cutoff date
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - MAX_SESSIONS_DAYS)
        const cutoffStr = cutoffDate.toISOString().split('T')[0] // YYYY-MM-DD

        // Separate recent and old data
        const recentSessions = sessions.filter(s => s.date >= cutoffStr)
        const oldSessions = sessions.filter(s => s.date < cutoffStr)

        const recentDailyStats = dailyStats.filter(d => d.date >= cutoffStr)
        const oldDailyStats = dailyStats.filter(d => d.date < cutoffStr)

        // Nothing to archive
        if (oldSessions.length === 0 && oldDailyStats.length === 0) {
          return { archivedSessions: 0, archivedDays: 0 }
        }

        // Load existing archive
        const existingArchive = get().getArchivedStats() || { sessions: [], dailyStats: [] }

        // Merge with existing archive (avoiding duplicates)
        const existingSessionIds = new Set(existingArchive.sessions.map(s => s.id))
        const newArchivedSessions = oldSessions.filter(s => !existingSessionIds.has(s.id))
        const mergedSessions = [...existingArchive.sessions, ...newArchivedSessions]

        const existingDates = new Set(existingArchive.dailyStats.map(d => d.date))
        const newArchivedDays = oldDailyStats.filter(d => !existingDates.has(d.date))
        const mergedDailyStats = [...existingArchive.dailyStats, ...newArchivedDays]

        // Save archive to localStorage
        try {
          const archive = { sessions: mergedSessions, dailyStats: mergedDailyStats }
          localStorage.setItem(archiveStorageKey, JSON.stringify(archive))
        } catch (error) {
          console.error('Failed to archive stats:', error)
          // Don't update state if archive failed
          return { archivedSessions: 0, archivedDays: 0 }
        }

        // Update state with only recent data
        const newMap = buildDailyStatsMap(recentDailyStats)
        set({
          sessions: recentSessions,
          dailyStats: recentDailyStats,
          _dailyStatsMap: newMap,
          statsDirty: true
        })

        return {
          archivedSessions: oldSessions.length,
          archivedDays: oldDailyStats.length
        }
      },

      // Retrieve archived stats (for historical analysis)
      getArchivedStats: () => {
        const { archiveStorageKey } = get()
        try {
          const archived = localStorage.getItem(archiveStorageKey)
          if (!archived) return null
          return JSON.parse(archived) as { sessions: WritingSession[]; dailyStats: DailyStats[] }
        } catch (error) {
          console.error('Failed to read archived stats:', error)
          return null
        }
      },

      showNotification: (type, message) => {
        const { pendingNotifications } = get()
        set({
          pendingNotifications: [...pendingNotifications, { type, message }]
        })
      },

      clearNotification: (index) => {
        const { pendingNotifications } = get()
        set({
          pendingNotifications: pendingNotifications.filter((_, i) => i !== index)
        })
      },

      clearAllNotifications: () => {
        set({ pendingNotifications: [] })
      },

      getSessionDuration: () => {
        const { currentSession } = get()
        if (!currentSession.startTime) return 0

        const now = Date.now()
        const totalDuration = now - currentSession.startTime.getTime()
        const activeDuration = totalDuration - currentSession.pauseAccumulator

        // If paused, don't count time since last activity
        if (currentSession.state === 'paused' && currentSession.lastActivityTime) {
          const pausedTime = now - currentSession.lastActivityTime.getTime()
          return Math.max(0, activeDuration - pausedTime)
        }

        return Math.max(0, activeDuration)
      },

      isWriting: () => get().currentSession.state === 'writing',

      isPaused: () => get().currentSession.state === 'paused',

      // Visualization actions
      setSelectedDate: (date) => set({ selectedDate: date }),

      setChartPeriod: (period) => set({ chartPeriod: period }),

      setChartType: (type) => set({ chartType: type }),

      toggleChartsExpanded: () => set((state) => ({ chartsExpanded: !state.chartsExpanded }))
    }),
    {
      name: 'palimpseste-stats',
      partialize: (state) => ({
        sessions: state.sessions,
        dailyStats: state.dailyStats,
        goals: state.goals,
        streak: state.streak,
        manuscriptMode: state.manuscriptMode,
        totalWords: state.totalWords
      }),
      onRehydrateStorage: () => (state) => {
        // Called when store rehydrates from localStorage
        if (state) {
          // Rebuild the O(1) lookup map from persisted dailyStats
          state._dailyStatsMap = buildDailyStatsMap(state.dailyStats)
          // Validate daily state to ensure streak is recalculated if midnight passed
          state.validateDailyState()

          // Auto-archive old data on startup if there's significant historical data
          // This keeps memory usage low for long-term users
          const oldDataCount = state.sessions.filter(s => {
            const cutoffDate = new Date()
            cutoffDate.setDate(cutoffDate.getDate() - MAX_SESSIONS_DAYS)
            return s.date < cutoffDate.toISOString().split('T')[0]
          }).length

          if (oldDataCount > 100) {
            // Defer archiving to not block startup
            setTimeout(() => {
              state.archiveOldData()
            }, 5000)
          }
        }
      }
    }
  )
)

// Export pause timeout for use in timer hook
export { PAUSE_TIMEOUT }

// Export types for visualization components
export type { ChartPeriod, ChartType }
