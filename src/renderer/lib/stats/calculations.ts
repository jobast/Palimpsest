import type { DailyStats, StreakInfo, ManuscriptMode } from '@shared/types/project'

/**
 * Get today's date as YYYY-MM-DD string
 */
export function getTodayDateString(): string {
  const now = new Date()
  return formatDateString(now)
}

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse a YYYY-MM-DD string to a Date object
 */
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Get the difference in days between two dates
 */
export function daysDifference(date1: string, date2: string): number {
  const d1 = parseDateString(date1)
  const d2 = parseDateString(date2)
  const diffTime = Math.abs(d2.getTime() - d1.getTime())
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Check if a daily stats entry meets the goal based on manuscript mode
 *
 * - Drafting mode: net words (added - deleted) >= target
 * - Editing mode: total changes (added + deleted) >= target
 */
export function checkGoalReached(
  stats: DailyStats,
  target: number,
  mode: ManuscriptMode
): boolean {
  if (target <= 0) return true

  if (mode === 'drafting') {
    return stats.netWords >= target
  } else {
    // Editing mode: count all changes
    return (stats.totalWordsAdded + stats.totalWordsDeleted) >= target
  }
}

/**
 * Calculate streak information from daily stats
 *
 * A streak is counted as consecutive days where goalReached is true.
 * The streak breaks if there's a day without writing or where the goal wasn't reached.
 */
export function calculateStreak(dailyStats: DailyStats[]): StreakInfo {
  if (dailyStats.length === 0) {
    return {
      current: 0,
      longest: 0,
      lastWritingDate: ''
    }
  }

  // Sort by date descending (most recent first)
  const sorted = [...dailyStats].sort((a, b) => b.date.localeCompare(a.date))

  const today = getTodayDateString()
  const yesterday = formatDateString(new Date(Date.now() - 24 * 60 * 60 * 1000))

  // Find the most recent writing day
  const lastWritingDay = sorted[0]
  const lastWritingDate = lastWritingDay?.date ?? ''

  // If last writing wasn't today or yesterday, current streak is 0
  if (lastWritingDate !== today && lastWritingDate !== yesterday) {
    // Calculate longest streak from history
    const longest = calculateLongestStreak(sorted)
    return {
      current: 0,
      longest,
      lastWritingDate
    }
  }

  // Count current streak - consecutive days with goal reached
  let currentStreak = 0
  let expectedDate = lastWritingDate === today ? today : yesterday

  for (const stats of sorted) {
    if (stats.date !== expectedDate) {
      // Gap in dates, streak ends
      break
    }

    if (!stats.goalReached) {
      // Goal not reached, streak ends (but we counted writing days)
      break
    }

    currentStreak++

    // Calculate previous day
    const prevDate = new Date(parseDateString(expectedDate))
    prevDate.setDate(prevDate.getDate() - 1)
    expectedDate = formatDateString(prevDate)
  }

  // Calculate longest streak from history
  const longest = calculateLongestStreak(sorted)

  return {
    current: currentStreak,
    longest: Math.max(longest, currentStreak),
    lastWritingDate
  }
}

/**
 * Calculate the longest streak from sorted daily stats
 */
function calculateLongestStreak(sortedStats: DailyStats[]): number {
  if (sortedStats.length === 0) return 0

  // Sort by date ascending for easier processing
  const ascending = [...sortedStats].sort((a, b) => a.date.localeCompare(b.date))

  let longestStreak = 0
  let currentStreak = 0
  let lastDate: string | null = null

  for (const stats of ascending) {
    if (!stats.goalReached) {
      // Goal not reached, reset current streak
      longestStreak = Math.max(longestStreak, currentStreak)
      currentStreak = 0
      lastDate = stats.date
      continue
    }

    if (lastDate === null) {
      // First day with goal reached
      currentStreak = 1
      lastDate = stats.date
      continue
    }

    // Check if this day is consecutive to the last
    const lastDateObj = parseDateString(lastDate)
    const expectedNext = new Date(lastDateObj)
    expectedNext.setDate(expectedNext.getDate() + 1)
    const expectedNextStr = formatDateString(expectedNext)

    if (stats.date === expectedNextStr) {
      // Consecutive day
      currentStreak++
    } else {
      // Gap in dates, start new streak
      longestStreak = Math.max(longestStreak, currentStreak)
      currentStreak = 1
    }

    lastDate = stats.date
  }

  return Math.max(longestStreak, currentStreak)
}

/**
 * Get progress percentage for a goal
 */
export function getProgressPercentage(current: number, target: number): number {
  if (target <= 0) return 100
  return Math.min(100, Math.round((current / target) * 100))
}

/**
 * Format duration in minutes to a human-readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}min`
  }

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (mins === 0) {
    return `${hours}h`
  }

  return `${hours}h ${mins}min`
}

/**
 * Format milliseconds to mm:ss or hh:mm:ss
 */
export function formatTime(ms: number): string {
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
 * Get the start of the week (Monday) for a given date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get all dates in a month as YYYY-MM-DD strings
 */
export function getMonthDates(year: number, month: number): string[] {
  const dates: string[] = []
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    dates.push(formatDateString(new Date(d)))
  }

  return dates
}

/**
 * Get calendar grid for a month (includes padding days from prev/next month)
 */
export function getCalendarGrid(year: number, month: number): string[][] {
  const weeks: string[][] = []
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Start from Monday of the first week
  let current = getWeekStart(firstDay)

  while (current <= lastDay || current.getDay() !== 1) {
    const week: string[] = []
    for (let i = 0; i < 7; i++) {
      week.push(formatDateString(current))
      current.setDate(current.getDate() + 1)
    }
    weeks.push(week)

    // Stop if we've completed a full week after the last day
    if (current > lastDay && current.getDay() === 1) {
      break
    }
  }

  return weeks
}
