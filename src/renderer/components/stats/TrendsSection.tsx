import { ChevronDown, ChevronRight, TrendingUp, Calendar, Target } from 'lucide-react'
import { useStatsStore, type ChartPeriod, type ChartType } from '@/stores/statsStore'
import { WordCountTrendChart, ProductivityPatternChart, CumulativeProgressChart } from './charts'
import { SparklineWithLabel } from './MiniSparkline'
import { cn } from '@/lib/utils'

interface TrendsSectionProps {
  className?: string
}

const PERIOD_OPTIONS: Array<{ value: ChartPeriod; label: string }> = [
  { value: '7d', label: '7j' },
  { value: '30d', label: '30j' },
  { value: '90d', label: '90j' }
]

const CHART_OPTIONS: Array<{ value: ChartType; label: string; icon: React.ReactNode }> = [
  { value: 'trend', label: 'Tendance', icon: <TrendingUp size={12} /> },
  { value: 'productivity', label: 'Productivité', icon: <Calendar size={12} /> },
  { value: 'cumulative', label: 'Progression', icon: <Target size={12} /> }
]

/**
 * TrendsSection Component
 *
 * Collapsible section showing writing trends and statistics charts.
 * Includes period selector and chart type tabs.
 */
export function TrendsSection({ className }: TrendsSectionProps) {
  const {
    dailyStats,
    goals,
    chartsExpanded,
    chartPeriod,
    chartType,
    toggleChartsExpanded,
    setChartPeriod,
    setChartType
  } = useStatsStore()

  const dailyGoal = goals.find(g => g.type === 'daily')?.target ?? 500
  const projectGoal = goals.find(g => g.type === 'project')?.target ?? 50000

  return (
    <section className={cn('', className)}>
      {/* Header with collapse toggle */}
      <button
        onClick={toggleChartsExpanded}
        className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 hover:text-foreground transition-colors"
      >
        <span>Tendances</span>
        {chartsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* Mini sparkline always visible */}
      {!chartsExpanded && (
        <SparklineWithLabel
          dailyStats={dailyStats}
          days={7}
          height={32}
          label="7 derniers jours"
          showTotal
        />
      )}

      {/* Expanded charts section */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          chartsExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        {/* Period selector */}
        <div className="flex rounded-lg border border-border overflow-hidden mb-3">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setChartPeriod(option.value)}
              className={cn(
                'flex-1 py-1 text-xs font-medium transition-colors',
                chartPeriod === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card hover:bg-accent text-muted-foreground',
                option.value !== '7d' && 'border-l border-border'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Chart area */}
        <div className="mb-3">
          {chartType === 'trend' && (
            <WordCountTrendChart
              dailyStats={dailyStats}
              dailyGoal={dailyGoal}
              period={chartPeriod}
              height={120}
            />
          )}
          {chartType === 'productivity' && (
            <ProductivityPatternChart
              dailyStats={dailyStats}
              height={140}
            />
          )}
          {chartType === 'cumulative' && (
            <CumulativeProgressChart
              dailyStats={dailyStats}
              projectGoal={projectGoal}
              height={120}
            />
          )}
        </div>

        {/* Chart type tabs */}
        <div className="flex gap-1">
          {CHART_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setChartType(option.value)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-medium transition-colors',
                chartType === option.value
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50'
              )}
            >
              {option.icon}
              <span className="hidden sm:inline">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
