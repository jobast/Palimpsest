import { useEffect } from 'react'
import { useWikiStore } from '@/stores/wikiStore'
import { useProjectStore } from '@/stores/projectStore'
import { useStatsStore } from '@/stores/statsStore'
import { applySuggestion } from '@/lib/wiki/ingest'
import { deleteSuggestion } from '@/lib/wiki/wikiIO'
import { Check, X } from 'lucide-react'
import type { Suggestion } from '@shared/wiki'

const TYPE_LABEL: Record<string, string> = {
  nouvelle_fiche: 'Nouvelle fiche', ajout: 'Ajout', incoherence: 'Incohérence'
}

export function SuggestionPanel() {
  const suggestions = useWikiStore(s => s.suggestions)
  const refreshSuggestions = useWikiStore(s => s.refreshSuggestions)
  const projectPath = useProjectStore(s => s.projectPath)
  const showNotification = useStatsStore(s => s.showNotification)

  useEffect(() => { void refreshSuggestions() }, [refreshSuggestions])

  const accept = async (s: Suggestion) => {
    if (!projectPath) return
    try {
      await applySuggestion(projectPath, s)
      await deleteSuggestion(projectPath, s.id)
      await refreshSuggestions()
    } catch (e) {
      showNotification('error', `Acceptation KO : ${e instanceof Error ? e.message : 'erreur'}`)
    }
  }

  const refuse = async (s: Suggestion) => {
    if (!projectPath) return
    await deleteSuggestion(projectPath, s.id)
    await refreshSuggestions()
  }

  return (
    <div className="h-full overflow-auto p-2">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
        Suggestions ({suggestions.length})
      </div>
      {suggestions.length === 0 && (
        <div className="text-xs text-muted-foreground px-1">Aucune suggestion en attente.</div>
      )}
      <div className="space-y-2">
        {suggestions.map(s => (
          <div key={s.id} className="border border-border rounded p-2 text-sm bg-background">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{TYPE_LABEL[s.type] ?? s.type}</span>
              <div className="flex gap-1">
                <button onClick={() => { void accept(s) }} title="Accepter" className="p-0.5 rounded hover:bg-accent text-green-600">
                  <Check size={14} />
                </button>
                <button onClick={() => { void refuse(s) }} title="Refuser" className="p-0.5 rounded hover:bg-accent text-red-600">
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="font-medium truncate">{s.title}</div>
            {s.resume && <div className="text-xs text-muted-foreground">{s.resume}</div>}
            <div className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
