# Univers — Ingestion mode avancé (file de revue) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un réglage **Basique / Avancé**. En **Avancé**, l'analyse (chapitre ou batch) **ne touche pas la bible** : elle **dépose des suggestions** dans une file, listées dans le **panneau droit** de l'Univers où l'auteur fait **Accepter / Refuser**.

**Architecture:** On extrait la logique d'application d'UNE suggestion (`applyOneSuggestion`) de `ingestChapter` pour la partager entre l'auto-apply (basique) et l'acceptation (avancé) ; `ingestChapter` se branche sur le mode (basique = applique, avancé = `addSuggestions`) ; `wikiStore` gagne l'état `suggestions` + `refreshSuggestions` ; un nouveau composant `SuggestionPanel` remplit le volet droit réservé.

**Tech Stack:** TS strict, React/Zustand, `node:test`. Branche `feat/wiki`. Préfixer node : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`. Tests `npm run test:main` (baseline **108 verts** — cette tranche est IO/UI, build-vérifiée, pas de nouveaux tests auto). Build `npm run build`.

**Périmètre (décidé : 4a) :** réglage de mode + file de revue (queue + panneau droit Accepter/Refuser). HORS périmètre : bouton « Annuler l'intégration » (= sous-tranche 4b, demande un journal structuré) ; dashboards mystères/thèmes ; recherche/graphe ; ask.

**Briques réutilisées :**
- `@/lib/wiki/ingest` : `ingestChapter`, `analyzeManuscript`, helpers privés `findItem`, `findFicheByCible`, `today`, `readChapterText` ; `IngestResult`/`BatchResult`.
- `@/lib/wiki/wikiIO` : `addSuggestions(projectPath, Suggestion[])`, `loadSuggestions(projectPath)`, `deleteSuggestion(projectPath, id)`, `saveAlert`, `appendLog`, `markChapterIntegrated`, `writeWikiIndex`, `createFiche`, `saveFiche`.
- `@shared/wiki` : `Suggestion`, `WIKI_CATEGORIES`, `appendIngestSection`, `addSourceToFiche`, `suggestionToAlert`, `Fiche`, `WikiCategory`.
- `@/stores/uiStore` (pattern `analysisEngine`/`setAnalysisEngine` déjà en place pour copier le réglage + la persistance).
- `@/stores/wikiStore` (état `fiches`, `loadWiki`, `ensureLoaded`).
- `UniversLayout.tsx` : volet droit = `<div className="w-72 border-l border-border bg-card hidden xl:block" />` (réservé, à remplir).

---

### Task 1 : Réglage de mode `analysisMode` + sélecteur

**Files:**
- Modify: `src/renderer/stores/uiStore.ts`
- Modify: `src/renderer/components/univers/FicheNavigator.tsx`

Build-vérifiée (réglage persisté + petit sélecteur).

- [ ] **Step 1 : uiStore** — Dans `src/renderer/stores/uiStore.ts` :
  - Ajouter en haut, près des autres types locaux : `type AnalysisMode = 'basique' | 'avance'`.
  - Dans l'interface `UIState`, ajouter : `analysisMode: AnalysisMode` et `setAnalysisMode: (m: AnalysisMode) => void`.
  - Dans l'objet du store, ajouter le défaut `analysisMode: 'basique',` et l'action `setAnalysisMode: (m) => set({ analysisMode: m }),` (style des setters existants).
  - Dans `partialize`, ajouter `analysisMode: state.analysisMode,`.
  - Exporter le type pour réutilisation : `export type { AnalysisMode }` (ou marquer `export type AnalysisMode = ...` directement à la déclaration).

- [ ] **Step 2 : sélecteur dans FicheNavigator** — Dans `src/renderer/components/univers/FicheNavigator.tsx` :
  - Récupérer le réglage : après `const setAnalysisEngine = useUIStore(s => s.setAnalysisEngine)` (ligne ~23), ajouter :
```typescript
  const analysisMode = useUIStore(s => s.analysisMode)
  const setAnalysisMode = useUIStore(s => s.setAnalysisMode)
```
  - Dans le bloc `<div className="mt-2 flex flex-col gap-1.5">` qui contient le `<select>` du moteur (vers la fin du JSX, ~ligne 120), AJOUTER un second `<select>` pour le mode, juste avant le `<select>` du moteur :
```tsx
        <select
          value={analysisMode}
          onChange={e => setAnalysisMode(e.target.value as 'basique' | 'avance')}
          className="w-full text-xs bg-background border border-border rounded px-1.5 py-1 text-muted-foreground"
          title="Basique : applique direct. Avancé : dépose des suggestions à valider."
        >
          <option value="basique">Mode basique (auto)</option>
          <option value="avance">Mode avancé (revue)</option>
        </select>
```

- [ ] **Step 3 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, 108 verts.

- [ ] **Step 4 : commit**
```bash
git add src/renderer/stores/uiStore.ts src/renderer/components/univers/FicheNavigator.tsx
git commit -m "feat(univers): analysisMode setting (basique/avance) + selector"
```

---

### Task 2 : Refactor `ingest.ts` — extraire `applyOneSuggestion`, brancher le mode, exporter `applySuggestion`

**Files:**
- Modify: `src/renderer/lib/wiki/ingest.ts`

Build-vérifiée. Revue attentive (préservation du comportement basique).

- [ ] **Step 1 : imports** — Dans `src/renderer/lib/wiki/ingest.ts` :
  - Ajouter `addSuggestions` à l'import existant depuis `@/lib/wiki/wikiIO`.
  - Ajouter `import { useUIStore } from '@/stores/uiStore'`.

- [ ] **Step 2 : extraire `applyOneSuggestion`** — Ajouter cette fonction privée AVANT `ingestChapter` (après `findFicheByCible`) :
```typescript
/** Apply ONE suggestion to disk (basic mode / accept). Returns the updated working list + a delta. */
async function applyOneSuggestion(
  projectPath: string, s: Suggestion, chapterId: string, working: Fiche[], day: string
): Promise<{ working: Fiche[]; created: number; updated: number; alerts: number; ignored: number }> {
  if (s.type === 'nouvelle_fiche') {
    const cat: WikiCategory = (WIKI_CATEGORIES as string[]).includes(s.cible) ? (s.cible as WikiCategory) : 'notes'
    const fiche = await ioCreateFiche(projectPath, cat, s.title, s.body, working)
    return { working: [...working, fiche], created: 1, updated: 0, alerts: 0, ignored: 0 }
  }
  if (s.type === 'ajout') {
    const target = findFicheByCible(working, s.cible, s.title)
    if (!target) return { working, created: 0, updated: 0, alerts: 0, ignored: 1 }
    let f = appendIngestSection(target, chapterId, s.body, day)
    f = addSourceToFiche(f, chapterId, day)
    await ioSaveFiche(projectPath, f)
    return {
      working: working.map(x => (x.category === f.category && x.slug === f.slug ? f : x)),
      created: 0, updated: 1, alerts: 0, ignored: 0
    }
  }
  const alert: Alert = { ...suggestionToAlert(s, day), id: crypto.randomUUID() }
  await saveAlert(projectPath, alert)
  return { working, created: 0, updated: 0, alerts: 1, ignored: 0 }
}
```
  (Ajouter `Suggestion` à l'import depuis `@shared/wiki` s'il n'y est pas déjà.)

- [ ] **Step 3 : brancher `ingestChapter` sur le mode + ajouter `queued` au résultat** — Dans l'interface `IngestResult`, ajouter le champ `queued: number`. Puis remplacer la SECTION D'APPLICATION de `ingestChapter` (les 3 boucles `for ... nouvelle_fiche / ajout / incoherence`) par un branchement de mode. Concrètement, après la ligne `const { suggestions, summary } = parseIngestOutput(raw)` et `const day = today()`, remplacer tout le bloc qui calcule/applique jusqu'à AVANT l'écriture du synopsis par :
```typescript
  const mode = useUIStore.getState().analysisMode

  if (mode === 'avance') {
    const queued = suggestions.map(s => ({ ...s, id: crypto.randomUUID(), sourceChapitre: chapterId }))
    if (queued.length) await addSuggestions(projectPath, queued)
    if (summary.trim()) {
      useProjectStore.getState().updateManuscriptItem(chapterId, { synopsis: summary.trim() })
      await useProjectStore.getState().saveProject()
    }
    await appendLog(projectPath, 'analyse', item.title, `${queued.length} suggestion(s) en attente`)
    await markChapterIntegrated(projectPath, chapterId)
    return { fichesCreated: 0, fichesUpdated: 0, alerts: 0, ignored: 0, queued: queued.length, summary }
  }

  // Basic mode: auto-apply, new fiches first so same-run "ajout" can target them.
  let working: Fiche[] = [...useWikiStore.getState().fiches]
  let fichesCreated = 0, fichesUpdated = 0, alertCount = 0, ignored = 0
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
  }
```
  IMPORTANT — contexte de l'état actuel de `ingestChapter` : il déclare déjà `let working` et charge `useWikiStore.getState().fiches` AVANT le bloc context/prompt (pour `buildFichesSummary`). Tu dois réorganiser proprement : `buildFichesSummary` a besoin de la liste des fiches AVANT l'appel IA. Donc :
    1. garde le calcul du contexte (alerts/pending/`buildFichesSummary(currentFiches)`) en utilisant une const locale `const currentFiches = [...useWikiStore.getState().fiches]` pour le prompt ;
    2. après l'appel IA + parse, fais le branchement ci-dessus (le mode basique réinitialise `working` depuis le store — l'état n'a pas changé entre-temps).
  Lis la fonction et adapte pour qu'il n'y ait qu'UNE déclaration de `working` (dans la branche basique) et que `buildFichesSummary` utilise `currentFiches`. Le reste de `ingestChapter` (synopsis → log → markChapterIntegrated → writeWikiIndex(working) → loadWiki → return) reste pour la branche basique ; AJOUTER `queued: 0` à son objet de retour.

- [ ] **Step 4 : exporter `applySuggestion` (acceptation depuis le panneau)** — Ajouter à la fin du fichier :
```typescript
/** Accept one queued suggestion: apply it to the bible, refresh fiches + index. */
export async function applySuggestion(projectPath: string, s: Suggestion): Promise<void> {
  await useWikiStore.getState().ensureLoaded()
  const working = [...useWikiStore.getState().fiches]
  const chapterId = s.sourceChapitre ?? 'manuel'
  const r = await applyOneSuggestion(projectPath, s, chapterId, working, today())
  await writeWikiIndex(projectPath, r.working)
  await useWikiStore.getState().loadWiki(projectPath)
}
```

- [ ] **Step 5 : mettre `analyzeManuscript` à jour pour `queued`** — Dans `analyzeManuscript`, ajouter `queued` à l'accumulation : dans `BatchResult` ajouter `queued: number` ; initialiser `let ... queued = 0` ; dans la boucle après `const r = await ingestChapter(id)` ajouter `queued += r.queued` ; ajouter `queued` aux deux `return { ... }` (cancelled et normal).

- [ ] **Step 6 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (pas d'import inutilisé, pas de double `working`), 108 verts.

- [ ] **Step 7 : commit**
```bash
git add src/renderer/lib/wiki/ingest.ts
git commit -m "feat(univers): mode-aware ingest (advanced=queue) + shared applyOneSuggestion + applySuggestion"
```

---

### Task 3 : `wikiStore` — état `suggestions` + `refreshSuggestions`

**Files:**
- Modify: `src/renderer/stores/wikiStore.ts`

Build-vérifiée.

- [ ] **Step 1 : implémenter** — Dans `src/renderer/stores/wikiStore.ts` :
  - Import : changer `import { loadFiches, saveFiche as ioSaveFiche, deleteFiche as ioDeleteFiche, createFiche as ioCreateFiche } from '@/lib/wiki/wikiIO'` pour AJOUTER `loadSuggestions`. Ajouter `type Suggestion` à l'import `@shared/wiki`.
  - Dans `WikiState`, ajouter : `suggestions: Suggestion[]` et `refreshSuggestions: () => Promise<void>`.
  - Dans l'objet du store : défaut `suggestions: [],`.
  - Modifier `loadWiki` pour charger AUSSI les suggestions :
```typescript
  loadWiki: async (projectPath) => {
    set({ isLoading: true })
    const [fiches, suggestions] = await Promise.all([loadFiches(projectPath), loadSuggestions(projectPath)])
    set({ fiches, suggestions, loadedPath: projectPath, isLoading: false })
  },
```
  - Ajouter l'action :
```typescript
  refreshSuggestions: async () => {
    const { projectPath } = useProjectStore.getState()
    if (!projectPath) return
    const suggestions = await loadSuggestions(projectPath)
    set({ suggestions })
  },
```

- [ ] **Step 2 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, 108 verts.

- [ ] **Step 3 : commit**
```bash
git add src/renderer/stores/wikiStore.ts
git commit -m "feat(univers): wikiStore suggestions state + refreshSuggestions"
```

---

### Task 4 : Panneau de revue `SuggestionPanel` + branchements

**Files:**
- Create: `src/renderer/components/univers/SuggestionPanel.tsx`
- Modify: `src/renderer/components/univers/UniversLayout.tsx`
- Modify: `src/renderer/components/univers/FicheNavigator.tsx` (refresh après batch)
- Modify: `src/renderer/components/layout/Toolbar.tsx` (refresh après chapitre)

Build-vérifiée.

- [ ] **Step 1 : créer `SuggestionPanel.tsx`** :
```tsx
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
```

- [ ] **Step 2 : brancher dans `UniversLayout.tsx`** — Remplacer la ligne du volet droit réservé :
```tsx
      {/* Volet droit réservé (dashboards/suggestions/recherche — slice 4) */}
      <div className="w-72 border-l border-border bg-card hidden xl:block" />
```
  par :
```tsx
      <div className="w-72 border-l border-border bg-card hidden xl:block overflow-hidden">
        <SuggestionPanel />
      </div>
```
  et ajouter en haut l'import : `import { SuggestionPanel } from './SuggestionPanel'`.

- [ ] **Step 3 : refresh après analyse (batch)** — Dans `FicheNavigator.tsx`, dans `handleAnalyzeManuscript`, juste après l'appel `const r = await analyzeManuscript(...)` (avant la notification), ajouter : `await useWikiStore.getState().refreshSuggestions()`. (`useWikiStore` est déjà importé.)

- [ ] **Step 4 : refresh après analyse (chapitre)** — Dans `src/renderer/components/layout/Toolbar.tsx`, dans `handleAnalyzeChapter`, après `const r = await ingestChapter(activeDocumentId)` (avant la notification), ajouter : `await useWikiStore.getState().refreshSuggestions()`. Ajouter l'import `import { useWikiStore } from '@/stores/wikiStore'` en haut s'il n'y est pas.

- [ ] **Step 5 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (pas d'import inutilisé), 108 verts.

- [ ] **Step 6 : commit**
```bash
git add src/renderer/components/univers/SuggestionPanel.tsx src/renderer/components/univers/UniversLayout.tsx src/renderer/components/univers/FicheNavigator.tsx src/renderer/components/layout/Toolbar.tsx
git commit -m "feat(univers): suggestion review panel (accept/refuse) in right pane"
```

---

### Task 5 : Vérification

- [ ] **Step 1** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, 108 verts.
- [ ] **Step 2 (manuel, sur `~/Desktop/Savana.palim`, fenêtre large pour voir le volet droit `xl`)** — `npm run launch:dev` :
  - Régler **Mode avancé** dans la section Univers.
  - « Analyser ce chapitre » (barre d'outils) → AUCUNE fiche créée directement ; les suggestions apparaissent dans le **panneau droit** (compteur > 0) ; le synopsis du chapitre est tout de même rempli.
  - **Accepter** une suggestion → la fiche est créée/enrichie (visible dans la liste de gauche), la suggestion disparaît du panneau ; **Refuser** → la suggestion disparaît sans rien écrire.
  - Repasser en **Basique** → « Analyser ce chapitre » applique direct (comportement inchangé), panneau vide.
  - Batch en avancé → empile les suggestions de tous les chapitres.
- [ ] **Step 3 (si correctifs)** — `git add -A && git commit -m "fix(univers): advanced-mode review adjustments from manual test"`

## Auto-revue (couverture vs spec « Application (selon le mode) »)
- Réglage `uiStore` mode (défaut basique) + sélecteur → Task 1. ✅
- Mode basique = applique direct (comportement préservé via `applyOneSuggestion`) → Task 2. ✅
- Mode avancé = `addSuggestions` (file) au lieu d'appliquer → Task 2. ✅
- Acceptation = même logique d'application (`applySuggestion` → `applyOneSuggestion`) → Task 2 + Task 4. ✅
- Refus = `deleteSuggestion` → Task 4. ✅
- File dans le panneau droit (réutilise `addSuggestions`/`loadSuggestions`/`deleteSuggestion`) → Tasks 3+4. ✅
- Résumé → synopsis dans les DEUX modes ; chapitre marqué intégré dans les deux → Task 2. ✅
- HORS périmètre (assumé) : bouton « Annuler l'intégration » (4b), dashboards, recherche, ask.

## Cohérence des signatures
- `uiStore.analysisMode: 'basique' | 'avance'` + `setAnalysisMode` — Task 1, lu par `ingestChapter` (Task 2) et le sélecteur (Task 1).
- `applyOneSuggestion(projectPath, s, chapterId, working, day) -> { working, created, updated, alerts, ignored }` — privé, Task 2 ; utilisé par `ingestChapter` (basique) et `applySuggestion`.
- `applySuggestion(projectPath, s) -> Promise<void>` — Task 2 ; utilisé par `SuggestionPanel` (Task 4).
- `IngestResult` gagne `queued: number` ; `BatchResult` gagne `queued: number` — Task 2.
- `wikiStore.suggestions: Suggestion[]` + `refreshSuggestions()` — Task 3 ; utilisés par `SuggestionPanel` (Task 4) et les handlers d'analyse (Task 4).
