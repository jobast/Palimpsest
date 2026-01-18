import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  WritingSession,
  WritingGoal,
  DailyStats,
  StreakInfo,
  ManuscriptMode
} from '@shared/types/project'
import { calculateStreak, checkGoalReached, getTodayDateString } from '@/lib/stats/calculations'
import { updateDailyStats } from '@/lib/stats/aggregations'

// Session states
type SessionState = 'idle' | 'active' | 'writing' | 'paused'

// Chart visualization types
type ChartPeriod = '7d' | '30d' | '90d'
type ChartType = 'trend' | 'productivity' | 'cumulative'

// Pause timeout in milliseconds (60 seconds)
const PAUSE_TIMEOUT = 60_000

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

  // Current session (not persisted)
  currentSession: CurrentSession

  // Notification triggers (not persisted)
  pendingNotifications: Array<{
    type: 'daily_goal' | 'project_goal' | 'streak_milestone'
    message: string
  }>

  // UI state for visualizations (not persisted)
  selectedDate: string | null
  chartPeriod: ChartPeriod
  chartType: ChartType
  chartsExpanded: boolean

  // Actions
  setManuscriptMode: (mode: ManuscriptMode) => void

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

  // Notifications
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
      currentSession: { ...defaultCurrentSession },
      pendingNotifications: [],
      selectedDate: null,
      chartPeriod: '7d',
      chartType: 'trend',
      chartsExpanded: false,

      setManuscriptMode: (mode) => {
        set({ manuscriptMode: mode })
        // Recalculate daily goal reached status based on new mode
        const state = get()
        const today = getTodayDateString()
        const todayStats = state.dailyStats.find(d => d.date === today)
        if (todayStats) {
          const dailyGoal = state.goals.find(g => g.type === 'daily')
          if (dailyGoal) {
            const goalReached = checkGoalReached(todayStats, dailyGoal.target, mode)
            if (goalReached !== todayStats.goalReached) {
              set({
                dailyStats: state.dailyStats.map(d =>
                  d.date === today ? { ...d, goalReached } : d
                )
              })
            }
          }
        }
      },

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
        const { currentSession, goals, manuscriptMode, dailyStats, streak } = state
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

        // Update today's stats
        const today = getTodayDateString()
        const dailyGoal = goals.find(g => g.type === 'daily')
        const updatedDailyStats = updateDailyStats(
          dailyStats,
          today,
          wordsAdded,
          wordsDeleted,
          0, // duration updated on session end
          dailyGoal?.target ?? 500,
          manuscriptMode
        )

        // Check if daily goal just reached
        const todayStats = updatedDailyStats.find(d => d.date === today)
        const previousTodayStats = dailyStats.find(d => d.date === today)
        const justReachedGoal = todayStats?.goalReached && !previousTodayStats?.goalReached

        // Update goals current values
        const updatedGoals = goals.map(goal => {
          if (goal.type === 'daily' && todayStats) {
            const current = manuscriptMode === 'drafting'
              ? todayStats.netWords
              : todayStats.totalWordsAdded + todayStats.totalWordsDeleted
            return { ...goal, current: Math.max(0, current) }
          }
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
            goals: updatedGoals,
            streak: newStreak,
            pendingNotifications: notifications
          })
        } else {
          set({
            dailyStats: updatedDailyStats,
            goals: updatedGoals,
            pendingNotifications: notifications
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
        const { currentSession, sessions, dailyStats, goals } = state

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

        // Update daily stats with duration
        const today = getTodayDateString()
        const updatedDailyStats = dailyStats.map(d => {
          if (d.date === today) {
            return {
              ...d,
              totalMinutes: d.totalMinutes + durationMinutes,
              sessionCount: d.sessionCount + 1
            }
          }
          return d
        })

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
        set({ goals: updatedGoals })

        // Recalculate daily stats goalReached if daily goal changed
        if (type === 'daily') {
          const updatedDailyStats = dailyStats.map(d => ({
            ...d,
            goalReached: checkGoalReached(d, target, manuscriptMode)
          }))
          set({ dailyStats: updatedDailyStats })

          // Recalculate streak with new goal threshold
          const newStreak = calculateStreak(updatedDailyStats)
          set({ streak: newStreak })
        }
      },

      resetDailyGoal: () => {
        const { goals } = get()
        set({
          goals: goals.map(g =>
            g.type === 'daily' ? { ...g, current: 0 } : g
          )
        })
      },

      recalculateStreak: () => {
        const { dailyStats } = get()
        const newStreak = calculateStreak(dailyStats)
        set({ streak: newStreak })
      },

      getTodayStats: () => {
        const { dailyStats } = get()
        const today = getTodayDateString()
        return dailyStats.find(d => d.date === today) ?? null
      },

      getProgress: (goalType) => {
        const { goals } = get()
        const goal = goals.find(g => g.type === goalType)
        if (!goal) {
          return { current: 0, target: 0, percentage: 0 }
        }
        const percentage = goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0
        return {
          current: goal.current,
          target: goal.target,
          percentage
        }
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
      })
    }
  )
)

// Export pause timeout for use in timer hook
export { PAUSE_TIMEOUT }

// Export types for visualization components
export type { ChartPeriod, ChartType }
