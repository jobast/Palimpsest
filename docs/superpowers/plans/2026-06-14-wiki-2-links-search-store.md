# Wiki W2 (liens & recherche) + W1b (store disque) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Ajouter (W2) les wikilinks + le graphe + la recherche plein-texte des fiches (purs, testés), et (W1b) la couche disque renderer qui lit/écrit `wiki/*` via electronAPI en s'appuyant sur le cœur W1.

**Architecture:** W2 = modules purs `src/shared/wiki/links.ts` + `search.ts` (port du `wiki_links.py` Qt), testés `node:test`. W1b = `src/renderer/lib/wiki/wikiIO.ts` (glu IPC, vérif runtime) utilisant les codecs purs W1 + `window.electronAPI` + le journal de sauvegarde existant.

**Tech Stack:** TypeScript, `node:test`. Branche `feat/wiki`. Préfixer node par `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`. Tests `npm run test:main` (66 verts). Imports `src/shared/` en `.js`.

---

## Structure des fichiers
**Créés (W2, purs) :** `src/shared/wiki/links.ts`, `src/shared/wiki/search.ts` + tests `wiki.links.test.ts`, `wiki.search.test.ts`. Baril `src/shared/wiki/index.ts` étendu.
**Créés (W1b, renderer) :** `src/renderer/lib/wiki/wikiIO.ts`.

---

### Task 1 : Wikilinks + graphe (pur)

**Files:**
- Create: `src/shared/wiki/links.ts`
- Test: `src/main/__tests__/wiki.links.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/main/__tests__/wiki.links.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { extractWikilinks, resolveWikilink, backlinks, buildGraph } from '../../shared/wiki/links.js'
import type { Fiche } from '../../shared/wiki/types.js'

const f = (category: Fiche['category'], slug: string, title: string, body = ''): Fiche =>
  ({ slug, category, title, created: '2026-06-14', body })

test('extractWikilinks handles target and target|display', () => {
  const links = extractWikilinks('Voir [[kiran]] et [[lieux/laikipia|Laikipia]].')
  assert.equal(links.length, 2)
  assert.deepEqual({ t: links[0].target, d: links[0].display }, { t: 'kiran', d: 'kiran' })
  assert.deepEqual({ t: links[1].target, d: links[1].display }, { t: 'lieux/laikipia', d: 'Laikipia' })
})

test('resolveWikilink: exact path, then unique slug, then title (accent/case-insensitive)', () => {
  const fiches = [f('personnages', 'kiran', 'Kiran'), f('lieux', 'laikipia', 'Laikipia')]
  assert.equal(resolveWikilink('lieux/laikipia', fiches)?.slug, 'laikipia')
  assert.equal(resolveWikilink('kiran', fiches)?.slug, 'kiran')              // unique slug
  assert.equal(resolveWikilink('LAÏKIPIA', fiches)?.slug, 'laikipia')        // by title, normalized
  assert.equal(resolveWikilink('inconnu', fiches), null)
})

test('resolveWikilink returns null on ambiguous slug', () => {
  const fiches = [f('personnages', 'x', 'Perso X'), f('lieux', 'x', 'Lieu X')]
  assert.equal(resolveWikilink('x', fiches), null)
})

test('backlinks finds fiches linking to a target', () => {
  const fiches = [
    f('personnages', 'kiran', 'Kiran', 'ami de [[nkosigai]]'),
    f('personnages', 'nkosigai', 'Nkosigai', 'seule'),
    f('lieux', 'laikipia', 'Laikipia', 'terre de [[nkosigai]]')
  ]
  const target = fiches[1]
  const back = backlinks(target, fiches).map(x => x.slug).sort()
  assert.deepEqual(back, ['kiran', 'laikipia'])
})

test('buildGraph yields nodes and dedup edges, no self-loop', () => {
  const fiches = [
    f('personnages', 'kiran', 'Kiran', '[[nkosigai]] [[nkosigai]] [[kiran]]'),
    f('personnages', 'nkosigai', 'Nkosigai', '')
  ]
  const g = buildGraph(fiches)
  assert.equal(g.nodes.length, 2)
  assert.deepEqual(g.edges, [[0, 1]])   // dedup, self-link to kiran dropped
})
```

- [ ] **Step 2 : Lancer (échec)** — `npm run test:main`. Expected: FAIL — module `links.js` introuvable.

- [ ] **Step 3 : Implémenter** — Créer `src/shared/wiki/links.ts` :
```typescript
import type { Fiche } from './types.js'

export interface WikiLink { target: string; display: string; start: number; end: number }
export interface GraphData { nodes: Array<{ category: string; slug: string; title: string }>; edges: Array<[number, number]> }

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

const LINK_RE = /\[\[([^\[\]]+?)\]\]/g

/** Extract [[target]] / [[target|display]] with positions. */
export function extractWikilinks(body: string): WikiLink[] {
  const out: WikiLink[] = []
  let m: RegExpExecArray | null
  LINK_RE.lastIndex = 0
  while ((m = LINK_RE.exec(body)) !== null) {
    const inner = m[1]
    const pipe = inner.indexOf('|')
    const target = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim()
    const display = (pipe >= 0 ? inner.slice(pipe + 1) : inner).trim()
    if (!target) continue
    out.push({ target, display: display || target, start: m.index, end: m.index + m[0].length })
  }
  return out
}

/** Resolve a link target: (1) exact "category/slug", (2) unique slug, (3) title (normalized). */
export function resolveWikilink(target: string, fiches: Fiche[]): Fiche | null {
  const t = target.trim()
  if (t.includes('/')) {
    const [cat, slug] = t.split('/').map(s => s.trim())
    return fiches.find(fch => fch.category === cat && fch.slug === slug) ?? null
  }
  const bySlug = fiches.filter(fch => fch.slug === t)
  if (bySlug.length === 1) return bySlug[0]
  if (bySlug.length > 1) return null
  const nt = normalize(t)
  return fiches.find(fch => normalize(fch.title) === nt) ?? null
}

export function outgoingLinks(fiche: Fiche, fiches: Fiche[]): Fiche[] {
  const seen = new Set<string>()
  const res: Fiche[] = []
  for (const link of extractWikilinks(fiche.body)) {
    const target = resolveWikilink(link.target, fiches)
    if (target && target !== fiche) {
      const key = `${target.category}/${target.slug}`
      if (!seen.has(key)) { seen.add(key); res.push(target) }
    }
  }
  return res
}

export function backlinks(target: Fiche, fiches: Fiche[]): Fiche[] {
  return fiches.filter(fch => fch !== target && outgoingLinks(fch, fiches).includes(target))
}

/** Graph of fiches: nodes = fiches; edges = resolved outgoing links (dedup, no self-loop). */
export function buildGraph(fiches: Fiche[]): GraphData {
  const index = new Map<Fiche, number>()
  fiches.forEach((fch, i) => index.set(fch, i))
  const nodes = fiches.map(fch => ({ category: fch.category, slug: fch.slug, title: fch.title }))
  const edges: Array<[number, number]> = []
  const seen = new Set<string>()
  fiches.forEach((fch, from) => {
    for (const target of outgoingLinks(fch, fiches)) {
      const to = index.get(target)!
      if (to === from) continue
      const key = `${from}-${to}`
      if (!seen.has(key)) { seen.add(key); edges.push([from, to]) }
    }
  })
  return { nodes, edges }
}
```

- [ ] **Step 4 : Lancer (succès)** — `npm run test:main`. Expected: PASS (→ 71).

- [ ] **Step 5 : Commit**
```bash
git add src/shared/wiki/links.ts src/main/__tests__/wiki.links.test.ts
git commit -m "feat(wiki): wikilinks resolution, backlinks, graph (pure)"
```

---

### Task 2 : Recherche plein-texte des fiches (pur)

**Files:**
- Create: `src/shared/wiki/search.ts`
- Test: `src/main/__tests__/wiki.search.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/main/__tests__/wiki.search.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { searchFiches } from '../../shared/wiki/search.js'
import type { Fiche } from '../../shared/wiki/types.js'

const f = (slug: string, title: string, body: string): Fiche =>
  ({ slug, category: 'personnages', title, created: '2026-06-14', body })

test('search is accent/case-insensitive and scores by occurrences', () => {
  const fiches = [
    f('kiran', 'Kiran', 'Kiran rêve de la prophétie. La prophétie le hante.'),
    f('henry', 'Henry', 'Henry parle une fois de prophetie.')
  ]
  const hits = searchFiches(fiches, 'prophétie')
  assert.equal(hits.length, 2)
  assert.equal(hits[0].slug, 'kiran')        // 2 occurrences ranks first
  assert.ok(hits[0].score >= hits[1].score)
  assert.match(hits[0].snippet, /prophétie/i)
})

test('short words and stopwords are ignored; no match yields empty', () => {
  const fiches = [f('x', 'X', 'le la et un texte')]
  assert.deepEqual(searchFiches(fiches, 'le la'), [])     // only stopwords/short
  assert.deepEqual(searchFiches(fiches, 'zzzz'), [])
})

test('matches title too', () => {
  const fiches = [f('laikipia', 'Laikipia', 'rien'), f('nairobi', 'Nairobi', 'rien')]
  const hits = searchFiches(fiches, 'laikipia')
  assert.equal(hits[0].slug, 'laikipia')
})
```

- [ ] **Step 2 : Lancer (échec)** — `npm run test:main`. Expected: FAIL — module `search.js` introuvable.

- [ ] **Step 3 : Implémenter** — Créer `src/shared/wiki/search.ts` :
```typescript
import type { Fiche, WikiCategory } from './types.js'

export interface SearchHit {
  category: WikiCategory
  slug: string
  title: string
  score: number
  snippet: string
}

const STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'que', 'qui',
  'dans', 'pour', 'par', 'sur', 'avec', 'sans', 'ses', 'son', 'sa', 'ces', 'cet',
  'the', 'and', 'for', 'with'
])

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function queryTerms(query: string): string[] {
  const terms = normalize(query).split(/\W+/).filter(t => t.length >= 3 && !STOPWORDS.has(t))
  return Array.from(new Set(terms))
}

function snippet(text: string, normText: string, term: string, width = 120): string {
  const i = normText.indexOf(term)
  if (i < 0) return ''
  const start = Math.max(0, i - Math.floor(width / 2))
  const end = Math.min(text.length, start + width)
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '')
}

/** Full-text search over fiche title + body. Accent/case-insensitive, scored by occurrences. */
export function searchFiches(fiches: Fiche[], query: string): SearchHit[] {
  const terms = queryTerms(query)
  if (!terms.length) return []
  const hits: SearchHit[] = []
  for (const fiche of fiches) {
    const text = `${fiche.title}\n${fiche.body}`
    const norm = normalize(text)
    let score = 0
    let firstTerm = ''
    for (const term of terms) {
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
      const n = (norm.match(re) ?? []).length
      if (n > 0 && !firstTerm) firstTerm = term
      score += n
    }
    if (score > 0) {
      hits.push({
        category: fiche.category, slug: fiche.slug, title: fiche.title, score,
        snippet: snippet(text, norm, firstTerm)
      })
    }
  }
  hits.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
  return hits
}
```

- [ ] **Step 4 : Lancer (succès)** — `npm run test:main`. Expected: PASS (→ 74).

- [ ] **Step 5 : Étendre le baril** — Dans `src/shared/wiki/index.ts`, ajouter :
```typescript
export * from './links.js'
export * from './search.js'
```

- [ ] **Step 6 : Build + commit**
```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main
git add src/shared/wiki/search.ts src/shared/wiki/index.ts src/main/__tests__/wiki.search.test.ts
git commit -m "feat(wiki): full-text fiche search (pure) + barrel"
```

---

### Task 3 : Couche disque renderer (W1b)

**Files:**
- Create: `src/renderer/lib/wiki/wikiIO.ts`

> Glu IO (pas de harnais de test renderer → vérif par `npm run build` + revue). Utilise les codecs purs W1/W2 + `window.electronAPI` (`readDirectory/readFile/writeFile/deleteFile/createDirectory/exists`). Le `wiki/` vit sous `<projectPath>/wiki/`.

- [ ] **Step 1 : Implémenter `wikiIO.ts`**

Créer `src/renderer/lib/wiki/wikiIO.ts` :
```typescript
import {
  parseFiche, serializeFiche, type Fiche, type WikiCategory, WIKI_CATEGORIES,
  parseSuggestion, serializeSuggestion, type Suggestion,
  parseAlert, serializeAlert, type Alert,
  formatLogEntry, prependLogEntry
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

export async function appendLog(projectPath: string, action: string, subject: string, detail: string): Promise<void> {
  await ensureDir(`${projectPath}/wiki`)
  const path = `${projectPath}/wiki/log.md`
  const existing = await window.electronAPI.readFile(path)
  const current = existing.success && existing.content ? existing.content : ''
  await window.electronAPI.writeFile(path, prependLogEntry(current, formatLogEntry(action, subject, detail, today())))
}

export async function loadIntegrations(projectPath: string): Promise<Record<string, string>> {
  const r = await window.electronAPI.readFile(`${projectPath}/wiki/integrations.json`)
  if (!r.success || !r.content) return {}
  try { return JSON.parse(r.content) as Record<string, string> } catch { return {} }
}

export async function markChapterIntegrated(projectPath: string, chapterId: string): Promise<void> {
  await ensureDir(`${projectPath}/wiki`)
  const integrations = await loadIntegrations(projectPath)
  integrations[chapterId] = new Date().toISOString()
  await window.electronAPI.writeFile(`${projectPath}/wiki/integrations.json`, JSON.stringify(integrations, null, 2))
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
```

- [ ] **Step 2 : Vérifier compilation** — Run `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (vérifier que `@shared/wiki` et `@shared/markdown/filename` résolvent ; que `slugify` est bien exporté par `markdown/filename`), 74 tests verts.

- [ ] **Step 3 : Commit**
```bash
git add src/renderer/lib/wiki/wikiIO.ts
git commit -m "feat(wiki): renderer disk IO layer (fiches/suggestions/alerts/log/integrations)"
```

---

### Task 4 : Vérification
- [ ] **Step 1** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, ~74 tests verts.
- [ ] **Step 2** — Revue : W2 pur (pas de Date.now dans links/search) ; wikiIO utilise bien les codecs purs ; chemins `wiki/<cat>/<slug>.md`, `_suggestions/`, `_alertes/`, `log.md`, `integrations.json`.

## Auto-revue (couverture)
- Wikilinks extract/resolve/backlinks/graph → Task 1. ✅
- Recherche plein-texte fiches (normalisée, scorée, snippet) → Task 2. ✅ (recherche manuscrit = plus tard, nécessite documentContents)
- Store disque (fiches/suggestions/alertes/log/integrations) → Task 3. ✅
- Réutilise W1 (codecs) + markdown/filename (slug) → Tasks 1-3. ✅

## Cohérence des signatures
- `extractWikilinks(body): WikiLink[]`, `resolveWikilink(target, fiches): Fiche|null`, `backlinks(target, fiches): Fiche[]`, `buildGraph(fiches): GraphData`.
- `searchFiches(fiches, query): SearchHit[]`.
- wikiIO : `loadFiches/saveFiche/deleteFiche/createFiche`, `loadSuggestions/addSuggestions/deleteSuggestion`, `loadAlerts/saveAlert`, `appendLog`, `loadIntegrations/markChapterIntegrated`. Toutes prennent `projectPath` en 1er arg.
