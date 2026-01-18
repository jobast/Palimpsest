import { useState } from 'react'
import {
  Search,
  AlertCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Type,
  Repeat,
  AlignLeft,
  Settings,
  ChevronDown
} from 'lucide-react'
import { useAnalysisStore, type AnalysisMode } from '@/stores/analysisStore'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import type { AnalysisIssue } from '@/lib/analysis/types'
import { cn } from '@/lib/utils'

/**
 * AnalysisPanel - Simplified text analysis panel
 *
 * One mode at a time:
 * - Phrases: Long sentence detection
 * - Répétitions: Word/phrase repetitions
 * - Style: Adverbs and weak verbs
 */
export function AnalysisPanel() {
  const { editor } = useEditorStore()
  const { activeDocumentId } = useProjectStore()
  const {
    result,
    isAnalyzing,
    settings,
    activeMode,
    selectedIssueId,
    runAnalysis,
    setActiveMode,
    updateSettings,
    selectIssue,
    getActiveIssues
  } = useAnalysisStore()

  const [showSettings, setShowSettings] = useState(false)

  const handleAnalyze = async () => {
    if (!editor || !activeDocumentId) return
    const text = editor.getText()
    await runAnalysis(text, activeDocumentId)
  }

  const handleIssueClick = (issue: AnalysisIssue) => {
    selectIssue(issue.id)

    if (editor) {
      editor.commands.setTextSelection(issue.from)
      editor.commands.focus()

      setTimeout(() => {
        const { view } = editor
        const coords = view.coordsAtPos(issue.from)
        const editorElement = view.dom.closest('.ProseMirror')
        const scrollContainer = editorElement?.closest('.overflow-auto') || editorElement?.parentElement

        if (scrollContainer && coords) {
          const containerRect = scrollContainer.getBoundingClientRect()
          const targetY = coords.top - containerRect.top + scrollContainer.scrollTop - 100

          scrollContainer.scrollTo({
            top: Math.max(0, targetY),
            behavior: 'smooth'
          })
        }
      }, 10)
    }
  }

  const activeIssues = getActiveIssues()

  // Count issues per mode for badges
  const sentenceCount = result?.issues.filter(i =>
    i.type === 'long-sentence' || i.type === 'very-long-sentence'
  ).length ?? 0

  const repetitionCount = result?.issues.filter(i =>
    i.type === 'repetition-word' || i.type === 'repetition-phrase' || i.type === 'repetition-starter'
  ).length ?? 0

  const styleCount = result?.issues.filter(i =>
    i.type === 'adverb' || i.type === 'weak-verb'
  ).length ?? 0

  return (
    <div className="flex flex-col h-full">
      {/* Header with Analyze button */}
      <div className="p-3 border-b border-border">
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !editor || !activeDocumentId}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors text-sm',
            isAnalyzing
              ? 'bg-muted text-muted-foreground cursor-wait'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
        >
          {isAnalyzing ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Analyse...
            </>
          ) : (
            <>
              <Search size={14} />
              Analyser
            </>
          )}
        </button>
      </div>

      {/* Mode Tabs */}
      {result && (
        <div className="flex border-b border-border">
          <ModeTab
            mode="sentences"
            label="Phrases"
            icon={<AlignLeft size={14} />}
            count={sentenceCount}
            active={activeMode === 'sentences'}
            onClick={() => setActiveMode(activeMode === 'sentences' ? null : 'sentences')}
          />
          <ModeTab
            mode="repetitions"
            label="Répétitions"
            icon={<Repeat size={14} />}
            count={repetitionCount}
            active={activeMode === 'repetitions'}
            onClick={() => setActiveMode(activeMode === 'repetitions' ? null : 'repetitions')}
          />
          <ModeTab
            mode="style"
            label="Style"
            icon={<Type size={14} />}
            count={styleCount}
            active={activeMode === 'style'}
            onClick={() => setActiveMode(activeMode === 'style' ? null : 'style')}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {!activeDocumentId ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Sélectionnez un document
          </div>
        ) : !result ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Cliquez sur Analyser pour commencer
          </div>
        ) : !activeMode ? (
          <div className="p-4 space-y-3">
            {/* Summary when no mode active */}
            <div className="text-sm text-muted-foreground text-center">
              Sélectionnez un mode ci-dessus
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <SummaryCard
                label="Phrases"
                value={sentenceCount}
                onClick={() => setActiveMode('sentences')}
              />
              <SummaryCard
                label="Répétitions"
                value={repetitionCount}
                onClick={() => setActiveMode('repetitions')}
              />
              <SummaryCard
                label="Style"
                value={styleCount}
                onClick={() => setActiveMode('style')}
              />
            </div>

            {/* Global stats */}
            <div className="pt-3 border-t border-border space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Phrases totales</span>
                <span className="font-medium text-foreground">{result.stats.totalSentences}</span>
              </div>
              <div className="flex justify-between">
                <span>Moy. mots/phrase</span>
                <span className="font-medium text-foreground">{result.stats.averageSentenceLength}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3">
            {/* Active mode header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {activeMode === 'sentences' && 'Phrases longues'}
                {activeMode === 'repetitions' && 'Répétitions'}
                {activeMode === 'style' && 'Style'}
              </span>
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                {activeIssues.length}
              </span>
            </div>

            {/* Mode-specific stats */}
            {activeMode === 'sentences' && (
              <div className="mb-3 p-2 bg-muted/50 rounded text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-amber-600">Longues ({'>'}={settings.longSentenceThreshold} mots)</span>
                  <span className="font-medium">{result.stats.longSentenceCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-600">Très longues ({'>'}={settings.veryLongSentenceThreshold} mots)</span>
                  <span className="font-medium">{result.stats.veryLongSentenceCount}</span>
                </div>
              </div>
            )}

            {activeMode === 'style' && (
              <div className="mb-3 p-2 bg-muted/50 rounded text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Adverbes en -ment</span>
                  <span className="font-medium">{result.stats.adverbCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Verbes faibles</span>
                  <span className="font-medium">{result.stats.weakVerbCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Adjectifs</span>
                  <span className="font-medium">{result.stats.adjectiveCount}</span>
                </div>
              </div>
            )}

            {/* Issues list */}
            {activeIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun problème détecté
              </p>
            ) : (
              <ul className="space-y-1">
                {activeIssues.map((issue) => (
                  <li key={issue.id}>
                    <button
                      onClick={() => handleIssueClick(issue)}
                      className={cn(
                        'w-full flex items-start gap-2 px-2 py-1.5 rounded text-left transition-colors',
                        selectedIssueId === issue.id
                          ? 'bg-primary/10 ring-1 ring-primary/30'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <SeverityIcon severity={issue.severity} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{issue.text}</p>
                        <p className="text-xs text-muted-foreground">{issue.message}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Settings footer */}
      {result && (
        <div className="border-t border-border">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Settings size={12} />
              <span>Paramètres</span>
            </div>
            <ChevronDown size={12} className={cn('transition-transform', showSettings && 'rotate-180')} />
          </button>

          {showSettings && (
            <div className="px-3 pb-3 space-y-3">
              <SettingRow
                label="Phrase longue"
                value={settings.longSentenceThreshold}
                unit="mots"
                min={15}
                max={40}
                onChange={(v) => updateSettings({ longSentenceThreshold: v })}
              />
              <SettingRow
                label="Très longue"
                value={settings.veryLongSentenceThreshold}
                unit="mots"
                min={30}
                max={60}
                onChange={(v) => updateSettings({ veryLongSentenceThreshold: v })}
              />
              <SettingRow
                label="Fenêtre répétitions"
                value={settings.repetitionWindow}
                unit="mots"
                min={50}
                max={200}
                onChange={(v) => updateSettings({ repetitionWindow: v })}
              />

              {/* Toggle for ignoring common words */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">Ignorer mots courants</span>
                <button
                  onClick={() => updateSettings({ ignoreCommonWords: !settings.ignoreCommonWords })}
                  className={cn(
                    'w-9 h-5 rounded-full transition-colors relative',
                    settings.ignoreCommonWords ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                      settings.ignoreCommonWords ? 'translate-x-4' : 'translate-x-0.5'
                    )}
                  />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground -mt-1">
                le, la, les, un, une, de, et, ou...
              </p>

              {/* Reminder to re-analyze */}
              <p className="text-xs text-amber-600 text-center pt-2 border-t border-border">
                Re-cliquez Analyser pour appliquer
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Sub-components

interface ModeTabProps {
  mode: AnalysisMode
  label: string
  icon: React.ReactNode
  count: number
  active: boolean
  onClick: () => void
}

function ModeTab({ label, icon, count, active, onClick }: ModeTabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-1 py-2 text-xs transition-colors relative',
        active
          ? 'text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {icon}
      <span>{label}</span>
      {count > 0 && (
        <span className={cn(
          'ml-1 px-1.5 py-0.5 rounded-full text-[10px]',
          active ? 'bg-primary/20 text-primary' : 'bg-muted'
        )}>
          {count}
        </span>
      )}
      {active && (
        <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
      )}
    </button>
  )
}

interface SummaryCardProps {
  label: string
  value: number
  onClick: () => void
}

function SummaryCard({ label, value, onClick }: SummaryCardProps) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
    >
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </button>
  )
}

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case 'critical':
      return <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
    case 'warning':
      return <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
    default:
      return <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
  }
}

interface SettingRowProps {
  label: string
  value: number
  unit: string
  min: number
  max: number
  onChange: (value: number) => void
}

function SettingRow({ label, value, unit, min, max, onChange }: SettingRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span>{value} {unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
      />
    </div>
  )
}
