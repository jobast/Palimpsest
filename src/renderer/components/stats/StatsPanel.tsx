import { useState } from 'react'
import { Settings, Target } from 'lucide-react'
import { useStatsStore } from '@/stores/statsStore'
import { CircularProgress } from './CircularProgress'
import { StreakDisplay } from './StreakDisplay'
import { ManuscriptModeToggle } from './ManuscriptModeToggle'
import { SessionStats } from './WritingTimer'
import { CalendarHeatmap } from './CalendarHeatmap'
import { DayDetailPanel } from './DayDetailPanel'
import { TrendsSection } from './TrendsSection'
import { GoalEditor } from './GoalEditor'
import { formatDuration } from '@/lib/stats/calculations'
import { cn } from '@/lib/utils'

/**
 * StatsPanel Component
 *
 * Complete statistics panel for the sidebar showing:
 * - Current session timer
 * - Daily goal progress
 * - Project goal progress
 * - Streak information
 * - Calendar heatmap
 * - Manuscript mode toggle
 */
export function StatsPanel() {
  const {
    streak,
    manuscriptMode,
    dailyStats,
    totalWords,
    goals,
    selectedDate,
    setSelectedDate,
    getTodayStats,
    getProgress,
    setManuscriptMode
  } = useStatsStore()

  const [showGoalEditor, setShowGoalEditor] = useState(false)
  const [progressView, setProgressView] = useState<'daily' | 'project'>('daily')

  const dailyProgress = getProgress('daily')
  const projectProgress = getProgress('project')
  const todayStats = getTodayStats()
  const dailyGoal = goals.find(g => g.type === 'daily')?.target ?? 500
  const selectedDayStats = selectedDate ? dailyStats.find(d => d.date === selectedDate) ?? null : null

  return (
    <div className="p-4 space-y-6 overflow-auto">
      {/* Progress Circle with Toggle */}
      <section>
        {/* Toggle tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden mb-4">
          <button
            onClick={() => setProgressView('daily')}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium transition-colors',
              progressView === 'daily'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card hover:bg-accent text-muted-foreground'
            )}
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setProgressView('project')}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium transition-colors border-l border-border',
              progressView === 'project'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card hover:bg-accent text-muted-foreground'
            )}
          >
            Projet
          </button>
        </div>

        {/* Single progress circle */}
        <div className="flex flex-col items-center">
          <CircularProgress
            current={progressView === 'daily' ? dailyProgress.current : totalWords}
            target={progressView === 'daily' ? dailyProgress.target : projectProgress.target}
            size="xl"
            label="mots"
          />

          {/* Stats below circle */}
          <div className="mt-3 text-center">
            <div className="text-sm font-medium">
              {progressView === 'daily' ? dailyProgress.current.toLocaleString() : totalWords.toLocaleString()}
              <span className="text-muted-foreground font-normal">
                {' '}/ {progressView === 'daily' ? dailyProgress.target.toLocaleString() : projectProgress.target.toLocaleString()}
              </span>
            </div>
            {progressView === 'daily' && todayStats && (
              <div className="text-xs text-muted-foreground mt-1">
                +{todayStats.totalWordsAdded} / -{todayStats.totalWordsDeleted}
                {todayStats.totalMinutes > 0 && (
                  <span> · {formatDuration(todayStats.totalMinutes)}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Session Timer */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Session
        </h3>
        <SessionStats />
      </section>

      {/* Streak */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Série d'écriture
        </h3>
        <StreakDisplay streak={streak} showLongest size="md" />
      </section>

      {/* Calendar */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Calendrier
        </h3>
        <CalendarHeatmap
          dailyStats={dailyStats}
          selectedDate={selectedDate}
          onDateClick={(date) => {
            // Toggle selection: click same date to deselect
            setSelectedDate(selectedDate === date ? null : date)
          }}
        />

        {/* Day Detail Panel - shows when a date is selected */}
        {selectedDate && (
          <DayDetailPanel
            date={selectedDate}
            stats={selectedDayStats}
            dailyGoal={dailyGoal}
            onClose={() => setSelectedDate(null)}
          />
        )}
      </section>

      {/* Trends Section - Collapsible charts */}
      <TrendsSection />

      {/* Summary Stats */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Statistiques globales
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <StatItem
            label="Total mots"
            value={totalWords.toLocaleString()}
          />
          <StatItem
            label="Jours d'écriture"
            value={dailyStats.length.toString()}
          />
          <StatItem
            label="Meilleure série"
            value={`${streak.longest} jours`}
          />
          <StatItem
            label="Sessions"
            value={dailyStats.reduce((sum, d) => sum + d.sessionCount, 0).toString()}
          />
        </div>
      </section>

      {/* Paramètres */}
      <section className="pt-4 border-t border-border">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Settings size={12} />
          Paramètres
        </h3>

        {/* Define Goals Button */}
        <button
          onClick={() => setShowGoalEditor(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 mb-4 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-sm"
        >
          <Target size={14} />
          Définir les objectifs
        </button>

        {/* Manuscript Mode */}
        <ManuscriptModeToggle
          mode={manuscriptMode}
          onChange={setManuscriptMode}
        />
      </section>

      {/* Goal Editor Modal */}
      {showGoalEditor && (
        <GoalEditor
          onClose={() => setShowGoalEditor(false)}
        />
      )}
    </div>
  )
}

interface StatItemProps {
  label: string
  value: string
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}
