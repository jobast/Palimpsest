import {
  parseFiche, serializeFiche, type Fiche, type WikiCategory, WIKI_CATEGORIES,
  parseSuggestion, serializeSuggestion, type Suggestion,
  parseAlert, serializeAlert, type Alert,
  formatLogEntry, prependLogEntry,
  buildWikiAgentDoc,
  toIntegrationRecord, type IntegrationRecord
} from '@shared/wiki'
import { slugify } from '@shared/markdown/filename'

const SUG_DIR = '_suggestions'
const ALERT_DIR = '_alertes'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

async function ensureDir(path: string): Promise<void> {
  await window.electronAPI.createDirectory(path)
}

/** Read all fiches across category folders. */
export async function loadFiches(projectPath: string): Promise<Fiche[]> {
  const fiches: Fiche[] = []
  for (const category of WIKI_CATEGORIES) {
    const dir = `${projectPath}/wiki/${category}`
    const res = await window.electronAPI.readDirectory(dir)
    if (!res.success || !res.files) continue
    for (const file of res.files) {
      if (file.isDirectory || !file.name.endsWith('.md')) continue
      const slug = file.name.replace(/\.md$/, '')
      const r = await window.electronAPI.readFile(`${dir}/${file.name}`)
      if (r.success && r.content) fiches.push(parseFiche(r.content, slug, category as WikiCategory))
    }
  }
  return fiches
}

export async function saveFiche(projectPath: string, fiche: Fiche): Promise<void> {
  await ensureDir(`${projectPath}/wiki/${fiche.category}`)
  await window.electronAPI.writeFile(`${projectPath}/wiki/${fiche.category}/${fiche.slug}.md`, serializeFiche(fiche))
}

export async function deleteFiche(projectPath: string, fiche: Fiche): Promise<void> {
  await window.electronAPI.deleteFile(`${projectPath}/wiki/${fiche.category}/${fiche.slug}.md`)
}

/** Create a fiche from title+category (unique slug), persist, return it. */
export async function createFiche(
  projectPath: string, category: WikiCategory, title: string, body: string, existing: Fiche[]
): Promise<Fiche> {
  const base = slugify(title)
  const taken = new Set(existing.filter(f => f.category === category).map(f => f.slug))
  let slug = base, i = 2
  while (taken.has(slug)) { slug = `${base}-${i}`; i += 1 }
  const fiche: Fiche = { slug, category, title, created: today(), lastUpdated: today(), body }
  await saveFiche(projectPath, fiche)
  return fiche
}

export async function loadSuggestions(projectPath: string): Promise<Suggestion[]> {
  const dir = `${projectPath}/wiki/${SUG_DIR}`
  const res = await window.electronAPI.readDirectory(dir)
  if (!res.success || !res.files) return []
  const out: Suggestion[] = []
  for (const file of res.files) {
    if (file.isDirectory || !file.name.endsWith('.md')) continue
    const id = file.name.replace(/\.md$/, '')
    const r = await window.electronAPI.readFile(`${dir}/${file.name}`)
    if (r.success && r.content) out.push(parseSuggestion(r.content, id))
  }
  return out
}

export async function addSuggestions(projectPath: string, suggestions: Suggestion[]): Promise<void> {
  await ensureDir(`${projectPath}/wiki/${SUG_DIR}`)
  for (const s of suggestions) {
    const id = s.id || crypto.randomUUID()
    await window.electronAPI.writeFile(`${projectPath}/wiki/${SUG_DIR}/${id}.md`, serializeSuggestion({ ...s, id }))
  }
}

export async function deleteSuggestion(projectPath: string, id: string): Promise<void> {
  await window.electronAPI.deleteFile(`${projectPath}/wiki/${SUG_DIR}/${id}.md`)
}

export async function loadAlerts(projectPath: string): Promise<Alert[]> {
  const dir = `${projectPath}/wiki/${ALERT_DIR}`
  const res = await window.electronAPI.readDirectory(dir)
  if (!res.success || !res.files) return []
  const out: Alert[] = []
  for (const file of res.files) {
    if (file.isDirectory || !file.name.endsWith('.md')) continue
    const id = file.name.replace(/\.md$/, '')
    const r = await window.electronAPI.readFile(`${dir}/${file.name}`)
    if (r.success && r.content) out.push(parseAlert(r.content, id))
  }
  return out
}

export async function saveAlert(projectPath: string, alert: Alert): Promise<void> {
  await ensureDir(`${projectPath}/wiki/${ALERT_DIR}`)
  await window.electronAPI.writeFile(`${projectPath}/wiki/${ALERT_DIR}/${alert.id}.md`, serializeAlert(alert))
}

export async function deleteAlert(projectPath: string, id: string): Promise<void> {
  await window.electronAPI.deleteFile(`${projectPath}/wiki/${ALERT_DIR}/${id}.md`)
}

export async function appendLog(projectPath: string, action: string, subject: string, detail: string): Promise<void> {
  await ensureDir(`${projectPath}/wiki`)
  const path = `${projectPath}/wiki/log.md`
  const existing = await window.electronAPI.readFile(path)
  const current = existing.success && existing.content ? existing.content : ''
  await window.electronAPI.writeFile(path, prependLogEntry(current, formatLogEntry(action, subject, detail, today())))
}

export async function loadIntegrations(projectPath: string): Promise<Record<string, IntegrationRecord>> {
  const r = await window.electronAPI.readFile(`${projectPath}/wiki/integrations.json`)
  if (!r.success || !r.content) return {}
  try {
    const raw = JSON.parse(r.content) as Record<string, unknown>
    const out: Record<string, IntegrationRecord> = {}
    for (const [k, v] of Object.entries(raw)) out[k] = toIntegrationRecord(v)
    return out
  } catch {
    return {}
  }
}

async function writeIntegrations(projectPath: string, integrations: Record<string, IntegrationRecord>): Promise<void> {
  await ensureDir(`${projectPath}/wiki`)
  await window.electronAPI.writeFile(`${projectPath}/wiki/integrations.json`, JSON.stringify(integrations, null, 2))
}

/** Write (overwrite) a chapter's integration record. */
export async function recordIntegration(projectPath: string, chapterId: string, record: IntegrationRecord): Promise<void> {
  const integrations = await loadIntegrations(projectPath)
  integrations[chapterId] = record
  await writeIntegrations(projectPath, integrations)
}

/** Merge applied ops into a chapter's record (used when accepting a queued suggestion). */
export async function mergeIntegration(
  projectPath: string, chapterId: string,
  partial: { created?: IntegrationRecord['created']; appended?: IntegrationRecord['appended']; alerts?: string[] }
): Promise<void> {
  const integrations = await loadIntegrations(projectPath)
  const cur = integrations[chapterId] ?? { at: today(), created: [], appended: [], alerts: [] }
  integrations[chapterId] = {
    at: cur.at || today(),
    created: [...cur.created, ...(partial.created ?? [])],
    appended: [...cur.appended, ...(partial.appended ?? [])],
    alerts: [...cur.alerts, ...(partial.alerts ?? [])]
  }
  await writeIntegrations(projectPath, integrations)
}

export async function removeIntegration(projectPath: string, chapterId: string): Promise<void> {
  const integrations = await loadIntegrations(projectPath)
  delete integrations[chapterId]
  await writeIntegrations(projectPath, integrations)
}

export async function markChapterIntegrated(projectPath: string, chapterId: string): Promise<void> {
  await ensureDir(`${projectPath}/wiki`)
  const integrations = await loadIntegrations(projectPath)
  integrations[chapterId] = { at: new Date().toISOString(), created: [], appended: [], alerts: [] }
  await window.electronAPI.writeFile(`${projectPath}/wiki/integrations.json`, JSON.stringify(integrations, null, 2))
}

/**
 * Prepare the wiki for an external agent (Claude Code): create the category folders
 * and write wiki/CLAUDE.md (the operating manual). Returns the doc's path.
 */
export async function writeAgentDoc(projectPath: string, projectName: string, author: string): Promise<string> {
  await ensureDir(`${projectPath}/wiki`)
  for (const category of WIKI_CATEGORIES) {
    await ensureDir(`${projectPath}/wiki/${category}`)
  }
  const path = `${projectPath}/wiki/CLAUDE.md`
  await window.electronAPI.writeFile(path, buildWikiAgentDoc(projectName, author))
  return path
}

/**
 * Content catalog (LLM Wiki pattern): all fiches by category, title + one-line
 * summary + wikilink. Regenerated on ingest; aids navigation and ask_bible context.
 */
export async function writeWikiIndex(projectPath: string, fiches: Fiche[]): Promise<void> {
  await ensureDir(`${projectPath}/wiki`)
  const oneLine = (f: Fiche): string => {
    const line = (f.body || '').split('\n').map(s => s.trim()).find(s => s.length > 0) ?? ''
    return line.length > 120 ? line.slice(0, 117) + '…' : line
  }
  let md = '# Index\n\n'
  for (const category of WIKI_CATEGORIES) {
    const inCat = fiches.filter(f => f.category === category).sort((a, b) => a.title.localeCompare(b.title))
    if (!inCat.length) continue
    md += `## ${category}\n\n`
    for (const f of inCat) {
      const summary = oneLine(f)
      md += `- [[${category}/${f.slug}|${f.title}]]${summary ? ` — ${summary}` : ''}\n`
    }
    md += '\n'
  }
  await window.electronAPI.writeFile(`${projectPath}/wiki/index.md`, md)
}
