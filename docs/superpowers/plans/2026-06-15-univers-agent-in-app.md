# Univers v2 #1 — Agent d'analyse in-app — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lancer le vrai agent Claude Code en sous-processus headless depuis l'app (sans terminal) pour maintenir le wiki à la qualité Savana, piloté par un menu d'ingestion à statut (non ingéré / modifié depuis / à jour) ; l'API reste le mode léger existant.

**Architecture:** (1) statut de fraîcheur par hash de contenu stocké dans `integrations.json` ; (2) IPC main `wiki:runAgent` qui spawn `claude -p ... --permission-mode acceptEdits --output-format stream-json` et relaie la progression ; (3) orchestrateur renderer `agent.ts` + menu d'ingestion dans la section Univers qui route abonnement→agent / API→pipeline existant.

**Tech Stack:** Electron `child_process`, React/Zustand, `node:test`. Branche `feat/wiki`. Préfixer node : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`. Tests `npm run test:main` (baseline **115 verts**). Build `npm run build`.

**Spec :** `docs/superpowers/specs/2026-06-15-univers-agent-in-app-design.md`.

**Faisabilité (vérifiée) :** `claude` 2.1.177 (`~/.local/bin/claude`). Headless édite les fichiers via l'abonnement de l'utilisateur ; on retire `ANTHROPIC_API_KEY` de l'env pour forcer l'abonnement.

**Briques réutilisées :** `IntegrationRecord`/`toIntegrationRecord`/`recordIntegration`/`mergeIntegration` (4b) ; `buildWikiAgentDoc`/`writeAgentDoc` (manuel + setup) ; `docToMarkdownBody` ; `useProjectStore.chapterRefs` (`{id,file}`) ; `useEditorStore.getDocumentContent` ; `useWikiStore.integrations`/`loadWiki` ; `analyzeManuscript`/`ingestChapter` (mode API) ; le pattern d'événements preload `spellcheck:context` (`ipcRenderer.on`).

**Périmètre (v1) :** agent = `claude` uniquement ; pas d'undo des éditions agent (filet = git/snapshots + log) ; rendu riche/alertes/graphe/Q&A = sous-projets #2-#5.

---

### Task 1 : Pur — hash de contenu + statut de chapitre

**Files:**
- Modify: `src/shared/wiki/types.ts` (champ `chapterHash`)
- Modify: `src/shared/wiki/integration.ts` (`hashContent`, `chapterStatus`, préserver le hash)
- Test: `src/main/__tests__/wiki.status.test.ts`

- [ ] **Step 1 : test qui échoue** — Créer `src/main/__tests__/wiki.status.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { hashContent, chapterStatus, toIntegrationRecord } from '../../shared/wiki/integration.js'

test('hashContent is deterministic and differs for different inputs', () => {
  assert.equal(hashContent('Bonjour'), hashContent('Bonjour'))
  assert.notEqual(hashContent('Bonjour'), hashContent('Bonsoir'))
  assert.equal(typeof hashContent(''), 'string')
})

test('chapterStatus: no record -> never', () => {
  assert.equal(chapterStatus('abc', undefined), 'never')
})

test('chapterStatus: matching hash -> current', () => {
  const rec = { at: 'd', created: [], appended: [], alerts: [], chapterHash: 'abc' }
  assert.equal(chapterStatus('abc', rec), 'current')
})

test('chapterStatus: different hash -> stale', () => {
  const rec = { at: 'd', created: [], appended: [], alerts: [], chapterHash: 'abc' }
  assert.equal(chapterStatus('xyz', rec), 'stale')
})

test('chapterStatus: legacy record without hash -> current (no false stale on upgrade)', () => {
  const rec = { at: 'd', created: [], appended: [], alerts: [] }
  assert.equal(chapterStatus('anything', rec), 'current')
})

test('toIntegrationRecord preserves chapterHash', () => {
  const rec = toIntegrationRecord({ at: 'd', created: [], appended: [], alerts: [], chapterHash: 'h1' })
  assert.equal(rec.chapterHash, 'h1')
})
```

- [ ] **Step 2 : run (fail)** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run test:main`. Expected: FAIL (`hashContent`/`chapterStatus` absents).

- [ ] **Step 3 : type** — Dans `src/shared/wiki/types.ts`, à l'interface `IntegrationRecord`, ajouter le champ optionnel :
```typescript
  chapterHash?: string
```

- [ ] **Step 4 : implémenter** — Dans `src/shared/wiki/integration.ts` :
  - Préserver le hash dans `toIntegrationRecord` : dans la branche objet, ajouter au record retourné `...(typeof v.chapterHash === 'string' ? { chapterHash: v.chapterHash } : {})`. (Garder le reste identique.)
  - Ajouter :
```typescript
export type ChapterStatus = 'never' | 'stale' | 'current'

/** Deterministic content fingerprint (DJB2). Used to detect chapters changed since ingestion. */
export function hashContent(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** Freshness of a chapter vs its integration record. Legacy records (no hash) count as current. */
export function chapterStatus(currentHash: string, record: IntegrationRecord | undefined): ChapterStatus {
  if (!record) return 'never'
  if (!record.chapterHash) return 'current'
  return record.chapterHash === currentHash ? 'current' : 'stale'
}
```
  (L'import de `IntegrationRecord` existe déjà en tête de `integration.ts`.)

- [ ] **Step 5 : run (pass)** — `npm run test:main`. Expected: baseline+6 (≈121).

- [ ] **Step 6 : commit**
```bash
git add src/shared/wiki/types.ts src/shared/wiki/integration.ts src/main/__tests__/wiki.status.test.ts
git commit -m "feat(univers): chapter freshness status + content hash (pure)"
```

---

### Task 2 : Enregistrer le hash du chapitre à l'ingestion (mode API)

**Files:**
- Modify: `src/renderer/lib/wiki/ingest.ts`

Build-vérifiée. But : les ingestions du pipeline (API) posent désormais le hash de référence, pour que le statut « modifié depuis » fonctionne.

- [ ] **Step 1 : import** — Dans `src/renderer/lib/wiki/ingest.ts`, ajouter `hashContent` à l'import depuis `@shared/wiki`.

- [ ] **Step 2 : poser le hash** — Dans `ingestChapter`, après `const day = today()` et le calcul de `chapterText` (déjà présent en amont), définir une fois `const chHash = hashContent(chapterText)`. Puis :
  - **Branche avancé** : remplacer `await recordIntegration(projectPath, chapterId, emptyIntegrationRecord(day))` par :
```typescript
    await recordIntegration(projectPath, chapterId, { ...emptyIntegrationRecord(day), chapterHash: chHash })
```
  - **Branche basique** : là où le record est construit (`const record = emptyIntegrationRecord(day)`), le remplacer par :
```typescript
  const record = { ...emptyIntegrationRecord(day), chapterHash: chHash }
```
  (Le reste de la boucle qui pousse created/appended/alerts dans `record` est inchangé ; `recordIntegration(projectPath, chapterId, record)` à la fin aussi.)

- [ ] **Step 3 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, ≈121 verts.

- [ ] **Step 4 : commit**
```bash
git add src/renderer/lib/wiki/ingest.ts
git commit -m "feat(univers): record chapter content hash on pipeline ingest"
```

---

### Task 3 : IPC main — `wiki:runAgent` (spawn Claude Code headless + progression)

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/shared/types/electron.d.ts`

Build-vérifiée. Revue attentive (sous-processus + stream).

- [ ] **Step 1 : handlers main** — Dans `src/main/index.ts`, près des handlers `wiki:detectEngines`/`wiki:runEngine` (≈ ligne 857), ajouter :
```typescript
// A short, UI-friendly label for one stream-json event from the agent.
function summarizeAgentEvent(evt: { type?: string; subtype?: string; message?: { content?: Array<{ type?: string; name?: string; text?: string }> } }): { kind: string; label: string } {
  if (evt.type === 'system') return { kind: 'system', label: evt.subtype === 'init' ? 'Agent démarré' : String(evt.subtype ?? 'système') }
  if (evt.type === 'result') return { kind: 'result', label: 'Analyse terminée' }
  if (evt.type === 'assistant' && Array.isArray(evt.message?.content)) {
    for (const c of evt.message!.content!) {
      if (c.type === 'tool_use') return { kind: 'tool', label: `${c.name ?? 'outil'}` }
      if (c.type === 'text' && c.text && c.text.trim()) return { kind: 'text', label: c.text.trim().slice(0, 100) }
    }
  }
  return { kind: evt.type ?? 'event', label: '' }
}

let agentChild: ReturnType<typeof spawn> | null = null

// Run Claude Code headless in the project dir: it edits wiki/ autonomously following the manual.
// Streams progress to the renderer; uses the user's subscription (no API key). Returns a summary.
ipcMain.handle('wiki:runAgent', async (_, payload: { projectPath: string; task: string; manualPath: string; maxTurns?: number }) => {
  const args = ['-p', payload.task,
    '--permission-mode', 'acceptEdits',
    '--append-system-prompt-file', payload.manualPath,
    '--output-format', 'stream-json', '--verbose',
    '--max-turns', String(payload.maxTurns ?? 60)]
  const env = { ...process.env }
  delete env.ANTHROPIC_API_KEY   // force subscription auth (not API billing)
  return await new Promise<{ ok: boolean; summary?: string; error?: string }>((resolve) => {
    const child = spawn('claude', args, { cwd: payload.projectPath, env, timeout: 1800000 })  // 30 min cap
    agentChild = child
    let buf = '', errOut = '', summary = ''
    child.stdout.on('data', d => {
      buf += d.toString()
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1)
        if (!line) continue
        try {
          const evt = JSON.parse(line)
          if (evt.type === 'result' && typeof evt.result === 'string') summary = evt.result
          mainWindow?.webContents.send('wiki:agentProgress', summarizeAgentEvent(evt))
        } catch { /* ignore partial / non-JSON lines */ }
      }
    })
    child.stderr.on('data', d => { errOut += d.toString() })
    child.on('error', (e) => { agentChild = null; resolve({ ok: false, error: String(e) }) })
    child.on('close', (code, signal) => {
      agentChild = null
      if (code === 0) resolve({ ok: true, summary })
      else if (signal) resolve({ ok: false, error: `Interrompu (${signal})` })
      else resolve({ ok: false, error: errOut.slice(-500) || `Code ${code}` })
    })
  })
})

ipcMain.handle('wiki:cancelAgent', async () => { agentChild?.kill(); return { ok: true } })
```
(`spawn` et `mainWindow` sont déjà disponibles dans ce fichier.)

- [ ] **Step 2 : preload** — Dans `src/main/preload.ts`, ajouter à l'objet `electronAPI` (le pattern d'événement suit `onSpellcheckContext`) :
```typescript
  runWikiAgent: (payload: { projectPath: string; task: string; manualPath: string; maxTurns?: number }) =>
    ipcRenderer.invoke('wiki:runAgent', payload),
  cancelWikiAgent: () => ipcRenderer.invoke('wiki:cancelAgent'),
  onWikiAgentProgress: (callback: (evt: { kind: string; label: string }) => void) =>
    ipcRenderer.on('wiki:agentProgress', (_, evt) => callback(evt)),
  offWikiAgentProgress: () => ipcRenderer.removeAllListeners('wiki:agentProgress'),
```

- [ ] **Step 3 : types** — Dans `src/shared/types/electron.d.ts`, ajouter à `ElectronAPI` :
```typescript
  runWikiAgent: (payload: { projectPath: string; task: string; manualPath: string; maxTurns?: number }) => Promise<{ ok: boolean; summary?: string; error?: string }>
  cancelWikiAgent: () => Promise<{ ok: boolean }>
  onWikiAgentProgress: (callback: (evt: { kind: string; label: string }) => void) => void
  offWikiAgentProgress: () => void
```

- [ ] **Step 4 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (pas d'import inutilisé), ≈121 verts.

- [ ] **Step 5 : commit**
```bash
git add src/main/index.ts src/main/preload.ts src/shared/types/electron.d.ts
git commit -m "feat(univers): IPC to run Claude Code headless agent (stream progress, cancel)"
```

---

### Task 4 : Orchestrateur renderer `agent.ts`

**Files:**
- Create: `src/renderer/lib/wiki/agent.ts`

Build-vérifiée.

- [ ] **Step 1 : créer le fichier** — `src/renderer/lib/wiki/agent.ts` :
```typescript
import { useProjectStore } from '@/stores/projectStore'
import { useEditorStore } from '@/stores/editorStore'
import { useWikiStore } from '@/stores/wikiStore'
import { writeAgentDoc, recordIntegration } from '@/lib/wiki/wikiIO'
import { docToMarkdownBody } from '@shared/markdown'
import { hashContent, emptyIntegrationRecord } from '@shared/wiki'

export interface AgentResult { ok: boolean; summary?: string; error?: string }

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Markdown of a chapter from the editor store (same source the pipeline hashes/ingests). */
function chapterMarkdown(chapterId: string): string {
  const raw = useEditorStore.getState().getDocumentContent(chapterId)
  if (!raw) return ''
  try { return docToMarkdownBody(JSON.parse(raw)) } catch { return '' }
}

/**
 * Run the real Claude Code agent over the given chapters: it edits the wiki autonomously
 * following wiki/CLAUDE.md. On success, record each chapter's content hash so the ingest
 * menu shows them up-to-date, then reload the wiki.
 */
export async function runAgentIngest(
  chapterIds: string[],
  onProgress: (evt: { kind: string; label: string }) => void
): Promise<AgentResult> {
  const project = useProjectStore.getState().project
  const projectPath = useProjectStore.getState().projectPath
  const chapterRefs = useProjectStore.getState().chapterRefs
  if (!project || !projectPath) return { ok: false, error: 'Aucun projet ouvert' }
  if (!chapterIds.length) return { ok: false, error: 'Aucun chapitre sélectionné' }

  // Ensure wiki/ folders + the operating manual exist, get its path.
  const manualPath = await writeAgentDoc(projectPath, project.meta.name, project.meta.author || '')

  const files = chapterIds
    .map(id => chapterRefs.find(r => r.id === id)?.file)
    .filter((f): f is string => !!f)
  const task = `Mets à jour l'Univers (le wiki) pour ces chapitres du manuscrit, en suivant STRICTEMENT le manuel d'opération fourni (format des fiches, mécanisme sources:, alertes de contradiction, n'invente rien) :\n${files.map(f => `- ${f}`).join('\n')}\n\nPour chaque chapitre : applique la grille de lecture, crée/enrichis les fiches affectées sous wiki/<categorie>/, ajoute le chapitre à leur sources:, crée des alertes wiki/_alertes/ en cas de contradiction ou de décision d'auteur, et appends à wiki/log.md. Mets à jour wiki/index.md à la fin.`

  window.electronAPI.onWikiAgentProgress(onProgress)
  try {
    const res = await window.electronAPI.runWikiAgent({ projectPath, task, manualPath })
    if (res.ok) {
      // App owns the freshness baseline: stamp each requested chapter's hash.
      for (const id of chapterIds) {
        await recordIntegration(projectPath, id, { ...emptyIntegrationRecord(today()), chapterHash: hashContent(chapterMarkdown(id)) })
      }
      await useWikiStore.getState().loadWiki(projectPath)
    }
    return res
  } finally {
    window.electronAPI.offWikiAgentProgress()
  }
}

export function cancelAgent(): void {
  void window.electronAPI.cancelWikiAgent()
}
```
(Vérifier au build : `project.meta.name`/`project.meta.author` — adapter si la forme diffère, cf. `handlePrepareAgent` dans FicheNavigator qui utilise déjà `project.meta.name`/`project.meta.author`. `chapterRefs` est exposé par `useProjectStore`.)

- [ ] **Step 2 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (pas d'import inutilisé ; retirer `useWikiStore.getState() // ensure...` si le linter le refuse — il sert juste à éviter un import non utilisé, mais `useWikiStore` est utilisé plus bas donc le supprimer), ≈121 verts.

- [ ] **Step 3 : commit**
```bash
git add src/renderer/lib/wiki/agent.ts
git commit -m "feat(univers): renderer orchestrator for in-app agent ingestion"
```

---

### Task 5 : UI — menu d'ingestion à statut dans la section Univers

**Files:**
- Create: `src/renderer/components/univers/IngestionMenu.tsx`
- Modify: `src/renderer/components/univers/FicheNavigator.tsx` (bouton d'ouverture)

Build-vérifiée + vérif runtime.

- [ ] **Step 1 : créer `IngestionMenu.tsx`** :
```tsx
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
    const find = (items: typeof project.manuscript.items): string | null => {
      for (const it of items) { if (it.id === id) return it.title; if (it.children) { const f = find(it.children); if (f) return f } }
      return null
    }
    return (project && find(project.manuscript.items)) || id
  }

  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

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
        showNotification(failures ? 'error' : 'success', `Analyse (API) : ${done} chapitre(s), ${created} créée(s), ${updated} enrichie(s)${failures ? `, ${failures} échec(s)` : ''}.`)
      }
    } catch (e) {
      showNotification('error', `Analyse KO : ${e instanceof Error ? e.message : 'erreur'}`)
    } finally {
      setRunning(false)
    }
  }

  const stop = () => { cancelRef.current = true; cancelAgent() }

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
        <div className="flex gap-1.5">
          {!running ? (
            <button onClick={() => { void run() }} className="flex-1 px-2 py-1.5 rounded text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-accent">
              Lancer ({selected.size}) — {isCliEngine(analysisEngine) ? 'agent' : 'API'}
            </button>
          ) : (
            <button onClick={stop} className="flex-1 px-2 py-1.5 rounded text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-accent">Arrêter</button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : ouvrir le menu depuis FicheNavigator** — Dans `src/renderer/components/univers/FicheNavigator.tsx` :
  - Importer : `import { IngestionMenu } from './IngestionMenu'` et ajouter `useState` (déjà importé).
  - Ajouter un état : `const [showIngest, setShowIngest] = useState(false)`.
  - Le conteneur racine du composant est `<div className="p-2 space-y-3 overflow-auto h-full">`. L'envelopper pour permettre l'overlay : remplacer ce conteneur par `<div className="relative h-full">` contenant (a) le contenu actuel dans un `<div className="p-2 space-y-3 overflow-auto h-full">` et (b) `{showIngest && <IngestionMenu onClose={() => setShowIngest(false)} />}` en dernier enfant.
  - Remplacer le bloc existant du bouton/progression « Analyser le manuscrit » (le bloc `{batch ? (...) : (<button ... BookOpenCheck ...>Analyser le manuscrit</button>)}`) par un simple bouton qui ouvre le menu :
```tsx
      <button
        onClick={() => setShowIngest(true)}
        className="mt-3 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
        title="Analyser le manuscrit dans l'Univers (statut par chapitre)"
      >
        <BookOpenCheck size={13} />
        Analyser le manuscrit
      </button>
```
  Retirer alors l'état `batch`/`cancelRef`/`handleAnalyzeManuscript` devenus inutiles dans FicheNavigator (la logique batch vit maintenant dans `IngestionMenu`) — et les imports `Square`/`analyzeManuscript`/`BatchProgress` s'ils ne servent plus. (Vérifier au build qu'il ne reste pas d'import/var inutilisé. `BookOpenCheck` reste utilisé par le nouveau bouton.)

- [ ] **Step 3 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (aucun import/var inutilisé ; hooks au top-level), ≈121 verts.

- [ ] **Step 4 : commit**
```bash
git add src/renderer/components/univers/IngestionMenu.tsx src/renderer/components/univers/FicheNavigator.tsx
git commit -m "feat(univers): ingestion menu with per-chapter status (agent or API)"
```

---

### Task 6 : Vérification

- [ ] **Step 1** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, ≈121 verts.
- [ ] **Step 2 (manuel, sur `~/Desktop/Savana.palim`)** — `npm run launch:dev` :
  - Section Univers → « Analyser le manuscrit » → le menu liste les chapitres avec badges (au 1er run, tout « non ingéré »).
  - Choisir le moteur **« Claude (abonnement) »** (sélecteur existant), sélectionner 1 chapitre → « Lancer (1) — agent ». Attendu : une activité défile (outils de l'agent), puis notification de fin ; des **pages wiki riches** apparaissent/évoluent dans la liste de gauche (sections, wikilinks), `sources` à jour, alertes éventuelles ; le chapitre passe **✅ à jour**.
  - Re-modifier ce chapitre dans l'éditeur, rouvrir le menu → statut **🔄 modifié**.
  - Choisir **« API »** + un chapitre → « Lancer (1) — API » : le pipeline léger s'exécute (fiches plates) — confirme le fallback.
  - Tester « Arrêter » pendant un run agent (le sous-processus est tué).
  > NB : si `claude` n'est pas détecté/connecté, le sélecteur ne propose pas l'abonnement → utiliser l'API, ou connecter `claude`. Si l'agent échoue, lire le message (souvent : pas connecté, ou `--append-system-prompt-file` chemin).
- [ ] **Step 3 (si correctifs)** — `git add -A && git commit -m "fix(univers): agent ingestion adjustments from manual test"`

## Auto-revue (couverture vs spec)
- Statut d'ingestion (never/stale/current via hash) → Tasks 1+2+5. ✅
- IPC agent headless (acceptEdits, abonnement, stream-json, cancel, max-turns/timeout) → Task 3. ✅
- Orchestrateur (setup manuel via writeAgentDoc, tâche, hash baseline, reload) → Task 4. ✅
- Menu d'ingestion (liste+statut+sélection+moteur+progression+arrêt) → Task 5. ✅
- Routage abonnement→agent / API→pipeline → Task 5. ✅
- Manuel d'opération → réutilise `buildWikiAgentDoc` existant (déjà riche : charte, format, sources, GRILLE, alertes, conventions) ; pas de nouvelle tâche (suffisant pour v1). ✅
- Limites assumées (agent=claude ; pas d'undo agent ; rendu/alertes/graphe/Q&A = #2-#5). ✅

## Cohérence des signatures
- `hashContent(text): string` ; `chapterStatus(currentHash, record): ChapterStatus` ; `IntegrationRecord.chapterHash?` — Task 1 ; utilisés Tasks 2, 4, 5.
- `electronAPI.runWikiAgent({projectPath,task,manualPath,maxTurns?})` / `cancelWikiAgent()` / `onWikiAgentProgress(cb)` / `offWikiAgentProgress()` — Task 3 ; utilisés Task 4.
- `runAgentIngest(chapterIds, onProgress): Promise<AgentResult>` ; `cancelAgent()` — Task 4 ; utilisés Task 5.
- `writeAgentDoc(projectPath, name, author): Promise<string>` (chemin du manuel) — existant, utilisé Task 4.
