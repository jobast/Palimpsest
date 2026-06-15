import { useProjectStore } from '@/stores/projectStore'
import { useEditorStore } from '@/stores/editorStore'
import { useWikiStore } from '@/stores/wikiStore'
import { useUIStore } from '@/stores/uiStore'
import { runEngine } from '@/lib/wiki/engine'
import {
  createFiche as ioCreateFiche, saveFiche as ioSaveFiche, saveAlert,
  appendLog, writeWikiIndex, loadAlerts, loadSuggestions, loadIntegrations,
  addSuggestions, recordIntegration, mergeIntegration, removeIntegration, deleteAlert,
  loadFiches, deleteFiche as ioDeleteFiche
} from '@/lib/wiki/wikiIO'
import { chaptersToAnalyze } from '@shared/manuscript/order'
import { docToMarkdownBody } from '@shared/markdown'
import {
  WIKI_SYSTEM_PROMPT, buildWikiUpdatePrompt, buildFichesSummary, parseIngestOutput,
  appendIngestSection, addSourceToFiche, suggestionToAlert,
  removeIngestSection, emptyIntegrationRecord,
  WIKI_CATEGORIES, type WikiCategory, type Fiche, type Alert, type Suggestion,
  type IntegrationRecord
} from '@shared/wiki'
import type { ManuscriptItem } from '@shared/types/project'

export interface IngestResult {
  fichesCreated: number
  fichesUpdated: number
  alerts: number
  ignored: number
  queued: number
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

type ApplyRef =
  | { kind: 'created'; category: WikiCategory; slug: string }
  | { kind: 'appended'; category: WikiCategory; slug: string }
  | { kind: 'alert'; alertId: string }
  | { kind: 'ignored' }

/** Apply ONE suggestion to disk (basic mode / accept). Returns the updated working list + a delta + a ref. */
async function applyOneSuggestion(
  projectPath: string, s: Suggestion, chapterId: string, working: Fiche[], day: string
): Promise<{ working: Fiche[]; created: number; updated: number; alerts: number; ignored: number; ref: ApplyRef }> {
  if (s.type === 'nouvelle_fiche') {
    const cat: WikiCategory = (WIKI_CATEGORIES as string[]).includes(s.cible) ? (s.cible as WikiCategory) : 'notes'
    const fiche = await ioCreateFiche(projectPath, cat, s.title, s.body, working)
    return { working: [...working, fiche], created: 1, updated: 0, alerts: 0, ignored: 0, ref: { kind: 'created', category: fiche.category, slug: fiche.slug } }
  }
  if (s.type === 'ajout') {
    const target = findFicheByCible(working, s.cible, s.title)
    if (!target) return { working, created: 0, updated: 0, alerts: 0, ignored: 1, ref: { kind: 'ignored' } }
    let f = appendIngestSection(target, chapterId, s.body, day)
    f = addSourceToFiche(f, chapterId, day)
    await ioSaveFiche(projectPath, f)
    return {
      working: working.map(x => (x.category === f.category && x.slug === f.slug ? f : x)),
      created: 0, updated: 1, alerts: 0, ignored: 0, ref: { kind: 'appended', category: f.category, slug: f.slug }
    }
  }
  const alert: Alert = { ...suggestionToAlert(s, day), id: crypto.randomUUID() }
  await saveAlert(projectPath, alert)
  return { working, created: 0, updated: 0, alerts: 1, ignored: 0, ref: { kind: 'alert', alertId: alert.id } }
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
  const currentFiches: Fiche[] = [...useWikiStore.getState().fiches]
  const alerts = await loadAlerts(projectPath)
  const pending = await loadSuggestions(projectPath)
  const pendingSummary =
    [...alerts.map(a => `! ${a.title}`), ...pending.map(s => `~ ${s.title}`)].join('\n') || 'Rien en attente.'

  const user = buildWikiUpdatePrompt({
    chapterTitle: item.title,
    chapterText,
    fichesSummary: buildFichesSummary(currentFiches),
    pendingSummary
  })

  const raw = await runEngine(WIKI_SYSTEM_PROMPT, user)
  const { suggestions, summary } = parseIngestOutput(raw)
  const day = today()

  const mode = useUIStore.getState().analysisMode

  if (mode === 'avance') {
    const queued = suggestions.map(s => ({ ...s, id: crypto.randomUUID(), sourceChapitre: chapterId }))
    if (queued.length) await addSuggestions(projectPath, queued)
    if (summary.trim()) {
      useProjectStore.getState().updateManuscriptItem(chapterId, { synopsis: summary.trim() })
      await useProjectStore.getState().saveProject()
    }
    await appendLog(projectPath, 'analyse', item.title, `${queued.length} suggestion(s) en attente`)
    // Mark integrated so the batch does not re-analyze (and re-queue) an already-analyzed
    // chapter; the queued suggestions await review. Re-analysis ("tout reanalyser") is a later slice.
    await recordIntegration(projectPath, chapterId, emptyIntegrationRecord(day))
    return { fichesCreated: 0, fichesUpdated: 0, alerts: 0, ignored: 0, queued: queued.length, summary }
  }

  // Basic mode: auto-apply, new fiches first so same-run "ajout" can target them.
  let working: Fiche[] = [...currentFiches]
  let fichesCreated = 0, fichesUpdated = 0, alertCount = 0, ignored = 0
  const record = emptyIntegrationRecord(day)
  const ordered = [
    ...suggestions.filter(s => s.type === 'nouvelle_fiche'),
    ...suggestions.filter(s => s.type === 'ajout'),
    ...suggestions.filter(s => s.type === 'incoherence')
  ]
  for (const s of ordered) {
    const r = await applyOneSuggestion(projectPath, s, chapterId, working, day)
    working = r.working
    fichesCreated += r.created
    fichesUpdated += r.updated
    alertCount += r.alerts
    ignored += r.ignored
    if (r.ref.kind === 'created') record.created.push({ category: r.ref.category, slug: r.ref.slug })
    else if (r.ref.kind === 'appended') record.appended.push({ category: r.ref.category, slug: r.ref.slug })
    else if (r.ref.kind === 'alert') record.alerts.push(r.ref.alertId)
  }

  // Chapter summary -> synopsis (visible in the manuscript).
  if (summary.trim()) {
    useProjectStore.getState().updateManuscriptItem(chapterId, { synopsis: summary.trim() })
    await useProjectStore.getState().saveProject()
  }

  await appendLog(projectPath, 'ingest', item.title,
    `${fichesCreated} créée(s), ${fichesUpdated} enrichie(s), ${alertCount} alerte(s)`)
  await recordIntegration(projectPath, chapterId, record)
  await writeWikiIndex(projectPath, working)
  await useWikiStore.getState().loadWiki(projectPath)

  return { fichesCreated, fichesUpdated, alerts: alertCount, ignored, queued: 0, summary }
}

export interface BatchProgress { done: number; total: number; title: string }
export interface BatchResult {
  chapters: number
  fichesCreated: number
  fichesUpdated: number
  alerts: number
  queued: number
  failures: number
  cancelled: boolean
}

/**
 * Analyze every not-yet-integrated chapter, sequentially, in basic mode.
 * Reports progress before and after each chapter; checks shouldContinue()
 * before each chapter to allow a clean stop. A chapter that throws is counted
 * as a failure and skipped (it stays non-integrated, re-runnable). Returns aggregate counts.
 */
export async function analyzeManuscript(
  onProgress: (p: BatchProgress) => void,
  shouldContinue: () => boolean
): Promise<BatchResult> {
  const projectPath = useProjectStore.getState().projectPath
  const project = useProjectStore.getState().project
  if (!projectPath || !project) throw new Error('Aucun projet ouvert')

  const integrated = await loadIntegrations(projectPath)
  const ids = chaptersToAnalyze(project.manuscript.items, integrated)
  const total = ids.length
  let done = 0, fichesCreated = 0, fichesUpdated = 0, alerts = 0, queued = 0, failures = 0

  for (const id of ids) {
    if (!shouldContinue()) {
      return { chapters: done, fichesCreated, fichesUpdated, alerts, queued, failures, cancelled: true }
    }
    const title = findItem(project.manuscript.items, id)?.title ?? id
    onProgress({ done, total, title })
    try {
      const r = await ingestChapter(id)
      fichesCreated += r.fichesCreated
      fichesUpdated += r.fichesUpdated
      alerts += r.alerts
      queued += r.queued
    } catch (e) {
      console.warn(`Ingestion du chapitre ${id} (${title}) en echec:`, e)
      failures += 1
    }
    done += 1
    onProgress({ done, total, title })
  }

  return { chapters: done, fichesCreated, fichesUpdated, alerts, queued, failures, cancelled: false }
}

/** Accept one queued suggestion: apply it to the bible, refresh fiches + index. */
export async function applySuggestion(projectPath: string, s: Suggestion): Promise<void> {
  await useWikiStore.getState().ensureLoaded()
  const working = [...useWikiStore.getState().fiches]
  const chapterId = s.sourceChapitre ?? 'manuel'
  const r = await applyOneSuggestion(projectPath, s, chapterId, working, today())
  if (r.ref.kind === 'created') await mergeIntegration(projectPath, chapterId, { created: [{ category: r.ref.category, slug: r.ref.slug }] })
  else if (r.ref.kind === 'appended') await mergeIntegration(projectPath, chapterId, { appended: [{ category: r.ref.category, slug: r.ref.slug }] })
  else if (r.ref.kind === 'alert') await mergeIntegration(projectPath, chapterId, { alerts: [r.ref.alertId] })
  await writeWikiIndex(projectPath, r.working)
  await useWikiStore.getState().loadWiki(projectPath)
}

export interface UndoResult { deleted: number; reverted: number; alertsRemoved: number }

/** Undo everything a chapter wrote to the Univers: delete created fiches, strip its
 *  appended sections, delete its alerts, and de-integrate it. */
export async function undoChapterIntegration(chapterId: string): Promise<UndoResult> {
  const projectPath = useProjectStore.getState().projectPath
  if (!projectPath) throw new Error('Aucun projet ouvert')
  const integrations = await loadIntegrations(projectPath)
  const rec: IntegrationRecord | undefined = integrations[chapterId]
  if (!rec) return { deleted: 0, reverted: 0, alertsRemoved: 0 }

  const fiches = await loadFiches(projectPath)
  let deleted = 0, reverted = 0, alertsRemoved = 0

  const deletedKeys = new Set<string>()
  for (const ref of rec.created) {
    const f = fiches.find(x => x.category === ref.category && x.slug === ref.slug)
    if (f) { await ioDeleteFiche(projectPath, f); deleted += 1; deletedKeys.add(`${ref.category}/${ref.slug}`) }
  }
  for (const ref of rec.appended) {
    // A fiche both created AND appended-to by this chapter was just deleted; do not resurrect it.
    if (deletedKeys.has(`${ref.category}/${ref.slug}`)) continue
    const f = fiches.find(x => x.category === ref.category && x.slug === ref.slug)
    if (!f) continue
    const body = removeIngestSection(f.body, chapterId)
    const nextSources = (f.sources ?? []).filter(srcId => srcId !== chapterId)
    const updated: Fiche = { ...f, body, sources: nextSources.length ? nextSources : undefined }
    await ioSaveFiche(projectPath, updated)
    reverted += 1
  }
  for (const id of rec.alerts) { await deleteAlert(projectPath, id); alertsRemoved += 1 }

  await removeIntegration(projectPath, chapterId)
  await writeWikiIndex(projectPath, await loadFiches(projectPath))
  await useWikiStore.getState().loadWiki(projectPath)
  return { deleted, reverted, alertsRemoved }
}
