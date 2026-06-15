import { useProjectStore } from '@/stores/projectStore'
import { useEditorStore } from '@/stores/editorStore'
import { useWikiStore } from '@/stores/wikiStore'
import { runEngine } from '@/lib/wiki/engine'
import {
  createFiche as ioCreateFiche, saveFiche as ioSaveFiche, saveAlert,
  appendLog, markChapterIntegrated, writeWikiIndex, loadAlerts, loadSuggestions
} from '@/lib/wiki/wikiIO'
import { docToMarkdownBody } from '@shared/markdown'
import {
  WIKI_SYSTEM_PROMPT, buildWikiUpdatePrompt, buildFichesSummary, parseIngestOutput,
  appendIngestSection, addSourceToFiche, suggestionToAlert,
  WIKI_CATEGORIES, type WikiCategory, type Fiche, type Alert
} from '@shared/wiki'
import type { ManuscriptItem } from '@shared/types/project'

export interface IngestResult {
  fichesCreated: number
  fichesUpdated: number
  alerts: number
  ignored: number
  summary: string
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function findItem(items: ManuscriptItem[], id: string): ManuscriptItem | null {
  for (const it of items) {
    if (it.id === id) return it
    if (it.children) {
      const found = findItem(it.children, id)
      if (found) return found
    }
  }
  return null
}

/** Read a chapter's text as plain markdown. Only the active document can hold unflushed
 *  editor edits, so we flush just that one before reading from the store. */
function readChapterText(chapterId: string): string {
  const editor = useEditorStore.getState()
  if (useProjectStore.getState().activeDocumentId === chapterId) {
    editor.flushCurrentDocument(chapterId)
  }
  const raw = editor.getDocumentContent(chapterId)
  if (!raw) return ''
  try {
    return docToMarkdownBody(JSON.parse(raw))
  } catch {
    return ''
  }
}

/** Resolve an "ajout" target: prefer "categorie/slug"; else an unambiguous title match
 *  (constrained to the cible's category when one is given) to avoid cross-category collisions. */
function findFicheByCible(fiches: Fiche[], cible: string, title: string): Fiche | null {
  const wanted = title.trim().toLowerCase()
  if (cible.includes('/')) {
    const [cat, slug] = cible.split('/')
    const bySlug = fiches.find(f => f.category === cat && f.slug === slug)
    if (bySlug) return bySlug
    const inCat = fiches.filter(f => f.category === cat && f.title.trim().toLowerCase() === wanted)
    return inCat.length === 1 ? inCat[0] : null
  }
  const byTitle = fiches.filter(f => f.title.trim().toLowerCase() === wanted)
  return byTitle.length === 1 ? byTitle[0] : null
}

/**
 * Analyze one chapter and auto-apply the result to the Univers (basic mode):
 * nouvelle_fiche -> create ; ajout -> append marked section + source ; incoherence -> alert.
 * Also writes a chapter summary into the chapter synopsis. Returns counts.
 */
// Not re-entrant: callers must prevent concurrent runs on the same chapter (the toolbar button disables while running).
export async function ingestChapter(chapterId: string): Promise<IngestResult> {
  const projectPath = useProjectStore.getState().projectPath
  const project = useProjectStore.getState().project
  if (!projectPath || !project) throw new Error('Aucun projet ouvert')
  const item = findItem(project.manuscript.items, chapterId)
  if (!item) throw new Error('Chapitre introuvable')
  const chapterText = readChapterText(chapterId)
  if (!chapterText.trim()) throw new Error('Chapitre vide')

  await useWikiStore.getState().ensureLoaded()
  let working: Fiche[] = [...useWikiStore.getState().fiches]
  const alerts = await loadAlerts(projectPath)
  const pending = await loadSuggestions(projectPath)
  const pendingSummary =
    [...alerts.map(a => `! ${a.title}`), ...pending.map(s => `~ ${s.title}`)].join('\n') || 'Rien en attente.'

  const user = buildWikiUpdatePrompt({
    chapterTitle: item.title,
    chapterText,
    fichesSummary: buildFichesSummary(working),
    pendingSummary
  })

  const raw = await runEngine(WIKI_SYSTEM_PROMPT, user)
  const { suggestions, summary } = parseIngestOutput(raw)
  const day = today()
  let fichesCreated = 0, fichesUpdated = 0, alertCount = 0, ignored = 0

  // 1. New fiches first (so same-run "ajout" can target them).
  for (const s of suggestions.filter(x => x.type === 'nouvelle_fiche')) {
    const cat: WikiCategory = (WIKI_CATEGORIES as string[]).includes(s.cible)
      ? (s.cible as WikiCategory)
      : 'notes'
    const fiche = await ioCreateFiche(projectPath, cat, s.title, s.body, working)
    working.push(fiche)
    fichesCreated += 1
  }

  // 2. Additions to existing fiches.
  for (const s of suggestions.filter(x => x.type === 'ajout')) {
    const target = findFicheByCible(working, s.cible, s.title)
    if (!target) { ignored += 1; continue }
    let updated = appendIngestSection(target, chapterId, s.body, day)
    updated = addSourceToFiche(updated, chapterId, day)
    await ioSaveFiche(projectPath, updated)
    working = working.map(f => (f.category === updated.category && f.slug === updated.slug ? updated : f))
    fichesUpdated += 1
  }

  // 3. Contradictions -> open alerts.
  for (const s of suggestions.filter(x => x.type === 'incoherence')) {
    const alert: Alert = { ...suggestionToAlert(s, day), id: crypto.randomUUID() }
    await saveAlert(projectPath, alert)
    alertCount += 1
  }

  // Chapter summary -> synopsis (visible in the manuscript).
  if (summary.trim()) {
    useProjectStore.getState().updateManuscriptItem(chapterId, { synopsis: summary.trim() })
    await useProjectStore.getState().saveProject()
  }

  await appendLog(projectPath, 'ingest', item.title,
    `${fichesCreated} créée(s), ${fichesUpdated} enrichie(s), ${alertCount} alerte(s)`)
  await markChapterIntegrated(projectPath, chapterId)
  await writeWikiIndex(projectPath, working)
  await useWikiStore.getState().loadWiki(projectPath)

  return { fichesCreated, fichesUpdated, alerts: alertCount, ignored, summary }
}
