import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { useEditorStore } from '@/stores/editorStore'
import { useWikiStore } from '@/stores/wikiStore'
import { useUIStore } from '@/stores/uiStore'
import { useStatsStore } from '@/stores/statsStore'
import { flattenChapterIds } from '@shared/manuscript/order'
import { docToMarkdownBody } from '@shared/markdown'
import { hashContent, chapterStatus, isCliEngine, type ChapterStatus } from '@shared/wiki'
import { runAgentIngest, cancelAgent } from '@/lib/wiki/agent'
import { ingestChapter } from '@/lib/wiki/ingest'
import { X, Loader2 } from 'lucide-react'

const BADGE: Record<ChapterStatus, { label: string; cls: string }> = {
  never: { label: 'non ingéré', cls: 'text-muted-foreground' },
  stale: { label: 'modifié', cls: 'text-amber-600' },
  current: { label: 'à jour', cls: 'text-green-600' }
}

function chapterMd(id: string): string {
  const raw = useEditorStore.getState().getDocumentContent(id)
  if (!raw) return ''
  try { return docToMarkdownBody(JSON.parse(raw)) } catch { return '' }
}

export function IngestionMenu({ onClose }: { onClose: () => void }) {
  const project = useProjectStore(s => s.project)
  const integrations = useWikiStore(s => s.integrations)
  const analysisEngine = useUIStore(s => s.analysisEngine)
  const showNotification = useStatsStore(s => s.showNotification)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [running, setRunning] = useState(false)
  const [activity, setActivity] = useState('')
  const cancelRef = useRef(false)

  const ids = project ? flattenChapterIds(project.manuscript.items) : []
  const rows = ids.map(id => ({ id, status: chapterStatus(hashContent(chapterMd(id)), integrations[id]) }))

  // Default selection: everything not up-to-date.
  useEffect(() => {
    setSelected(new Set(rows.filter(r => r.status !== 'current').map(r => r.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, integrations])

  const titleOf = (id: string): string => {
    if (!project) return id
    const find = (items: typeof project.manuscript.items): string | null => {
      for (const it of items) { if (it.id === id) return it.title; if (it.children) { const f = find(it.children); if (f) return f } }
      return null
    }
    return find(project.manuscript.items) || id
  }

  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const run = async () => {
    const chosen = [...selected]
    if (!chosen.length) { showNotification('error', 'Aucun chapitre sélectionné'); return }
    setRunning(true); setActivity(''); cancelRef.current = false
    try {
      if (isCliEngine(analysisEngine)) {
        const res = await runAgentIngest(chosen, evt => setActivity(evt.label || evt.kind))
        showNotification(res.ok ? 'success' : 'error', res.ok ? `Univers mis à jour par l'agent. ${res.summary ? res.summary.slice(0, 120) : ''}` : `Agent KO : ${res.error}`)
      } else {
        // API engine: lighter pipeline over the SELECTED chapters (sequential, cancellable).
        let done = 0, created = 0, updated = 0, failures = 0
        for (const id of chosen) {
          if (cancelRef.current) break
          setActivity(`${done + 1}/${chosen.length} - ${titleOf(id)}`)
          try { const r = await ingestChapter(id); created += r.fichesCreated; updated += r.fichesUpdated }
          catch { failures += 1 }
          done++
        }
        await useWikiStore.getState().refreshSuggestions()
        showNotification(failures ? 'error' : 'success', `Analyse (API) : ${done} chapitre(s), ${created} créée(s), ${updated} enrichie(s)${failures ? `, ${failures} échec(s)` : ''}.`)
      }
    } catch (e) {
      showNotification('error', `Analyse KO : ${e instanceof Error ? e.message : 'erreur'}`)
    } finally {
      setRunning(false)
    }
  }

  const stop = () => { cancelRef.current = true; cancelAgent() }

  const doReset = async () => {
    if (!confirm('Vider tout l\'Univers (les fiches seront sauvegardées dans un dossier .wiki-backup) ?')) return
    const res = await useWikiStore.getState().resetWiki()
    showNotification(res.ok ? 'success' : 'error',
      res.ok ? `Univers vidé${res.backup ? ' (sauvegarde faite)' : ''}. Relance l'analyse avec l'agent.` : `Échec : ${res.error}`)
  }

  return (
    <div className="absolute inset-0 z-10 bg-card flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-medium">Analyser le manuscrit</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-0.5">
        {rows.map(r => (
          <label key={r.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent text-sm cursor-pointer">
            <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} disabled={running} />
            <span className="flex-1 truncate">{titleOf(r.id)}</span>
            <span className={`text-[10px] ${BADGE[r.status].cls}`}>{BADGE[r.status].label}</span>
          </label>
        ))}
      </div>
      <div className="border-t border-border p-2 space-y-1.5">
        {running && <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" />{activity || 'Analyse en cours…'}</div>}
        <button
          onClick={() => { void doReset() }}
          disabled={running}
          className="w-full px-2 py-1 rounded text-xs border border-red-300 text-red-600 hover:bg-red-50"
          title="Sauvegarde puis vide tout le wiki (pour relancer propre)"
        >
          Repartir à neuf (vider l'Univers)
        </button>
        <div className="flex gap-1.5">
          {!running ? (
            <button onClick={() => { void run() }} className="flex-1 px-2 py-1.5 rounded text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-accent">
              Lancer ({selected.size}) - {isCliEngine(analysisEngine) ? 'agent' : 'API'}
            </button>
          ) : (
            <button onClick={stop} className="flex-1 px-2 py-1.5 rounded text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-accent">Arrêter</button>
          )}
        </div>
      </div>
    </div>
  )
}
