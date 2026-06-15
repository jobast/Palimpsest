import { useEffect, useRef, useState } from 'react'
import { useWikiStore } from '@/stores/wikiStore'
import { useProjectStore } from '@/stores/projectStore'
import { useStatsStore } from '@/stores/statsStore'
import { useUIStore } from '@/stores/uiStore'
import { groupFichesByCategory, ficheKey, WIKI_CATEGORIES, CLI_ENGINES, isCliEngine, type WikiCategory, type EngineId } from '@shared/wiki'
import { Plus, Sparkles, Trash2, BookOpenCheck, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { writeAgentDoc } from '@/lib/wiki/wikiIO'
import { runEngine, detectEngines } from '@/lib/wiki/engine'
import { analyzeManuscript, type BatchProgress } from '@/lib/wiki/ingest'

const CATEGORY_LABELS: Record<WikiCategory, string> = {
  personnages: 'Personnages', lieux: 'Lieux', intrigues: 'Intrigues',
  structure: 'Structure', ecriture: 'Écriture', notes: 'Notes'
}

export function FicheNavigator() {
  const { fiches, activeFicheKey, setActiveFiche, createFiche, deleteFiche } = useWikiStore()
  const project = useProjectStore(s => s.project)
  const projectPath = useProjectStore(s => s.projectPath)
  const showNotification = useStatsStore(s => s.showNotification)
  const analysisEngine = useUIStore(s => s.analysisEngine)
  const setAnalysisEngine = useUIStore(s => s.setAnalysisEngine)
  const analysisMode = useUIStore(s => s.analysisMode)
  const setAnalysisMode = useUIStore(s => s.setAnalysisMode)
  const [adding, setAdding] = useState<WikiCategory | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [availableEngines, setAvailableEngines] = useState<string[]>([])
  const [batch, setBatch] = useState<BatchProgress | null>(null)
  const cancelRef = useRef(false)

  const handleAnalyzeManuscript = async () => {
    cancelRef.current = false
    setBatch({ done: 0, total: 0, title: '' })
    try {
      const r = await analyzeManuscript(p => setBatch(p), () => !cancelRef.current)
      await useWikiStore.getState().refreshSuggestions()
      const tail = r.cancelled ? ' (interrompu)' : ''
      const fails = r.failures ? `, ${r.failures} échec(s)` : ''
      showNotification(r.failures ? 'error' : 'success',
        `Manuscrit analysé : ${r.chapters} chapitre(s), ${r.fichesCreated} fiche(s) créée(s), ${r.fichesUpdated} enrichie(s), ${r.alerts} alerte(s)${fails}${tail}.`)
    } catch (e) {
      showNotification('error', `Analyse KO : ${e instanceof Error ? e.message : 'erreur'}`)
    } finally {
      setBatch(null)
    }
  }

  const groups = groupFichesByCategory(fiches)

  useEffect(() => {
    void detectEngines()
      .then(available => {
        setAvailableEngines(available)
        const current = useUIStore.getState().analysisEngine
        if (isCliEngine(current) && !available.includes(current)) setAnalysisEngine('api')
      })
      .catch(() => setAvailableEngines([]))
  }, [])

  const handleTestEngine = async () => {
    try {
      const txt = await runEngine('Réponds en un mot.', 'Dis « ok ».')
      showNotification('success', `Moteur OK : ${txt.trim().slice(0, 40)}`)
    } catch (e) {
      showNotification('error', `Moteur KO : ${e instanceof Error ? e.message : 'erreur'}`)
    }
  }

  const handlePrepareAgent = async () => {
    if (!project || !projectPath) return
    try {
      const path = await writeAgentDoc(projectPath, project.meta.name, project.meta.author || '')
      showNotification('success', `Analyse préparée : ${path}. Lancez « claude » dans ce dossier.`)
    } catch {
      showNotification('error', "Impossible de préparer l'analyse")
    }
  }

  const submitNew = (category: WikiCategory) => {
    const title = newTitle.trim()
    if (title) void createFiche(category, title)
    setAdding(null); setNewTitle('')
  }

  return (
    <div className="p-2 space-y-3 overflow-auto h-full">
      {WIKI_CATEGORIES.map(category => {
        const group = groups.find(g => g.category === category)
        return (
          <div key={category}>
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{CATEGORY_LABELS[category]}</span>
              <button onClick={() => { setAdding(category); setNewTitle('') }} className="p-0.5 rounded hover:bg-accent text-muted-foreground" title="Nouvelle fiche">
                <Plus size={13} />
              </button>
            </div>
            {adding === category && (
              <input
                autoFocus
                className="w-full mb-1 bg-background border border-border rounded px-1 text-sm"
                value={newTitle}
                placeholder="Titre…"
                onChange={e => setNewTitle(e.target.value)}
                onBlur={() => submitNew(category)}
                onKeyDown={e => { if (e.key === 'Enter') submitNew(category); if (e.key === 'Escape') { setAdding(null); setNewTitle('') } }}
              />
            )}
            <div className="space-y-0.5">
              {group?.fiches.map(f => {
                const key = ficheKey(f)
                return (
                  <div
                    key={key}
                    className={cn('group flex items-center gap-1 px-2 py-1 rounded text-sm cursor-pointer',
                      activeFicheKey === key ? 'bg-primary/10 text-primary' : 'hover:bg-accent')}
                    onClick={() => setActiveFiche(key)}
                  >
                    <span className="truncate flex-1">{f.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm(`Supprimer « ${f.title} » ?`)) void deleteFiche(f) }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent text-muted-foreground"
                      title="Supprimer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      {batch ? (
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="text-xs text-muted-foreground truncate">
            Analyse… {batch.done}/{batch.total}{batch.title ? ` - ${batch.title}` : ''}
          </div>
          <div className="h-1 w-full rounded bg-accent overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: batch.total ? `${(batch.done / batch.total) * 100}%` : '0%' }}
            />
          </div>
          <button
            onClick={() => { cancelRef.current = true }}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
            title="Arrête après le chapitre en cours"
          >
            <Square size={12} />
            Arrêter
          </button>
        </div>
      ) : (
        <button
          onClick={() => { void handleAnalyzeManuscript() }}
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
          title="Analyse tous les chapitres non encore intégrés dans l'Univers"
        >
          <BookOpenCheck size={13} />
          Analyser le manuscrit
        </button>
      )}
      <button
        onClick={handlePrepareAgent}
        className="mt-3 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
        title="Génère wiki/CLAUDE.md pour une analyse approfondie par un agent externe"
      >
        <Sparkles size={13} />
        Préparer l'analyse approfondie
      </button>
      <div className="mt-2 flex flex-col gap-1.5">
        <select
          value={analysisMode}
          onChange={e => setAnalysisMode(e.target.value as 'basique' | 'avance')}
          className="w-full text-xs bg-background border border-border rounded px-1.5 py-1 text-muted-foreground"
          title="Basique : applique direct. Avancé : dépose des suggestions à valider."
        >
          <option value="basique">Mode basique (auto)</option>
          <option value="avance">Mode avancé (revue)</option>
        </select>
        <select
          value={analysisEngine}
          onChange={e => setAnalysisEngine(e.target.value as EngineId)}
          className="w-full text-xs bg-background border border-border rounded px-1.5 py-1 text-muted-foreground"
        >
          <option value="api">API (réglages)</option>
          {CLI_ENGINES.filter(engine => availableEngines.includes(engine.id)).map(engine => (
            <option key={engine.id} value={engine.id}>{engine.label}</option>
          ))}
        </select>
        <button
          onClick={handleTestEngine}
          className="w-full px-2 py-1 rounded text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          Tester le moteur
        </button>
      </div>
    </div>
  )
}
