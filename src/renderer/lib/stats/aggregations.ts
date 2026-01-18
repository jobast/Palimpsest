import type { DailyStats, WritingSession, ManuscriptMode } from '@shared/types/project'
import { checkGoalReached } from './calculations'

/**
 * Create an empty DailyStats object for a given date
 */
export function createEmptyDailyStats(date: string): DailyStats {
  return {
    date,
    totalWordsAdded: 0,
    totalWordsDeleted: 0,
    netWords: 0,
    totalMinutes: 0,
    sessionCount: 0,
    goalReached: false
  }
}

/**
 * Update daily stats with new activity
 * If no stats exist for the date, creates a new entry
 */
export function updateDailyStats(
  dailyStats: DailyStats[],
  date: string,
  wordsAdded: number,
  wordsDeleted: number,
  minutes: number,
  dailyTarget: number,
  mode: ManuscriptMode
): DailyStats[] {
  const existingIndex = dailyStats.findIndex(d => d.date === date)

  if (existingIndex === -1) {
    // Create new entry
    const newStats: DailyStats = {
      date,
      totalWordsAdded: wordsAdded,
      totalWordsDeleted: wordsDeleted,
      netWords: wordsAdded - wordsDeleted,
      totalMinutes: minutes,
      sessionCount: 0, // Incremented on session end
      goalReached: false
    }
    newStats.goalReached = checkGoalReached(newStats, dailyTarget, mode)
    return [...dailyStats, newStats]
  }

  // Update existing entry
  const updated = dailyStats.map((stats, index) => {
    if (index !== existingIndex) return stats

    const updatedStats: DailyStats = {
      ...stats,
      totalWordsAdded: stats.totalWordsAdded + wordsAdded,
      totalWordsDeleted: stats.totalWordsDeleted + wordsDeleted,
      netWords: stats.netWords + wordsAdded - wordsDeleted,
      totalMinutes: stats.totalMinutes + minutes
    }
    updatedStats.goalReached = checkGoalReached(updatedStats, dailyTarget, mode)
    return updatedStats
  })

  return updated
}

/**
 * Aggregate sessions into daily stats
 * Useful for rebuilding daily stats from session history
 */
export function aggregateDailyStats(
  sessions: WritingSession[],
  dailyTarget: number,
  mode: ManuscriptMode
): DailyStats[] {
  const statsMap = new Map<string, DailyStats>()

  for (const session of sessions) {
    const existing = statsMap.get(session.date) || createEmptyDailyStats(session.date)

    const updated: DailyStats = {
      date: session.date,
      totalWordsAdded: existing.totalWordsAdded + session.wordsAdded,
      totalWordsDeleted: existing.totalWordsDeleted + session.wordsDeleted,
      netWords: existing.netWords + session.netWords,
      totalMinutes: existing.totalMinutes + session.durationMinutes,
      sessionCount: existing.sessionCount + 1,
      goalReached: false
    }
    updated.goalReached = checkGoalReached(updated, dailyTarget, mode)

    statsMap.set(session.date, updated)
  }

  // Sort by date ascending
  return Array.from(statsMap.values()).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Get statistics for a date range
 */
export function getStatsForRange(
  dailyStats: DailyStats[],
  startDate: string,
  endDate: string
): {
  totalWordsAdded: number
  totalWordsDeleted: number
  netWords: number
  totalMinutes: number
  sessionCount: number
  daysWritten: number
  daysGoalReached: number
} {
  const filtered = dailyStats.filter(d => d.date >= startDate && d.date <= endDate)

  return {
    totalWordsAdded: filtered.reduce((sum, d) => sum + d.totalWordsAdded, 0),
    totalWordsDeleted: filtered.reduce((sum, d) => sum + d.totalWordsDeleted, 0),
    netWords: filtered.reduce((sum, d) => sum + d.netWords, 0),
    totalMinutes: filtered.reduce((sum, d) => sum + d.totalMinutes, 0),
    sessionCount: filtered.reduce((sum, d) => sum + d.sessionCount, 0),
    daysWritten: filtered.length,
    daysGoalReached: filtered.filter(d => d.goalReached).length
  }
}

/**
 * Get this week's statistics (Monday to Sunday)
 */
export function getWeekStats(
  dailyStats: DailyStats[],
  referenceDate: Date = new Date()
): ReturnType<typeof getStatsForRange> & { weekStart: string; weekEnd: string } {
  // Get Monday of this week
  const day = referenceDate.getDay()
  const diff = referenceDate.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(referenceDate)
  monday.setDate(diff)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const weekStart = formatDate(monday)
  const weekEnd = formatDate(sunday)

  return {
    ...getStatsForRange(dailyStats, weekStart, weekEnd),
    weekStart,
    weekEnd
  }
}

/**
 * Get this month's statistics
 */
export function getMonthStats(
  dailyStats: DailyStats[],
  year: number,
  month: number
): ReturnType<typeof getStatsForRange> & { monthStart: string; monthEnd: string } {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const monthStart = formatDate(firstDay)
  const monthEnd = formatDate(lastDay)

  return {
    ...getStatsForRange(dailyStats, monthStart, monthEnd),
    monthStart,
    monthEnd
  }
}

/**
 * Calculate average words per day (only counting days with writing)
 */
export function getAverageWordsPerDay(dailyStats: DailyStats[], mode: ManuscriptMode): number {
  if (dailyStats.length === 0) return 0

  const total = mode === 'drafting'
    ? dailyStats.reduce((sum, d) => sum + d.netWords, 0)
    : dailyStats.reduce((sum, d) => sum + d.totalWordsAdded + d.totalWordsDeleted, 0)

  return Math.round(total / dailyStats.length)
}

/**
 * Calculate average session duration in minutes
 */
export function getAverageSessionDuration(dailyStats: DailyStats[]): number {
  const totalMinutes = dailyStats.reduce((sum, d) => sum + d.totalMinutes, 0)
  const totalSessions = dailyStats.reduce((sum, d) => sum + d.sessionCount, 0)

  if (totalSessions === 0) return 0
  return Math.round(totalMinutes / totalSessions)
}

/**
 * Get best day statistics
 */
export function getBestDay(dailyStats: DailyStats[], mode: ManuscriptMode): DailyStats | null {
  if (dailyStats.length === 0) return null

  return dailyStats.reduce((best, current) => {
    const bestValue = mode === 'drafting'
      ? best.netWords
      : best.totalWordsAdded + best.totalWordsDeleted

    const currentValue = mode === 'drafting'
      ? current.netWords
      : current.totalWordsAdded + current.totalWordsDeleted

    return currentValue > bestValue ? current : best
  })
}

/**
 * Get average words per day of the week
 * Returns data suitable for a horizontal bar chart
 */
export function getWeekdayAverages(dailyStats: DailyStats[]): Array<{ day: string; dayIndex: number; avgWords: number; count: number }> {
  const WEEKDAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

  // Group by day of week
  const weekdayTotals: Record<number, { total: number; count: number }> = {}
  for (let i = 0; i < 7; i++) {
    weekdayTotals[i] = { total: 0, count: 0 }
  }

  for (const stats of dailyStats) {
    const [year, month, day] = stats.date.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const dayOfWeek = date.getDay()

    weekdayTotals[dayOfWeek].total += Math.max(0, stats.netWords)
    weekdayTotals[dayOfWeek].count++
  }

  // Convert to array, starting from Monday (index 1)
  const result: Array<{ day: string; dayIndex: number; avgWords: number; count: number }> = []
  for (let i = 1; i <= 7; i++) {
    const dayIndex = i % 7 // 1,2,3,4,5,6,0 -> Mon,Tue,Wed,Thu,Fri,Sat,Sun
    const data = weekdayTotals[dayIndex]
    result.push({
      day: WEEKDAY_LABELS[dayIndex],
      dayIndex,
      avgWords: data.count > 0 ? Math.round(data.total / data.count) : 0,
      count: data.count
    })
  }

  return result
}

/**
 * Get cumulative word progress over time
 * Returns data suitable for a line/area chart
 */
export function getCumulativeProgress(dailyStats: DailyStats[]): Array<{ date: string; cumulative: number; netWords: number }> {
  // Sort by date ascending
  const sorted = [...dailyStats].sort((a, b) => a.date.localeCompare(b.date))

  let cumulative = 0
  return sorted.map(stats => {
    cumulative += stats.netWords
    return {
      date: stats.date,
      cumulative,
      netWords: stats.netWords
    }
  })
}

/**
 * Get statistics for the last N days
 * Fills in missing days with zero values
 */
export function getLastNDaysStats(
  dailyStats: DailyStats[],
  n: number,
  referenceDate: Date = new Date()
): Array<{ date: string; netWords: number; goalReached: boolean; hasData: boolean }> {
  // Create a map for quick lookup
  const statsMap = new Map<string, DailyStats>()
  for (const stats of dailyStats) {
    statsMap.set(stats.date, stats)
  }

  const result: Array<{ date: string; netWords: number; goalReached: boolean; hasData: boolean }> = []

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(referenceDate)
    d.setDate(d.getDate() - i)
    const dateStr = formatDate(d)
    const stats = statsMap.get(dateStr)

    result.push({
      date: dateStr,
      netWords: stats ? stats.netWords : 0,
      goalReached: stats?.goalReached ?? false,
      hasData: !!stats
    })
  }

  return result
}

/**
 * Calculate projected completion date based on current pace
 */
export function getProjectedCompletion(
  dailyStats: DailyStats[],
  currentTotal: number,
  projectTarget: number,
  daysToConsider: number = 30
): { daysRemaining: number; projectedDate: string } | null {
  if (currentTotal >= projectTarget) {
    return null // Already complete
  }

  // Get stats for the last N days
  const recentStats = getLastNDaysStats(dailyStats, daysToConsider)
  const daysWithWriting = recentStats.filter(d => d.hasData)

  if (daysWithWriting.length === 0) {
    return null // No data to project from
  }

  // Calculate average daily progress
  const totalNetWords = daysWithWriting.reduce((sum, d) => sum + Math.max(0, d.netWords), 0)
  const avgPerDay = totalNetWords / daysToConsider // Use total days for realistic pace

  if (avgPerDay <= 0) {
    return null // No progress
  }

  const remaining = projectTarget - currentTotal
  const daysRemaining = Math.ceil(remaining / avgPerDay)

  const projectedDate = new Date()
  projectedDate.setDate(projectedDate.getDate() + daysRemaining)

  return {
    daysRemaining,
    projectedDate: formatDate(projectedDate)
  }
}

// Helper function to format date
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
