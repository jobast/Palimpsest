import { useMemo, useState } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { useAIStore } from '@/stores/aiStore'
import { useUIStore } from '@/stores/uiStore'
import {
  Bot,
  Sparkles,
  Users,
  MapPin,
  GitBranch,
  FileText,
  Settings,
  AlertCircle,
  Loader2,
  ChevronRight,
  Search,
  Lightbulb,
  Coins,
  RotateCcw,
  BookOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  generateCharacterAnalysis,
  generateCharacterEnrichment,
  generateLocationEnrichment,
  generateSensoryDetails,
  generatePlotAnalysis,
  findPlotHoles,
  generateEditorialFeedback,
  generateStyleAnalysis,
  analyzeManuscript
} from './actions'
import type { AnalysisProgress } from './actions'

type ContextType = 'character' | 'location' | 'plot' | 'chapter' | 'none'

interface AIAction {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  action: () => Promise<void>
}

export function AIPanel() {
  const { project, activeSheetId, activeDocumentId, activeReportId, setActiveReport } = useProjectStore()
  const { hasValidApiKey, getModelInfo, isLoading, sessionUsage, formatCost, resetSessionUsage, selectedProvider } = useAIStore()
  const { openSettings } = useUIStore()
  const [runningAction, setRunningAction] = useState<string | null>(null)
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null)

  // Determine current context
  const context = useMemo(() => {
    if (!project) return { type: 'none' as ContextType, entity: null, name: '' }

    if (activeSheetId) {
      // Check which type of sheet is active
      const character = project.sheets.characters.find(c => c.id === activeSheetId)
      if (character) return { type: 'character' as ContextType, entity: character, name: character.name }

      const location = project.sheets.locations.find(l => l.id === activeSheetId)
      if (location) return { type: 'location' as ContextType, entity: location, name: location.name }

      const plot = project.sheets.plots.find(p => p.id === activeSheetId)
      if (plot) return { type: 'plot' as ContextType, entity: plot, name: plot.name }
    }

    if (activeDocumentId) {
      // Find the chapter/scene
      const findItem = (items: typeof project.manuscript.items): typeof items[0] | null => {
        for (const item of items) {
          if (item.id === activeDocumentId) return item
          if (item.children) {
            const found = findItem(item.children)
            if (found) return found
          }
        }
        return null
      }
      const item = findItem(project.manuscript.items)
      if (item) return { type: 'chapter' as ContextType, entity: item, name: item.title }
    }

    return { type: 'none' as ContextType, entity: null, name: '' }
  }, [project, activeSheetId, activeDocumentId])

  // Get related reports for current context
  const relatedReports = useMemo(() => {
    if (!project || !context.entity) return []

    return project.reports.filter(report =>
      report.linkedEntities.some(e => e.id === (context.entity as { id: string })?.id)
    ).slice(0, 5) // Limit to 5 most recent
  }, [project, context.entity])

  // Define actions based on context
  const actions = useMemo((): AIAction[] => {
    const runAction = async (actionId: string, actionFn: () => Promise<void>) => {
      setRunningAction(actionId)
      try {
        await actionFn()
      } catch (error) {
        console.error('AI action failed:', error)
      } finally {
        setRunningAction(null)
      }
    }

    switch (context.type) {
      case 'character':
        return [
          {
            id: 'analyze-character',
            label: 'Analyser ce personnage',
            description: 'Analyse approfondie du personnage',
            icon: <Search size={16} />,
            action: () => runAction('analyze-character', () => generateCharacterAnalysis(context.entity as any))
          },
          {
            id: 'enrich-character',
            label: 'Enrichir la fiche',
            description: 'Suggestions pour completer la fiche',
            icon: <Lightbulb size={16} />,
            action: () => runAction('enrich-character', () => generateCharacterEnrichment(context.entity as any))
          }
        ]

      case 'location':
        return [
          {
            id: 'enrich-location',
            label: 'Enrichir ce lieu',
            description: 'Suggestions de details et atmosphere',
            icon: <Lightbulb size={16} />,
            action: () => runAction('enrich-location', () => generateLocationEnrichment(context.entity as any))
          },
          {
            id: 'sensory-details',
            label: 'Details sensoriels',
            description: 'Generer des descriptions sensorielles',
            icon: <Sparkles size={16} />,
            action: () => runAction('sensory-details', () => generateSensoryDetails(context.entity as any))
          }
        ]

      case 'plot':
        return [
          {
            id: 'analyze-plot',
            label: 'Analyser l\'intrigue',
            description: 'Structure, tensions, resolution',
            icon: <Search size={16} />,
            action: () => runAction('analyze-plot', () => generatePlotAnalysis(context.entity as any))
          },
          {
            id: 'find-holes',
            label: 'Detecter les trous',
            description: 'Trouver les incoherences narratives',
            icon: <AlertCircle size={16} />,
            action: () => runAction('find-holes', () => findPlotHoles(context.entity as any))
          }
        ]

      case 'chapter':
        return [
          {
            id: 'editorial-feedback',
            label: 'Feedback editorial',
            description: 'Analyse du style et de la structure',
            icon: <FileText size={16} />,
            action: () => runAction('editorial-feedback', () => generateEditorialFeedback(context.entity as any))
          },
          {
            id: 'style-analysis',
            label: 'Analyse du style',
            description: 'Ton, rythme, voix narrative',
            icon: <Sparkles size={16} />,
            action: () => runAction('style-analysis', () => generateStyleAnalysis(context.entity as any))
          }
        ]

      default:
        return []
    }
  }, [context])

  // Context icons
  const contextIcons: Record<ContextType, React.ReactNode> = {
    character: <Users size={16} />,
    location: <MapPin size={16} />,
    plot: <GitBranch size={16} />,
    chapter: <FileText size={16} />,
    none: <Bot size={16} />
  }

  const contextLabels: Record<ContextType, string> = {
    character: 'Personnage',
    location: 'Lieu',
    plot: 'Intrigue',
    chapter: 'Chapitre',
    none: 'Aucun element'
  }

  const modelInfo = getModelInfo()
  const apiConfigured = hasValidApiKey()

  return (
    <div className="h-full flex flex-col">
      {/* API Status */}
      {!apiConfigured && (
        <div className="p-3 bg-destructive/10 border-b border-destructive/20">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-destructive font-medium">Cle API requise</p>
              <p className="text-xs text-destructive/80 mt-0.5">
                Configurez votre cle API dans les parametres.
              </p>
            </div>
          </div>
          <button
            onClick={openSettings}
            className="mt-2 w-full py-1.5 text-xs bg-destructive/20 hover:bg-destructive/30 text-destructive rounded transition-colors flex items-center justify-center gap-1"
          >
            <Settings size={12} />
            Configurer
          </button>
        </div>
      )}

      {/* Current Context */}
      <div className="p-3 border-b border-border">
        <p className="text-xs text-muted-foreground mb-2">Contexte actuel</p>
        <div className={cn(
          'flex items-center gap-2 p-2 rounded-lg',
          context.type !== 'none' ? 'bg-primary/10' : 'bg-muted'
        )}>
          <span className={context.type !== 'none' ? 'text-primary' : 'text-muted-foreground'}>
            {contextIcons[context.type]}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{contextLabels[context.type]}</p>
            {context.name && (
              <p className="text-sm font-medium truncate">{context.name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {context.type !== 'none' && (
        <div className="p-3 border-b border-border">
          <p className="text-xs text-muted-foreground mb-2">Actions</p>
          <div className="space-y-1">
            {actions.map(action => (
              <button
                key={action.id}
                onClick={action.action}
                disabled={!apiConfigured || isLoading || runningAction !== null}
                className={cn(
                  'w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors',
                  'hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <span className="text-primary shrink-0">
                  {runningAction === action.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    action.icon
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                </div>
                <ChevronRight size={14} className="text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Global manuscript action - always visible */}
      {project && (
        <div className="p-3 border-b border-border">
          <p className="text-xs text-muted-foreground mb-2">Manuscrit complet</p>
          <button
            onClick={async () => {
              setRunningAction('analyze-manuscript')
              setAnalysisProgress(null)
              try {
                await analyzeManuscript((progress) => setAnalysisProgress(progress))
              } catch (error) {
                console.error('Manuscript analysis failed:', error)
              } finally {
                setRunningAction(null)
                setAnalysisProgress(null)
              }
            }}
            disabled={!hasValidApiKey() || isLoading || runningAction !== null}
            className={cn(
              'w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors',
              'hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <span className="text-primary shrink-0">
              {runningAction === 'analyze-manuscript' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <BookOpen size={16} />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Analyse globale</p>
              {analysisProgress ? (
                <p className="text-xs text-primary">
                  {analysisProgress.phase === 'chapters'
                    ? `Chapitre ${analysisProgress.current}/${analysisProgress.total}: ${analysisProgress.currentChapter}`
                    : 'Synthese en cours...'
                  }
                </p>
              ) : (
                <p className="text-xs text-muted-foreground truncate">
                  Analyser tous les chapitres et synthetiser
                </p>
              )}
            </div>
            <ChevronRight size={14} className="text-muted-foreground shrink-0" />
          </button>
        </div>
      )}

      {/* No context hint */}
      {context.type === 'none' && (
        <div className="p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Selectionnez un element pour plus d'actions contextuelles.
          </p>
        </div>
      )}

      {/* Related Reports */}
      {relatedReports.length > 0 && (
        <div className="p-3 border-b border-border">
          <p className="text-xs text-muted-foreground mb-2">
            Rapports lies ({relatedReports.length})
          </p>
          <div className="space-y-1">
            {relatedReports.map(report => (
              <button
                key={report.id}
                onClick={() => setActiveReport(report.id)}
                className={cn(
                  'w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors',
                  activeReportId === report.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-accent'
                )}
              >
                <Sparkles size={14} className="shrink-0" />
                <span className="text-sm truncate flex-1">{report.title}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(report.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Session Usage */}
      {sessionUsage.requestCount > 0 && (
        <div className="p-3 border-t border-border bg-muted/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Coins size={12} />
              <span>Session</span>
            </div>
            <button
              onClick={resetSessionUsage}
              className="p-1 hover:bg-accent rounded transition-colors"
              title="Reinitialiser"
            >
              <RotateCcw size={10} className="text-muted-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Requetes</p>
              <p className="font-medium">{sessionUsage.requestCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cout</p>
              <p className={cn(
                'font-medium',
                selectedProvider === 'ollama' ? 'text-green-600' : ''
              )}>
                {formatCost(sessionUsage.totalCost)}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Tokens</p>
              <p className="font-medium text-xs">
                {sessionUsage.inputTokens.toLocaleString()} in / {sessionUsage.outputTokens.toLocaleString()} out
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Model Info */}
      <div className="mt-auto p-3 border-t border-border bg-muted/30">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Bot size={12} />
            <span>{modelInfo?.name || 'Non configure'}</span>
          </div>
          <button
            onClick={openSettings}
            className="p-1 hover:bg-accent rounded transition-colors"
            title="Parametres IA"
          >
            <Settings size={12} className="text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  )
}
