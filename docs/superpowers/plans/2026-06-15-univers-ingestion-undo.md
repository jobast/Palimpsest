# Univers — Annuler l'intégration d'un chapitre (4b) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un bouton « Annuler l'intégration » (barre d'outils Écriture, visible quand le chapitre ouvert est intégré) qui défait tout ce qu'un chapitre a écrit dans l'Univers - en **basique** comme en **avancé** : supprimer les fiches créées, retirer les sections ajoutées (marqueur `<!-- ingest:<id> -->`), supprimer les alertes, et désintégrer le chapitre.

**Architecture:** On fait évoluer `integrations.json` de `{chapterId: timestamp}` vers un **journal structuré** `{chapterId: { at, created[], appended[], alerts[] }}` (rétro-compatible). `applyOneSuggestion` renvoie une **référence** de ce qu'il a écrit ; `ingestChapter` (basique) et `applySuggestion` (acceptation avancée) alimentent le journal ; `undoChapterIntegration` le rejoue à l'envers. UI : bouton dans `Toolbar` quand `wikiStore.integrations[activeDocumentId]` existe.

**Tech Stack:** TS strict, React/Zustand, `node:test`. Branche `feat/wiki`. Préfixer node : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`. Tests `npm run test:main` (baseline **108 verts**). Build `npm run build`.

**Périmètre (décidé) :** annulation par chapitre (bouton barre d'outils), couvre basique ET avancé. HORS périmètre : annulation par entrée de log, « tout réanalyser », Couche 2.

**État actuel utile :**
- `appendIngestSection(fiche, chapterId, body, today)` ajoute une section `<!-- ingest:${chapterId} -->\n_(date)_\n<body>` (séparée par `\n\n`). L'inverse = `removeIngestSection` (Task 1).
- `applyOneSuggestion(projectPath, s, chapterId, working, day)` (privé, `ingest.ts`) renvoie `{ working, created, updated, alerts, ignored }` - on lui ajoute un `ref`.
- `ingestChapter` appelle `markChapterIntegrated(projectPath, chapterId)` (basique ligne ~174, avancé ligne ~145) - à remplacer par `recordIntegration`.
- `loadIntegrations` (wikiIO) renvoie `Record<string,string>` ; seul `chaptersToAnalyze(items, integrated)` (qui teste `!integrated[id]`) et `analyzeManuscript` le consomment.
- `wikiIO` : `loadFiches`, `saveFiche`, `deleteFiche`, `loadAlerts`, `saveAlert` (PAS de `deleteAlert` - à créer), `writeWikiIndex`.

---

### Task 1 : Pur — types journal + `removeIngestSection` + `toIntegrationRecord`

**Files:**
- Modify: `src/shared/wiki/types.ts`
- Create: `src/shared/wiki/integration.ts`
- Modify: `src/shared/wiki/fiche.ts`
- Modify: `src/shared/wiki/index.ts` (baril)
- Test: `src/main/__tests__/wiki.undo.test.ts`

- [ ] **Step 1 : test qui échoue** — Créer `src/main/__tests__/wiki.undo.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { removeIngestSection } from '../../shared/wiki/fiche.js'
import { toIntegrationRecord, emptyIntegrationRecord } from '../../shared/wiki/integration.js'

test('removeIngestSection drops the marked section, keeps the rest', () => {
  const body = 'Intro.\n\n<!-- ingest:ch-1 -->\n_(2026-06-15)_\nFait A.'
  assert.equal(removeIngestSection(body, 'ch-1'), 'Intro.')
})

test('removeIngestSection keeps other chapters sections', () => {
  const body = '<!-- ingest:ch-1 -->\n_(d)_\nA.\n\n<!-- ingest:ch-2 -->\n_(d)_\nB.'
  const out = removeIngestSection(body, 'ch-1')
  assert.ok(!out.includes('ingest:ch-1'))
  assert.ok(out.includes('<!-- ingest:ch-2 -->'))
  assert.ok(out.includes('B.'))
})

test('removeIngestSection on a body without that marker is unchanged (trimmed)', () => {
  assert.equal(removeIngestSection('Juste du corps.', 'ch-9'), 'Juste du corps.')
})

test('toIntegrationRecord coerces a legacy timestamp string', () => {
  assert.deepEqual(toIntegrationRecord('2026-06-15T10:00:00Z'),
    { at: '2026-06-15T10:00:00Z', created: [], appended: [], alerts: [] })
})

test('toIntegrationRecord preserves a structured record', () => {
  const rec = { at: 'd', created: [{ category: 'personnages', slug: 'jean' }], appended: [], alerts: ['a1'] }
  assert.deepEqual(toIntegrationRecord(rec), rec)
})

test('toIntegrationRecord on garbage returns an empty record', () => {
  assert.deepEqual(toIntegrationRecord(null), { at: '', created: [], appended: [], alerts: [] })
})

test('emptyIntegrationRecord stamps at and empties arrays', () => {
  assert.deepEqual(emptyIntegrationRecord('d'), { at: 'd', created: [], appended: [], alerts: [] })
})
```

- [ ] **Step 2 : run (fail)** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run test:main`. Expected: FAIL (modules/exports absents).

- [ ] **Step 3 : types** — Dans `src/shared/wiki/types.ts`, ajouter (après les types existants ; `WikiCategory` y est défini) :
```typescript
export interface FicheRef { category: WikiCategory; slug: string }
export interface IntegrationRecord {
  at: string
  created: FicheRef[]
  appended: FicheRef[]
  alerts: string[]
}
```

- [ ] **Step 4 : integration.ts** — Créer `src/shared/wiki/integration.ts` :
```typescript
import type { FicheRef, IntegrationRecord } from './types.js'

export function emptyIntegrationRecord(at: string): IntegrationRecord {
  return { at, created: [], appended: [], alerts: [] }
}

function asRefs(v: unknown): FicheRef[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is FicheRef =>
    !!x && typeof x === 'object' && typeof (x as FicheRef).category === 'string' && typeof (x as FicheRef).slug === 'string')
}

/** Coerce a raw integrations.json value (legacy timestamp string OR structured record) to a record. */
export function toIntegrationRecord(value: unknown): IntegrationRecord {
  if (typeof value === 'string') return { at: value, created: [], appended: [], alerts: [] }
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>
    return {
      at: typeof v.at === 'string' ? v.at : '',
      created: asRefs(v.created),
      appended: asRefs(v.appended),
      alerts: Array.isArray(v.alerts) ? v.alerts.filter((x): x is string => typeof x === 'string') : []
    }
  }
  return { at: '', created: [], appended: [], alerts: [] }
}
```

- [ ] **Step 5 : removeIngestSection** — Dans `src/shared/wiki/fiche.ts`, ajouter à la fin :
```typescript
/** Inverse of appendIngestSection: drop every section tagged `<!-- ingest:<chapterId> -->`. */
export function removeIngestSection(body: string, chapterId: string): string {
  const marker = `<!-- ingest:${chapterId} -->`
  const anyMarker = /^<!-- ingest:.* -->$/
  const out: string[] = []
  let skipping = false
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (anyMarker.test(trimmed)) {
      skipping = trimmed === marker
      if (skipping) continue        // drop our own marker line
      // a different chapter's marker: stop skipping and keep it
    }
    if (skipping) continue
    out.push(line)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
```

- [ ] **Step 6 : baril** — Dans `src/shared/wiki/index.ts`, ajouter `export * from './integration.js'`.

- [ ] **Step 7 : run (pass)** — `npm run test:main`. Expected: PASS, baseline+7 (≈115).

- [ ] **Step 8 : commit**
```bash
git add src/shared/wiki/types.ts src/shared/wiki/integration.ts src/shared/wiki/fiche.ts src/shared/wiki/index.ts src/main/__tests__/wiki.undo.test.ts
git commit -m "feat(univers): integration journal types + removeIngestSection (pure)"
```

---

### Task 2 : wikiIO — journal structuré + `deleteAlert`

**Files:**
- Modify: `src/renderer/lib/wiki/wikiIO.ts`
- Modify: `src/shared/manuscript/order.ts` (relax du type de `chaptersToAnalyze`)

Build-vérifiée.

- [ ] **Step 1 : relax `chaptersToAnalyze`** — Dans `src/shared/manuscript/order.ts`, changer la signature `export function chaptersToAnalyze(items: ManuscriptItem[], integrated: Record<string, string>)` en `integrated: Record<string, unknown>` (le corps ne fait que `!integrated[item.id]`, inchangé ; les tests existants passent toujours).

- [ ] **Step 2 : wikiIO** — Dans `src/renderer/lib/wiki/wikiIO.ts` :
  - Imports : ajouter `toIntegrationRecord, type IntegrationRecord` à l'import `@shared/wiki`.
  - REMPLACER `loadIntegrations` et `markChapterIntegrated` par :
```typescript
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
```
  - Ajouter, près de `saveAlert` :
```typescript
export async function deleteAlert(projectPath: string, id: string): Promise<void> {
  await window.electronAPI.deleteFile(`${projectPath}/wiki/${ALERT_DIR}/${id}.md`)
}
```
  (`ALERT_DIR` et `today()` existent déjà dans ce fichier. **GARDER `markChapterIntegrated` tel quel** pour l'instant - il est encore appelé par `ingest.ts` ; sa suppression et la migration des appelants se font en Task 3, pour que le build reste vert à CHAQUE commit. La seule chose qui pourrait casser `ingest.ts` ici est le changement de type de retour de `loadIntegrations` ; le relax de `chaptersToAnalyze` en Step 1 l'absorbe - `Record<string, IntegrationRecord>` est assignable à `Record<string, unknown>`.)

- [ ] **Step 3 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: **build OK** (vert : `markChapterIntegrated` existe encore, le relax de `chaptersToAnalyze` absorbe le nouveau type de `loadIntegrations`), ≈115 verts.

- [ ] **Step 4 : commit**
```bash
git add src/renderer/lib/wiki/wikiIO.ts src/shared/manuscript/order.ts
git commit -m "feat(univers): structured integration journal in wikiIO + deleteAlert"
```

---

### Task 3 : ingest.ts — refs + journalisation + `undoChapterIntegration`

**Files:**
- Modify: `src/renderer/lib/wiki/ingest.ts`

Build-vérifiée. Revue attentive.

**Files:** Modify `src/renderer/lib/wiki/ingest.ts` AND `src/renderer/lib/wiki/wikiIO.ts` (supprimer `markChapterIntegrated` devenu inutilisé).

- [ ] **Step 1 : imports** — Dans `src/renderer/lib/wiki/ingest.ts` :
  - Dans l'import `@/lib/wiki/wikiIO` : RETIRER `markChapterIntegrated` ; AJOUTER `recordIntegration, mergeIntegration, removeIntegration, deleteAlert, loadFiches, deleteFiche as ioDeleteFiche`.
  - Dans l'import `@shared/wiki` : ajouter `removeIngestSection, emptyIntegrationRecord, type IntegrationRecord, type FicheRef`.

- [ ] **Step 2 : `applyOneSuggestion` renvoie un `ref`** — Ajouter le type (au-dessus de la fonction) et l'inclure dans le retour :
```typescript
type ApplyRef =
  | { kind: 'created'; category: WikiCategory; slug: string }
  | { kind: 'appended'; category: WikiCategory; slug: string }
  | { kind: 'alert'; alertId: string }
  | { kind: 'ignored' }
```
  Modifier la signature de retour de `applyOneSuggestion` en `Promise<{ working: Fiche[]; created: number; updated: number; alerts: number; ignored: number; ref: ApplyRef }>` et chaque `return` :
  - nouvelle_fiche : `return { working: [...working, fiche], created: 1, updated: 0, alerts: 0, ignored: 0, ref: { kind: 'created', category: fiche.category, slug: fiche.slug } }`
  - ajout non trouvé : `return { working, created: 0, updated: 0, alerts: 0, ignored: 1, ref: { kind: 'ignored' } }`
  - ajout trouvé : `return { working: working.map(...), created: 0, updated: 1, alerts: 0, ignored: 0, ref: { kind: 'appended', category: f.category, slug: f.slug } }`
  - incoherence : `return { working, created: 0, updated: 0, alerts: 1, ignored: 0, ref: { kind: 'alert', alertId: alert.id } }`

- [ ] **Step 3 : journaliser dans `ingestChapter`** — Branche AVANCÉ : remplacer `await markChapterIntegrated(projectPath, chapterId)` par `await recordIntegration(projectPath, chapterId, emptyIntegrationRecord(day))`.
  Branche BASIQUE : construire le record au fil de la boucle d'application, puis l'écrire à la place de `markChapterIntegrated`. Concrètement, modifier la boucle basique :
```typescript
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
```
  puis, dans la queue basique, remplacer `await markChapterIntegrated(projectPath, chapterId)` par `await recordIntegration(projectPath, chapterId, record)`.

- [ ] **Step 4 : journaliser l'acceptation (`applySuggestion`)** — Après l'application dans `applySuggestion`, merger le ref dans le journal du chapitre source :
```typescript
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
```

- [ ] **Step 5 : `undoChapterIntegration`** — Ajouter à la fin du fichier :
```typescript
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

  for (const ref of rec.created) {
    const f = fiches.find(x => x.category === ref.category && x.slug === ref.slug)
    if (f) { await ioDeleteFiche(projectPath, f); deleted += 1 }
  }
  for (const ref of rec.appended) {
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
```

- [ ] **Step 6 : supprimer `markChapterIntegrated` (devenu mort)** — Dans `src/renderer/lib/wiki/wikiIO.ts`, supprimer la fonction `markChapterIntegrated` (plus aucun appelant après les Steps 3-4). Vérifier par `grep -rn markChapterIntegrated src/` qu'il n'en reste aucune référence.

- [ ] **Step 7 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (le renderer recompile ; `markChapterIntegrated` n'est plus référencé nulle part), ≈115 verts.

- [ ] **Step 8 : commit**
```bash
git add src/renderer/lib/wiki/ingest.ts src/renderer/lib/wiki/wikiIO.ts
git commit -m "feat(univers): journal applied ops + undoChapterIntegration (basic + accept)"
```

---

### Task 4 : wikiStore `integrations` + bouton « Annuler l'intégration »

**Files:**
- Modify: `src/renderer/stores/wikiStore.ts`
- Modify: `src/renderer/components/layout/Toolbar.tsx`

Build-vérifiée + vérif manuelle.

- [ ] **Step 1 : wikiStore** — Dans `src/renderer/stores/wikiStore.ts` :
  - Imports : ajouter `loadIntegrations` à l'import `@/lib/wiki/wikiIO` ; ajouter `undoChapterIntegration` depuis `@/lib/wiki/ingest` (NB : `wikiStore` importe `ingest` ici, et `ingest` importe `wikiStore` - cycle au niveau module, mais OK car les usages sont dans des fonctions, pas à l'init) ; ajouter `type IntegrationRecord` à l'import `@shared/wiki`.
  - `WikiState` : ajouter `integrations: Record<string, IntegrationRecord>` et `undoChapter: (chapterId: string) => Promise<void>`.
  - Défaut : `integrations: {},`.
  - Dans `loadWiki`, charger aussi les intégrations (étendre le `Promise.all`) :
```typescript
  loadWiki: async (projectPath) => {
    set({ isLoading: true })
    const [fiches, suggestions, integrations] = await Promise.all([
      loadFiches(projectPath), loadSuggestions(projectPath), loadIntegrations(projectPath)
    ])
    set({ fiches, suggestions, integrations, loadedPath: projectPath, isLoading: false })
  },
```
  - Action :
```typescript
  undoChapter: async (chapterId) => {
    const { projectPath } = useProjectStore.getState()
    if (!projectPath) return
    await undoChapterIntegration(chapterId)
    const integrations = await loadIntegrations(projectPath)
    set({ integrations })
  },
```
  (Note : `undoChapterIntegration` recharge déjà fiches+suggestions+integrations via `loadWiki` ; on rafraîchit `integrations` ici par sûreté pour refléter la suppression immédiatement.)

- [ ] **Step 2 : Toolbar** — Dans `src/renderer/components/layout/Toolbar.tsx` :
  - Imports : ajouter `RotateCcw` à `lucide-react` ; `useWikiStore` est déjà importé (sous-tranche 4a).
  - Dans le composant, près des autres hooks (sous `const showNotification = ...`), ajouter :
```typescript
  const integrations = useWikiStore(s => s.integrations)
  const undoChapter = useWikiStore(s => s.undoChapter)
  const isIntegrated = !!activeDocumentId && !!integrations[activeDocumentId]

  const handleUndoChapter = async () => {
    if (!activeDocumentId) return
    if (!confirm('Annuler l\'intégration de ce chapitre dans l\'Univers ?')) return
    try {
      await undoChapter(activeDocumentId)
      showNotification('success', "Intégration annulée pour ce chapitre.")
    } catch (e) {
      showNotification('error', `Annulation KO : ${e instanceof Error ? e.message : 'erreur'}`)
    }
  }
```
  - Bouton : JUSTE APRÈS le bouton « Analyser ce chapitre » (le `<ToolbarButton ... title="Analyser ce chapitre dans l'Univers" />`), n'afficher le bouton d'annulation QUE si `isIntegrated` :
```tsx
      {isIntegrated && (
        <ToolbarButton
          icon={<RotateCcw size={16} />}
          onClick={() => { void handleUndoChapter() }}
          title="Annuler l'intégration de ce chapitre"
        />
      )}
```

- [ ] **Step 3 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (pas d'import inutilisé, pas de hook conditionnel - le `useWikiStore(...)` reste en haut, seul le JSX est conditionnel), ≈115 verts.

- [ ] **Step 4 : commit**
```bash
git add src/renderer/stores/wikiStore.ts src/renderer/components/layout/Toolbar.tsx
git commit -m "feat(univers): undo-integration toolbar button + wikiStore integrations state"
```

---

### Task 5 : Vérification

- [ ] **Step 1** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, ≈115 verts.
- [ ] **Step 2 (manuel, sur `~/Desktop/Savana.palim`)** — `npm run launch:dev` :
  - **Basique** : « Analyser ce chapitre » → fiches créées/enrichies. Le bouton **« Annuler l'intégration » (RotateCcw)** apparaît dans la barre d'outils. Cliquer → confirmer → les fiches créées disparaissent, les sections ajoutées (et le chapitre dans `sources`) sont retirées, les alertes du chapitre supprimées, le bouton disparaît (chapitre désintégré). Réanalysable ensuite.
  - **Avancé** : analyser → accepter quelques suggestions (panneau droit) → le chapitre devient intégré (bouton présent) → « Annuler l'intégration » défait les acceptations de ce chapitre.
  - **Rétro-compat** : un `integrations.json` hérité (valeurs = timestamps) ne casse rien ; « Annuler » sur un tel chapitre ne supprime rien (journal vide) mais désintègre le chapitre.
- [ ] **Step 3 (si correctifs)** — `git add -A && git commit -m "fix(univers): undo adjustments from manual test"`

## Auto-revue (couverture vs spec « Journal annulable »)
- `nouvelle_fiche` → undo = supprimer la fiche créée → Task 3 (`rec.created` → `ioDeleteFiche`). ✅
- `ajout` → undo = retirer la section marquée + retirer le chapitre de `sources` si plus de section → Task 1 (`removeIngestSection`) + Task 3. ✅
- `incoherence` → undo = supprimer l'alerte créée → Task 2 (`deleteAlert`) + Task 3. ✅
- Retrait du chapitre de `integrations.json` → Task 3 (`removeIntegration`). ✅
- `undoChapterIntegration(chapterId)` rejoue ces retraits → Task 3. ✅
- Bouton « Annuler l'intégration » par chapitre → Task 4 (barre d'outils, conditionnel). ✅
- Couvre basique ET avancé (journal alimenté par `ingestChapter` ET `applySuggestion`) → Task 3. ✅
- Rétro-compatibilité de `integrations.json` (timestamps hérités) → Task 1 (`toIntegrationRecord`) + Task 2. ✅
- HORS périmètre : annulation par entrée de log, « tout réanalyser », Couche 2.

## Cohérence des signatures
- `FicheRef = { category, slug }` ; `IntegrationRecord = { at, created: FicheRef[], appended: FicheRef[], alerts: string[] }` — Task 1.
- `toIntegrationRecord(value) -> IntegrationRecord` ; `emptyIntegrationRecord(at) -> IntegrationRecord` — Task 1.
- `removeIngestSection(body, chapterId) -> string` — Task 1, utilisé Task 3.
- `loadIntegrations -> Record<string, IntegrationRecord>` ; `recordIntegration(projectPath, chapterId, record)` ; `mergeIntegration(projectPath, chapterId, {created?,appended?,alerts?})` ; `removeIntegration(projectPath, chapterId)` ; `deleteAlert(projectPath, id)` — Task 2, utilisés Task 3.
- `chaptersToAnalyze(items, Record<string, unknown>)` — Task 2 (relax), inchangé sinon.
- `applyOneSuggestion(...) -> { working, created, updated, alerts, ignored, ref: ApplyRef }` — Task 3.
- `undoChapterIntegration(chapterId) -> Promise<UndoResult>` ; `UndoResult = { deleted, reverted, alertsRemoved }` — Task 3, utilisé Task 4.
- `wikiStore.integrations: Record<string, IntegrationRecord>` + `undoChapter(chapterId)` — Task 4.
