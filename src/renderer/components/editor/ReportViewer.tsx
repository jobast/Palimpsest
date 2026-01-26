import { useMemo } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { Bot, ArrowLeft, Calendar, Cpu, FileText, Users, GitBranch, Clock, Languages } from 'lucide-react'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'

const REPORT_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  'character-analysis': { label: 'Analyse de personnage', icon: <Users size={16} /> },
  'plot-analysis': { label: 'Analyse d\'intrigue', icon: <GitBranch size={16} /> },
  'editorial-feedback': { label: 'Feedback editorial', icon: <FileText size={16} /> },
  'timeline': { label: 'Timeline', icon: <Clock size={16} /> },
  'consistency-check': { label: 'Verification de coherence', icon: <Bot size={16} /> },
  'translation': { label: 'Traduction', icon: <Languages size={16} /> }
}

export function ReportViewer() {
  const { project, activeReportId, setActiveReport } = useProjectStore()

  const activeReport = useMemo(() => {
    if (!project || !activeReportId) return null
    return project.reports.find(r => r.id === activeReportId) || null
  }, [project, activeReportId])

  if (!activeReport) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Rapport non trouve</p>
      </div>
    )
  }

  const typeConfig = REPORT_TYPE_CONFIG[activeReport.type] || {
    label: activeReport.type,
    icon: <Bot size={16} />
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-muted">
      {/* Header */}
      <div className="bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setActiveReport(null)}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Retour au manuscrit"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-2 text-primary">
          {typeConfig.icon}
          <span className="text-sm">{typeConfig.label}</span>
        </div>

        <h1 className="flex-1 text-lg font-semibold truncate">
          {activeReport.title}
        </h1>
      </div>

      {/* Metadata bar */}
      <div className="bg-background/50 border-b border-border px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar size={12} />
          <span>{formatDate(activeReport.createdAt)}</span>
        </div>

        <div className="flex items-center gap-1">
          <Cpu size={12} />
          <span>{activeReport.params.model}</span>
        </div>

        {activeReport.tokensUsed && (
          <div className="flex items-center gap-1">
            <span>Tokens: {activeReport.tokensUsed.input + activeReport.tokensUsed.output}</span>
          </div>
        )}

        {activeReport.params.genre && (
          <div className="px-2 py-0.5 bg-primary/10 text-primary rounded">
            {activeReport.params.genre}
          </div>
        )}

        {activeReport.params.tone && (
          <div className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded">
            {activeReport.params.tone}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto bg-paper rounded-lg shadow-md p-8">
          <article className="prose prose-sm max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:text-paper-foreground prose-li:text-paper-foreground">
            <ReactMarkdown>{activeReport.content}</ReactMarkdown>
          </article>
        </div>

        {/* Linked entities */}
        {activeReport.linkedEntities.length > 0 && (
          <div className="max-w-3xl mx-auto mt-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Elements analyses
            </h3>
            <div className="flex flex-wrap gap-2">
              {activeReport.linkedEntities.map((entity, idx) => (
                <LinkedEntityBadge key={idx} entity={entity} />
              ))}
            </div>
          </div>
        )}

        {/* Context (advanced mode) */}
        {activeReport.context && (
          <div className="max-w-3xl mx-auto mt-6">
            <details className="group">
              <summary className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                Contexte envoye (mode avance)
              </summary>
              <pre className="mt-2 p-4 bg-muted rounded-lg text-xs overflow-auto max-h-64">
                {activeReport.context}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}

function LinkedEntityBadge({ entity }: { entity: { type: string; id: string } }) {
  const { project, setActiveSheet, setActiveReport } = useProjectStore()

  const entityInfo = useMemo(() => {
    if (!project) return null

    switch (entity.type) {
      case 'character': {
        const char = project.sheets.characters.find(c => c.id === entity.id)
        return char ? { name: char.name, icon: <Users size={12} /> } : null
      }
      case 'location': {
        const loc = project.sheets.locations.find(l => l.id === entity.id)
        return loc ? { name: loc.name, icon: <FileText size={12} /> } : null
      }
      case 'plot': {
        const plot = project.sheets.plots.find(p => p.id === entity.id)
        return plot ? { name: plot.name, icon: <GitBranch size={12} /> } : null
      }
      case 'chapter': {
        const findChapter = (items: typeof project.manuscript.items): string | null => {
          for (const item of items) {
            if (item.id === entity.id) return item.title
            if (item.children) {
              const found = findChapter(item.children)
              if (found) return found
            }
          }
          return null
        }
        const title = findChapter(project.manuscript.items)
        return title ? { name: title, icon: <FileText size={12} /> } : null
      }
      default:
        return null
    }
  }, [project, entity])

  if (!entityInfo) return null

  const handleClick = () => {
    setActiveReport(null)
    if (entity.type !== 'chapter') {
      setActiveSheet(entity.id)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded text-xs',
        'bg-accent hover:bg-accent/80 text-foreground transition-colors'
      )}
    >
      {entityInfo.icon}
      <span>{entityInfo.name}</span>
    </button>
  )
}
