import type { DailyStats, StatsData, WritingGoal, ManuscriptMode, StreakInfo } from '@shared/types/project'
import { aggregateDailyStats } from './aggregations'
import { calculateStreak } from './calculations'

export interface AggregatedProjectStats {
  dailyStats: DailyStats[]
  totalWords: number
  totalMinutes: number
  sessionCount: number
  projectsCount: number
  streak: StatsData['streak']
}

const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined

function safeJsonParse<T>(content: string | undefined | null, fallback: T): T {
  if (!content) return fallback
  try {
    return JSON.parse(content) as T
  } catch {
    return fallback
  }
}

async function loadProjectStats(projectPath: string): Promise<StatsData | null> {
  if (!isElectron) return null

  const sessionsResult = await window.electronAPI.readFile(`${projectPath}/stats/sessions.json`)
  const goalsResult = await window.electronAPI.readFile(`${projectPath}/stats/goals.json`)
  const summaryResult = await window.electronAPI.readFile(`${projectPath}/stats/stats.json`)

  const sessions = safeJsonParse(sessionsResult.content, [])
  const defaultGoals: WritingGoal[] = [
    { type: 'daily', target: 0, current: 0 },
    { type: 'project', target: 0, current: 0 }
  ]
  const goals = safeJsonParse<WritingGoal[]>(goalsResult.content, defaultGoals)
  const summary = safeJsonParse<{
    dailyStats: DailyStats[]
    totalWords: number
    streak: StreakInfo
    manuscriptMode: ManuscriptMode
  }>(summaryResult.content, {
    dailyStats: [],
    totalWords: 0,
    streak: { current: 0, longest: 0, lastWritingDate: '' },
    manuscriptMode: 'drafting'
  })

  const manuscriptMode: ManuscriptMode = summary.manuscriptMode || 'drafting'
  const dailyGoal = goals.find((g: { type: string }) => g.type === 'daily')
  const dailyTarget = dailyGoal?.target ?? 0

  const dailyStats = (summary.dailyStats && summary.dailyStats.length > 0)
    ? summary.dailyStats
    : aggregateDailyStats(sessions, dailyTarget, manuscriptMode)

  const totalWords = typeof summary.totalWords === 'number'
    ? summary.totalWords
    : sessions.reduce((sum: number, s: { netWords: number }) => sum + s.netWords, 0)

  const streak = summary.streak?.current !== undefined
    ? summary.streak
    : calculateStreak(dailyStats)

  return {
    sessions,
    dailyStats,
    goals,
    totalWords,
    streak,
    manuscriptMode
  }
}

function mergeDailyStats(list: DailyStats[]): DailyStats[] {
  const map = new Map<string, DailyStats>()

  for (const stats of list) {
    const existing = map.get(stats.date)
    if (!existing) {
      map.set(stats.date, { ...stats, goalReached: stats.netWords > 0 })
    } else {
      map.set(stats.date, {
        date: stats.date,
        totalWordsAdded: existing.totalWordsAdded + stats.totalWordsAdded,
        totalWordsDeleted: existing.totalWordsDeleted + stats.totalWordsDeleted,
        netWords: existing.netWords + stats.netWords,
        totalMinutes: existing.totalMinutes + stats.totalMinutes,
        sessionCount: existing.sessionCount + stats.sessionCount,
        goalReached: existing.netWords + stats.netWords > 0
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Aggregate stats from multiple project paths.
 * Uses dailyStats + totalWords for cross-project overview.
 */
export async function aggregateProjectsStats(projectPaths: string[]): Promise<AggregatedProjectStats> {
  const statsList: StatsData[] = []

  for (const path of projectPaths) {
    const stats = await loadProjectStats(path)
    if (stats) statsList.push(stats)
  }

  const mergedDailyStats = mergeDailyStats(statsList.flatMap(s => s.dailyStats))
  const totalWords = statsList.reduce((sum, s) => sum + (s.totalWords || 0), 0)
  const totalMinutes = mergedDailyStats.reduce((sum, d) => sum + d.totalMinutes, 0)
  const sessionCount = mergedDailyStats.reduce((sum, d) => sum + d.sessionCount, 0)
  const streak = calculateStreak(mergedDailyStats)

  return {
    dailyStats: mergedDailyStats,
    totalWords,
    totalMinutes,
    sessionCount,
    projectsCount: statsList.length,
    streak
  }
}
