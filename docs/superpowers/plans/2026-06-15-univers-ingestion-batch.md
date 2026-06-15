# Univers — Ingestion en batch (analyser le manuscrit) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un bouton « Analyser le manuscrit » (section Univers) qui analyse en **mode basique** tous les chapitres **non encore intégrés**, séquentiellement, avec **barre de progression** et **arrêt** possible.

**Architecture:** Une fonction pure `chaptersToAnalyze(items, integrated)` (sélection incrémentale des chapitres) ; un orchestrateur renderer `analyzeManuscript(onProgress, shouldContinue)` qui boucle sur `ingestChapter` (sous-tranche 2) en remontant la progression et en respectant l'arrêt ; l'UI dans `FicheNavigator` (bouton + progression + bouton Arrêter).

**Tech Stack:** TS strict, React/Zustand, `node:test`. Branche `feat/wiki`. Préfixer node : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`. Tests `npm run test:main` (baseline **105 verts**). Build `npm run build`.

**Périmètre (décidé) :** batch **mode basique uniquement**, **incrémental** (saute les chapitres déjà dans `integrations.json`), séquentiel, progression + arrêt. HORS périmètre : mode avancé / file de revue (sous-tranche 4), bouton « Annuler l'intégration » (sous-tranche 4), option « tout réanalyser », déclencheur continu au changement de chapitre.

**Briques réutilisées (NE PAS recréer) :**
- `@/lib/wiki/ingest` : `ingestChapter(chapterId): Promise<IngestResult>` (sous-tranche 2). `IngestResult = { fichesCreated, fichesUpdated, alerts, ignored, summary }`. Le fichier contient déjà un helper privé `findItem(items, id)`.
- `@/lib/wiki/wikiIO` : `loadIntegrations(projectPath): Promise<Record<string,string>>`.
- `@shared/manuscript/order` : `flattenChapterIds(items)` (existant ; on ajoute `chaptersToAnalyze`).
- `@/stores/projectStore` : `projectPath`, `project` (`project.manuscript.items: ManuscriptItem[]`). `ManuscriptItem.type` ∈ `'folder' | 'chapter' | 'scene'`.
- `@/stores/statsStore` : `showNotification(type, message)`.
- `FicheNavigator.tsx` (section Univers) : déjà le bouton « Préparer l'analyse approfondie » + le sélecteur de moteur ; on ajoute le bouton batch au-dessus du sélecteur.

---

### Task 1 : Pur — sélection incrémentale des chapitres `chaptersToAnalyze`

**Files:**
- Modify: `src/shared/manuscript/order.ts`
- Test: `src/main/__tests__/manuscript.order.test.ts` (fichier existant — on ajoute des tests)

Contexte : `flattenChapterIds` renvoie TOUS les ids (dossiers/chapitres/scènes). Pour le batch on veut uniquement les items `type === 'chapter'` PAS déjà intégrés, dans l'ordre.

- [ ] **Step 1 : test qui échoue** — Dans `src/main/__tests__/manuscript.order.test.ts`, ajouter en haut l'import de la nouvelle fonction (adapter la ligne d'import existante `import { flattenChapterIds } from '../../shared/manuscript/order.js'` pour qu'elle importe AUSSI `chaptersToAnalyze`), puis ajouter ces tests à la fin du fichier :
```typescript
test('chaptersToAnalyze returns only non-integrated chapters, in order', () => {
  const items = [
    { id: 'a', type: 'chapter', title: 'A', status: 'draft', wordCount: 0 },
    { id: 'b', type: 'chapter', title: 'B', status: 'draft', wordCount: 0 },
    { id: 'c', type: 'chapter', title: 'C', status: 'draft', wordCount: 0 }
  ] as any
  assert.deepEqual(chaptersToAnalyze(items, { b: '2026-06-15' }), ['a', 'c'])
})

test('chaptersToAnalyze ignores folders and scenes', () => {
  const items = [
    { id: 'f', type: 'folder', title: 'Part', status: 'draft', wordCount: 0, children: [
      { id: 'c1', type: 'chapter', title: 'C1', status: 'draft', wordCount: 0 },
      { id: 's1', type: 'scene', title: 'S1', status: 'draft', wordCount: 0 }
    ] }
  ] as any
  assert.deepEqual(chaptersToAnalyze(items, {}), ['c1'])
})

test('chaptersToAnalyze on empty input returns []', () => {
  assert.deepEqual(chaptersToAnalyze([], {}), [])
})
```

- [ ] **Step 2 : run (fail)** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run test:main`. Expected: FAIL (`chaptersToAnalyze` non exporté).

- [ ] **Step 3 : implémenter** — Dans `src/shared/manuscript/order.ts`, ajouter à la fin :
```typescript
/**
 * Ordered ids of CHAPTER items (type === 'chapter') not yet present in the
 * integrations map. Folders and scenes are skipped; children are traversed.
 */
export function chaptersToAnalyze(items: ManuscriptItem[], integrated: Record<string, string>): string[] {
  const ids: string[] = []
  const walk = (list: ManuscriptItem[]) => {
    for (const item of list) {
      if (item.type === 'chapter' && !integrated[item.id]) ids.push(item.id)
      if (item.children && item.children.length > 0) walk(item.children)
    }
  }
  walk(items)
  return ids
}
```

- [ ] **Step 4 : run (pass)** — `npm run test:main`. Expected: PASS, baseline+3 (≈108).

- [ ] **Step 5 : commit**
```bash
git add src/shared/manuscript/order.ts src/main/__tests__/manuscript.order.test.ts
git commit -m "feat(univers): chaptersToAnalyze (incremental chapter selection, pure)"
```

---

### Task 2 : Orchestrateur batch `analyzeManuscript`

**Files:**
- Modify: `src/renderer/lib/wiki/ingest.ts`

Pas de test auto (couche IO/IA) → vérif = build propre + tests inchangés.

- [ ] **Step 1 : import** — Dans `src/renderer/lib/wiki/ingest.ts` :
  - Ajouter `loadIntegrations` à l'import existant depuis `@/lib/wiki/wikiIO` (la liste actuelle est `createFiche as ioCreateFiche, saveFiche as ioSaveFiche, saveAlert, appendLog, markChapterIntegrated, writeWikiIndex, loadAlerts, loadSuggestions`).
  - Ajouter `import { chaptersToAnalyze } from '@shared/manuscript/order'`.

- [ ] **Step 2 : implémenter** — Ajouter à la fin de `src/renderer/lib/wiki/ingest.ts` :
```typescript
export interface BatchProgress { done: number; total: number; title: string }
export interface BatchResult {
  chapters: number
  fichesCreated: number
  fichesUpdated: number
  alerts: number
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
  let done = 0, fichesCreated = 0, fichesUpdated = 0, alerts = 0, failures = 0

  for (const id of ids) {
    if (!shouldContinue()) {
      return { chapters: done, fichesCreated, fichesUpdated, alerts, failures, cancelled: true }
    }
    const title = findItem(project.manuscript.items, id)?.title ?? id
    onProgress({ done, total, title })
    try {
      const r = await ingestChapter(id)
      fichesCreated += r.fichesCreated
      fichesUpdated += r.fichesUpdated
      alerts += r.alerts
    } catch {
      failures += 1
    }
    done += 1
    onProgress({ done, total, title })
  }

  return { chapters: done, fichesCreated, fichesUpdated, alerts, failures, cancelled: false }
}
```

- [ ] **Step 3 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (pas d'import inutilisé ; `findItem`/`ingestChapter`/`useProjectStore` sont déjà dans le fichier), tests ≈108 verts.

- [ ] **Step 4 : commit**
```bash
git add src/renderer/lib/wiki/ingest.ts
git commit -m "feat(univers): analyzeManuscript batch orchestrator (sequential, progress, cancel)"
```

---

### Task 3 : UI — bouton « Analyser le manuscrit » + progression + arrêt

**Files:**
- Modify: `src/renderer/components/univers/FicheNavigator.tsx`

- [ ] **Step 1 : imports** — Dans `FicheNavigator.tsx` :
  - Remplacer `import { useEffect, useState } from 'react'` par `import { useEffect, useRef, useState } from 'react'`.
  - Ajouter `BookOpenCheck` et `Square` à l'import `lucide-react` (la ligne actuelle : `import { Plus, Sparkles, Trash2 } from 'lucide-react'`).
  - Ajouter `import { analyzeManuscript, type BatchProgress } from '@/lib/wiki/ingest'`.

- [ ] **Step 2 : state + handler** — Dans le composant, après `const [availableEngines, setAvailableEngines] = useState<string[]>([])` (ligne ~26), ajouter :
```typescript
  const [batch, setBatch] = useState<BatchProgress | null>(null)
  const cancelRef = useRef(false)

  const handleAnalyzeManuscript = async () => {
    cancelRef.current = false
    setBatch({ done: 0, total: 0, title: '' })
    try {
      const r = await analyzeManuscript(p => setBatch(p), () => !cancelRef.current)
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
```

- [ ] **Step 3 : UI** — Juste AVANT le bouton « Préparer l'analyse approfondie » (le `<button onClick={handlePrepareAgent} ...>`, ligne ~112), insérer le bloc batch :
```tsx
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
```

- [ ] **Step 4 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (pas d'import inutilisé), tests ≈108 verts.

- [ ] **Step 5 : commit**
```bash
git add src/renderer/components/univers/FicheNavigator.tsx
git commit -m "feat(univers): 'Analyser le manuscrit' batch button + progress + stop"
```

---

### Task 4 : Vérification

- [ ] **Step 1** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, ≈108 verts.
- [ ] **Step 2 (manuel, sur `~/Desktop/Savana.palim`)** — `npm run launch:dev` : section Univers → choisir le moteur → « Analyser le manuscrit ». Attendu : barre de progression i/N qui avance, titre du chapitre courant ; bouton « Arrêter » qui stoppe proprement (ce qui est fait reste fait) ; à la fin, notification « Manuscrit analysé : N chapitre(s)… ». Relancer → seuls les chapitres NON intégrés sont retraités (les autres sont sautés via `integrations.json`). Vérifier qu'un échec sur un chapitre n'arrête pas le batch (compté en « échec(s) »).
- [ ] **Step 3 (si correctifs)** — `git add -A && git commit -m "fix(univers): batch ingestion adjustments from manual test"`

## Auto-revue (couverture vs spec, section « Batch » + « Déclencheurs UI »)
- `analyzeManuscript({ mode })` = boucle séquentielle sur chapitres non intégrés → Tasks 1+2. ✅ (mode basique fixé ; mode avancé = sous-tranche 4.)
- Filtrage incrémental via `integrations.json` → Task 1 `chaptersToAnalyze` + Task 2. ✅
- Barre de progression (chapitre i/N) → Task 3. ✅
- Annulation possible (stop) → Task 2 `shouldContinue` + Task 3 bouton « Arrêter ». ✅
- Résumé écrit pour chaque chapitre + auto-apply au fil → délégué à `ingestChapter` (sous-tranche 2). ✅
- Notification de fin (N chapitres, fiches touchées, alertes, échecs) → Task 3. ✅
- Gestion d'erreurs : échec d'un chapitre → loggé dans `ingestChapter`, compté, on continue → Task 2. ✅
- HORS périmètre (assumé) : option « tout réanalyser », mode avancé, déclencheur continu, bouton annuler.

## Cohérence des signatures
- `chaptersToAnalyze(items, integrated) -> string[]` — Task 1, utilisé Task 2.
- `analyzeManuscript(onProgress, shouldContinue) -> Promise<BatchResult>` ; `BatchProgress = { done, total, title }` ; `BatchResult = { chapters, fichesCreated, fichesUpdated, alerts, failures, cancelled }` — Task 2, utilisés Task 3.
- Réutilisés tels quels : `ingestChapter` (et son `IngestResult`), `findItem` (privé, même fichier), `loadIntegrations`, `flattenChapterIds`/`chaptersToAnalyze`.
