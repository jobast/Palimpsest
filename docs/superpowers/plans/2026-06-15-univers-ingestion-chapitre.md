# Univers — Ingestion d'un chapitre (mode basique) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un bouton « Analyser ce chapitre » (barre d'outils Écriture) qui lit le chapitre ouvert, appelle le moteur d'analyse (sous-tranche 1, déjà fait), et en **mode basique auto** construit/enrichit les fiches de l'Univers + écrit un résumé dans le `synopsis` du chapitre.

**Architecture:** Cœur pur testable (extension du prompt avec un bloc `=== RESUME CHAPITRE ===` + `parseIngestOutput` + helpers d'application) ; un orchestrateur renderer `ingest.ts` (texte → prompt → `runEngine` → parse → applique via `wikiIO`/`wikiStore` → synopsis → log/index) ; un bouton dans `Toolbar.tsx`. Pas de batch, pas de file de revue, pas d'annulation (sous-tranches 3 et 4). On pose quand même le marqueur invisible `<!-- ingest:<chapterId> -->` sur les sections ajoutées pour rendre l'annulation future fiable.

**Tech Stack:** TS strict, React/Zustand, `node:test`. Branche `feat/wiki`. Préfixer node : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`. Tests `npm run test:main` (baseline **97 verts**). Build `npm run build`.

**Périmètre (décidé) :** un seul chapitre, **mode basique uniquement** (auto-applique). Bouton dans la **barre d'outils Écriture**. HORS périmètre : batch (sous-tranche 3), mode avancé + bouton « Annuler l'intégration » (sous-tranche 4), panneau droit de revue, ask.

**Briques existantes réutilisées (NE PAS recréer) :**
- `@shared/wiki` : `WIKI_SYSTEM_PROMPT`, `buildWikiUpdatePrompt(input)`, `parseSuggestionsBlock(text)`, `Suggestion`/`SuggestionType`, `Fiche`, `Alert`, `WIKI_CATEGORIES`, `addSourceToFiche(fiche,chapterId,today)`, `suggestionToAlert(s,today)`.
- `@shared/markdown` : `docToMarkdownBody(doc)`.
- `@/lib/wiki/wikiIO` : `createFiche(projectPath,category,title,body,existing)`, `saveFiche(projectPath,fiche)`, `saveAlert(projectPath,alert)`, `appendLog(projectPath,action,subject,detail)`, `markChapterIntegrated(projectPath,chapterId)`, `writeWikiIndex(projectPath,fiches)`, `loadAlerts`, `loadSuggestions`.
- `@/lib/wiki/engine` : `runEngine(system,user): Promise<string>` (sous-tranche 1, validée en runtime).
- `@/stores/wikiStore` : `ensureLoaded()`, `loadWiki(projectPath)`, état `fiches: Fiche[]`.
- `@/stores/projectStore` : `projectPath`, `project`, `activeDocumentId`, `updateManuscriptItem(id, Partial<ManuscriptItem>)`, `saveProject()`.
- `@/stores/editorStore` : `getDocumentContent(id): string|undefined` (JSON TipTap), `flushCurrentDocument(activeDocumentId)`.
- `@/stores/statsStore` : `showNotification(type, message)`.

---

### Task 1 : Pur — bloc `=== RESUME CHAPITRE ===` dans le prompt + `parseIngestOutput`

**Files:**
- Modify: `src/shared/wiki/ingestPrompt.ts`
- Test: `src/main/__tests__/wiki.ingest.test.ts`

Contexte : `parseSuggestionsBlock` (dans `suggestion.ts`) découpe sur `=== SUGGESTION ===` et lit déjà un champ par-suggestion `RESUME:`. Le **résumé du chapitre** est une chose DIFFÉRENTE : on utilise un délimiteur distinct `=== RESUME CHAPITRE ===` placé à la toute fin, et `parseIngestOutput` DÉTACHE ce bloc AVANT de passer le reste à `parseSuggestionsBlock` (sinon le résumé serait avalé dans le `CORPS` de la dernière suggestion).

- [ ] **Step 1 : test qui échoue** — Créer `src/main/__tests__/wiki.ingest.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseIngestOutput } from '../../shared/wiki/ingestPrompt.js'

const WITH_BOTH = `=== SUGGESTION ===
TYPE: nouvelle_fiche
CIBLE: personnages
TITRE: Jean
RESUME: un homme
CORPS:
Jean est grand.
=== SUGGESTION ===
TYPE: ajout
CIBLE: lieux/paris
TITRE: Paris
RESUME: la ville
CORPS:
Il pleut sur Paris.
=== RESUME CHAPITRE ===
Jean arrive à Paris sous la pluie. Il cherche un indice.`

test('parseIngestOutput separates suggestions from the chapter summary', () => {
  const { suggestions, summary } = parseIngestOutput(WITH_BOTH)
  assert.equal(suggestions.length, 2)
  assert.equal(suggestions[0].title, 'Jean')
  assert.equal(suggestions[1].type, 'ajout')
  // The chapter summary must NOT leak into the last suggestion body.
  assert.ok(!suggestions[1].body.includes('RESUME CHAPITRE'))
  assert.ok(!suggestions[1].body.includes('cherche un indice'))
  assert.equal(summary, 'Jean arrive à Paris sous la pluie. Il cherche un indice.')
})

test('parseIngestOutput: no summary marker -> empty summary, suggestions intact', () => {
  const txt = `=== SUGGESTION ===
TYPE: nouvelle_fiche
CIBLE: lieux
TITRE: Cave
RESUME: sombre
CORPS:
Une cave humide.`
  const { suggestions, summary } = parseIngestOutput(txt)
  assert.equal(suggestions.length, 1)
  assert.equal(summary, '')
})

test('parseIngestOutput: AUCUNE SUGGESTION + summary -> no suggestions, summary kept', () => {
  const txt = `AUCUNE SUGGESTION
=== RESUME CHAPITRE ===
Chapitre de transition, rien de neuf.`
  const { suggestions, summary } = parseIngestOutput(txt)
  assert.deepEqual(suggestions, [])
  assert.equal(summary, 'Chapitre de transition, rien de neuf.')
})

test('parseIngestOutput tolerates a totally empty output', () => {
  const { suggestions, summary } = parseIngestOutput('')
  assert.deepEqual(suggestions, [])
  assert.equal(summary, '')
})
```

- [ ] **Step 2 : run (fail)** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run test:main`. Expected: FAIL (`parseIngestOutput` n'existe pas).

- [ ] **Step 3 : implémenter** — Dans `src/shared/wiki/ingestPrompt.ts` :
  - En tête de fichier, ajouter les imports :
```typescript
import { parseSuggestionsBlock } from './suggestion.js'
import type { Suggestion } from './types.js'
```
  - Remplacer la constante `FORMAT` pour qu'elle exige le bloc résumé à la fin :
```typescript
const FORMAT = `FORMAT DE SORTIE — exactement ces blocs, séparés par une ligne « === SUGGESTION === » :

=== SUGGESTION ===
TYPE: <nouvelle_fiche | ajout | incoherence>
CIBLE: <categorie pour une nouvelle fiche, ou categorie/slug pour un ajout, ou vide>
TITRE: <titre de la fiche concernée>
RESUME: <une ligne>
CORPS:
<contenu proposé, fondé sur le texte>

Émets autant de blocs que nécessaire. Si tu n'as STRICTEMENT rien à proposer pour la bible, écris « AUCUNE SUGGESTION » à la place des blocs.

ENFIN, termine TOUJOURS ta réponse par cette ligne exacte, suivie d'un résumé succinct du chapitre (2 à 4 phrases, factuel, en français) :

=== RESUME CHAPITRE ===
<résumé du chapitre>`
```
  - À la fin du fichier, ajouter :
```typescript
/**
 * Parse the full ingest output: suggestions + the trailing chapter summary.
 * The "=== RESUME CHAPITRE ===" block is split off BEFORE parsing suggestions
 * so it can never leak into the last suggestion body.
 */
export function parseIngestOutput(text: string): { suggestions: Suggestion[]; summary: string } {
  const marker = /^[ \t]*===\s*RESUME CHAPITRE\s*===[ \t]*$/m
  const m = marker.exec(text)
  let suggestionsText = text
  let summary = ''
  if (m) {
    suggestionsText = text.slice(0, m.index)
    summary = text.slice(m.index + m[0].length).trim()
  }
  return { suggestions: parseSuggestionsBlock(suggestionsText), summary }
}
```

- [ ] **Step 4 : run (pass)** — `npm run test:main`. Expected: PASS, baseline+4 (≈101).

- [ ] **Step 5 : commit**
```bash
git add src/shared/wiki/ingestPrompt.ts src/main/__tests__/wiki.ingest.test.ts
git commit -m "feat(univers): chapter-summary block in ingest prompt + parseIngestOutput (pure)"
```

---

### Task 2 : Pur — helpers d'application (`buildFichesSummary`, `appendIngestSection`)

**Files:**
- Modify: `src/shared/wiki/ingestPrompt.ts` (ajout `buildFichesSummary`)
- Modify: `src/shared/wiki/fiche.ts` (ajout `appendIngestSection`)
- Test: `src/main/__tests__/wiki.ingestApply.test.ts`

- [ ] **Step 1 : test qui échoue** — Créer `src/main/__tests__/wiki.ingestApply.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFichesSummary } from '../../shared/wiki/ingestPrompt.js'
import { appendIngestSection } from '../../shared/wiki/fiche.js'
import type { Fiche } from '../../shared/wiki/types.js'

const fiche = (over: Partial<Fiche>): Fiche => ({
  slug: 'jean', category: 'personnages', title: 'Jean', created: '2026-06-15', body: '', ...over
})

test('buildFichesSummary groups titles by category', () => {
  const out = buildFichesSummary([
    fiche({ slug: 'jean', title: 'Jean', category: 'personnages' }),
    fiche({ slug: 'paris', title: 'Paris', category: 'lieux' })
  ])
  assert.ok(out.includes('personnages'))
  assert.ok(out.includes('Jean'))
  assert.ok(out.includes('lieux'))
  assert.ok(out.includes('Paris'))
})

test('buildFichesSummary on empty list returns a non-empty placeholder', () => {
  const out = buildFichesSummary([])
  assert.ok(out.trim().length > 0)
})

test('appendIngestSection appends a marked, dated section and preserves the body', () => {
  const f = fiche({ body: 'Corps existant.' })
  const out = appendIngestSection(f, 'ch-12', 'Nouvelle info.', '2026-06-15')
  assert.ok(out.body.startsWith('Corps existant.'))
  assert.ok(out.body.includes('<!-- ingest:ch-12 -->'))
  assert.ok(out.body.includes('Nouvelle info.'))
  assert.equal(out.lastUpdated, '2026-06-15')
})

test('appendIngestSection works when the body is empty', () => {
  const out = appendIngestSection(fiche({ body: '' }), 'ch-1', 'Première info.', '2026-06-15')
  assert.ok(out.body.includes('<!-- ingest:ch-1 -->'))
  assert.ok(out.body.includes('Première info.'))
})
```

- [ ] **Step 2 : run (fail)** — `npm run test:main`. Expected: FAIL (helpers absents).

- [ ] **Step 3a : implémenter `buildFichesSummary`** — Dans `src/shared/wiki/ingestPrompt.ts`, ajouter (le type `Fiche` et `WIKI_CATEGORIES` viennent de `./types.js` — adapter l'import existant en tête : `import type { Suggestion } from './types.js'` devient `import { WIKI_CATEGORIES, type Suggestion, type Fiche } from './types.js'`) :
```typescript
/** Human-readable digest of existing fiches (titles grouped by category) for the prompt. */
export function buildFichesSummary(fiches: Fiche[]): string {
  if (!fiches.length) return 'Aucune fiche pour l\'instant (la bible est vide).'
  let out = ''
  for (const category of WIKI_CATEGORIES) {
    const inCat = fiches.filter(f => f.category === category)
    if (!inCat.length) continue
    out += `## ${category}\n`
    for (const f of inCat) out += `- ${f.title} (${category}/${f.slug})\n`
  }
  return out.trim()
}
```

- [ ] **Step 3b : implémenter `appendIngestSection`** — Dans `src/shared/wiki/fiche.ts`, ajouter à la fin :
```typescript
/**
 * Append a dated section to a fiche body, tagged with an invisible marker
 * `<!-- ingest:<chapterId> -->` so a future "undo integration" can remove
 * exactly this section. Refreshes lastUpdated.
 */
export function appendIngestSection(fiche: Fiche, chapterId: string, sectionBody: string, today: string): Fiche {
  const section = `<!-- ingest:${chapterId} -->\n_(${today})_\n${sectionBody.trim()}`
  const base = fiche.body.trim()
  const body = base ? `${base}\n\n${section}\n` : `${section}\n`
  return { ...fiche, body, lastUpdated: today }
}
```

- [ ] **Step 4 : run (pass)** — `npm run test:main`. Expected: PASS, baseline+8 (≈105).

- [ ] **Step 5 : commit**
```bash
git add src/shared/wiki/ingestPrompt.ts src/shared/wiki/fiche.ts src/main/__tests__/wiki.ingestApply.test.ts
git commit -m "feat(univers): pure ingest apply helpers (fiches summary + marked section)"
```

---

### Task 3 : Orchestrateur renderer `ingestChapter` (mode basique)

**Files:**
- Create: `src/renderer/lib/wiki/ingest.ts`

Pas de test auto (couche IO/IA, comme `wikiIO` → vérif runtime). Vérification = build propre.

- [ ] **Step 1 : créer le fichier** — `src/renderer/lib/wiki/ingest.ts` :
```typescript
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

/** Chapter text as plain markdown (flush the live editor first so we read latest). */
function getChapterText(chapterId: string): string {
  const editor = useEditorStore.getState()
  editor.flushCurrentDocument(useProjectStore.getState().activeDocumentId)
  const raw = editor.getDocumentContent(chapterId)
  if (!raw) return ''
  try {
    return docToMarkdownBody(JSON.parse(raw))
  } catch {
    return ''
  }
}

/** Resolve an "ajout" target by "categorie/slug" then by title (case-insensitive). */
function findFicheByCible(fiches: Fiche[], cible: string, title: string): Fiche | null {
  if (cible.includes('/')) {
    const [cat, slug] = cible.split('/')
    const hit = fiches.find(f => f.category === cat && f.slug === slug)
    if (hit) return hit
  }
  return fiches.find(f => f.title.toLowerCase() === title.toLowerCase()) ?? null
}

/**
 * Analyze one chapter and auto-apply the result to the Univers (basic mode):
 * nouvelle_fiche -> create ; ajout -> append marked section + source ; incoherence -> alert.
 * Also writes a chapter summary into the chapter synopsis. Returns counts.
 */
export async function ingestChapter(chapterId: string): Promise<IngestResult> {
  const projectPath = useProjectStore.getState().projectPath
  const project = useProjectStore.getState().project
  if (!projectPath || !project) throw new Error('Aucun projet ouvert')
  const item = findItem(project.manuscript.items, chapterId)
  if (!item) throw new Error('Chapitre introuvable')
  const chapterText = getChapterText(chapterId)
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
```

- [ ] **Step 2 : build** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (résoudre les imports : vérifier le chemin de `ManuscriptItem` — `@shared/types/project` ; si l'alias n'est pas configuré pour `@shared/types`, regarder comment `projectStore.ts` importe `ManuscriptItem` et copier ce specifier. Vérifier aussi que `docToMarkdownBody` s'importe bien de `@shared/markdown` — sinon lire `src/shared/markdown/index.ts`/`body.ts` et adapter). Aucun import inutilisé. Tests inchangés (≈105).

- [ ] **Step 3 : commit**
```bash
git add src/renderer/lib/wiki/ingest.ts
git commit -m "feat(univers): ingestChapter orchestrator (basic mode, auto-apply + synopsis)"
```

---

### Task 4 : Bouton « Analyser ce chapitre » dans la barre d'outils

**Files:**
- Modify: `src/renderer/components/layout/Toolbar.tsx`

- [ ] **Step 1 : imports** — En tête de `Toolbar.tsx` :
  - Ajouter `import { useState } from 'react'`.
  - Ajouter à l'import `lucide-react` les icônes `Sparkles` et `Loader2`.
  - Ajouter `import { ingestChapter } from '@/lib/wiki/ingest'`.

- [ ] **Step 2 : state + handler** — Dans le composant `Toolbar`, après `const { saveProject, isDirty } = useProjectStore()` (ligne ~34), ajouter :
```typescript
  const activeDocumentId = useProjectStore(s => s.activeDocumentId)
  const showNotification = useStatsStore(s => s.showNotification)
  const [analyzing, setAnalyzing] = useState(false)

  const handleAnalyzeChapter = async () => {
    if (!activeDocumentId) { showNotification('error', 'Ouvre un chapitre à analyser'); return }
    setAnalyzing(true)
    try {
      const r = await ingestChapter(activeDocumentId)
      const extra = r.ignored ? `, ${r.ignored} ignorée(s)` : ''
      showNotification('success',
        `Univers mis à jour : ${r.fichesCreated} fiche(s) créée(s), ${r.fichesUpdated} enrichie(s), ${r.alerts} alerte(s)${extra}.`)
    } catch (e) {
      showNotification('error', `Analyse KO : ${e instanceof Error ? e.message : 'erreur'}`)
    } finally {
      setAnalyzing(false)
    }
  }
```
  (`useStatsStore` est déjà importé en haut du fichier ; `useProjectStore` aussi.)

- [ ] **Step 3 : bouton** — Juste après le `<ToolbarSeparator />` qui suit le bouton Save (ligne ~59), insérer :
```tsx
      {/* Analyse du chapitre vers l'Univers */}
      <ToolbarButton
        icon={analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        onClick={() => { void handleAnalyzeChapter() }}
        disabled={analyzing}
        title="Analyser ce chapitre dans l'Univers"
      />

      <ToolbarSeparator />
```

- [ ] **Step 4 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (pas d'import inutilisé), tests ≈105 verts.

- [ ] **Step 5 : commit**
```bash
git add src/renderer/components/layout/Toolbar.tsx
git commit -m "feat(univers): 'Analyser ce chapitre' toolbar button (basic ingestion)"
```

---

### Task 5 : Vérification

- [ ] **Step 1** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, ≈105 verts.
- [ ] **Step 2 (manuel, sur `~/Desktop/Savana.palim`)** — `npm run launch:dev` : ouvrir un chapitre, choisir le moteur (Univers : « Claude (abonnement) » ou API), cliquer **Sparkles** « Analyser ce chapitre » dans la barre d'outils. Attendu : notification « Univers mis à jour : N créée(s)… » ; les fiches apparaissent dans la section Univers (Personnages/Lieux/Intrigues) ; le `synopsis` du chapitre est rempli (visible dans le manuscrit) ; `wiki/log.md`, `wiki/index.md`, `wiki/integrations.json` mis à jour. Vérifier qu'une section ajoutée porte le marqueur `<!-- ingest:<id> -->` (dans `wiki/<cat>/<slug>.md`).
- [ ] **Step 3 (si correctifs)** — `git add -A && git commit -m "fix(univers): chapter ingestion adjustments from manual test"`

## Auto-revue (couverture vs spec)
- Pipeline chapitre (texte → contexte → moteur → parse → sortie) → Tasks 1+3. ✅
- Résumé du chapitre dans le `synopsis` → Task 3 (`updateManuscriptItem` + `saveProject`). ✅
- Mode basique auto (nouvelle_fiche/ajout/incoherence) → Task 3. ✅
- Marqueur invisible `<!-- ingest:<chapterId> -->` (fondation de l'annulation future) → Task 2 `appendIngestSection`. ✅
- Journal + index + integrations → Task 3 (`appendLog`/`writeWikiIndex`/`markChapterIntegrated`). ✅
- Déclencheur UI = bouton barre d'outils Écriture → Task 4. ✅
- Gestion d'erreurs (pas de projet/chapitre vide/sortie non parsable = 0 suggestion, jamais d'exception non gérée) → Tasks 1+3+4. ✅
- HORS périmètre (assumé) : batch (sous-tranche 3) ; mode avancé + file de revue + bouton « Annuler l'intégration » (sous-tranche 4) ; déclencheur continu au changement de chapitre ; panneau droit ; ask.

## Cohérence des signatures
- `parseIngestOutput(text) -> { suggestions: Suggestion[]; summary: string }` — Task 1, utilisé Task 3.
- `buildFichesSummary(fiches: Fiche[]) -> string` — Task 2, utilisé Task 3.
- `appendIngestSection(fiche, chapterId, sectionBody, today) -> Fiche` — Task 2, utilisé Task 3.
- `ingestChapter(chapterId) -> Promise<IngestResult>` — Task 3, utilisé Task 4.
- Réutilisés tels quels : `buildWikiUpdatePrompt`, `WIKI_SYSTEM_PROMPT`, `parseSuggestionsBlock`, `addSourceToFiche`, `suggestionToAlert`, `runEngine`, et tout `wikiIO`.
