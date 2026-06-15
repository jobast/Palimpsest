# Univers — Moteur d'analyse (API ou abonnement CLI) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Un « moteur » d'analyse pluggable : appeler le modèle soit par l'**API** (`ai:chat`, clés) soit par un **CLI d'abonnement** (`claude`/`codex`/`gemini`), avec détection des CLI disponibles et un sélecteur + bouton de test.

**Architecture:** Builder de commande pur (testé) ; IPC main `wiki:detectEngines` + `wiki:runEngine` (spawn, args en tableau, prompt via stdin → pas d'injection ni de limite ARG_MAX) ; côté renderer `runEngine(system,user)` qui route API↔CLI + réglage `analysisEngine` + un bouton « Tester le moteur ».

**Tech Stack:** Electron `child_process`, React/Zustand, `node:test`. Branche `feat/wiki`. Préfixer node par `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`. Tests `npm run test:main` (93 verts). Build `npm run build`.

---

### Task 1 : Builder de commande CLI (pur)

**Files:**
- Create: `src/shared/wiki/engines.ts`
- Modify: `src/shared/wiki/index.ts`
- Test: `src/main/__tests__/wiki.engines.test.ts`

- [ ] **Step 1 : test qui échoue** — Créer `src/main/__tests__/wiki.engines.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { CLI_ENGINES, engineCommand, isCliEngine } from '../../shared/wiki/engines.js'

test('the three CLI engines exist with binary + base args', () => {
  assert.deepEqual(CLI_ENGINES.map(e => e.id).sort(), ['claude', 'codex', 'gemini'])
})

test('engineCommand returns bin + args (prompt goes to stdin, not args)', () => {
  assert.deepEqual(engineCommand('claude'), { bin: 'claude', args: ['-p'] })
  assert.deepEqual(engineCommand('codex'), { bin: 'codex', args: ['exec'] })
  assert.deepEqual(engineCommand('gemini'), { bin: 'gemini', args: ['-p'] })
})

test('engineCommand returns null for non-CLI / unknown engines', () => {
  assert.equal(engineCommand('api'), null)
  assert.equal(engineCommand('bogus'), null)
})

test('isCliEngine distinguishes api from cli ids', () => {
  assert.equal(isCliEngine('api'), false)
  assert.equal(isCliEngine('claude'), true)
})
```

- [ ] **Step 2 : run (fail)** — `npm run test:main`.

- [ ] **Step 3 : implémenter** — Créer `src/shared/wiki/engines.ts` :
```typescript
export type EngineId = 'api' | 'claude' | 'codex' | 'gemini'

export interface CliEngine { id: Exclude<EngineId, 'api'>; label: string; bin: string; args: string[] }

/** CLI engines that use the user's subscription (prompt is fed via STDIN, never as an arg). */
export const CLI_ENGINES: CliEngine[] = [
  { id: 'claude', label: 'Claude (abonnement)', bin: 'claude', args: ['-p'] },
  { id: 'codex', label: 'ChatGPT / Codex (abonnement)', bin: 'codex', args: ['exec'] },
  { id: 'gemini', label: 'Gemini (abonnement)', bin: 'gemini', args: ['-p'] }
]

export function isCliEngine(id: string): boolean {
  return CLI_ENGINES.some(e => e.id === id)
}

/** Base spawn command for a CLI engine (no prompt — prompt is written to stdin). */
export function engineCommand(id: string): { bin: string; args: string[] } | null {
  const e = CLI_ENGINES.find(x => x.id === id)
  return e ? { bin: e.bin, args: [...e.args] } : null
}
```

- [ ] **Step 4 : baril** — Dans `src/shared/wiki/index.ts`, ajouter `export * from './engines.js'`.

- [ ] **Step 5 : run (pass)** — `npm run test:main` (→ 97).

- [ ] **Step 6 : commit**
```bash
git add src/shared/wiki/engines.ts src/shared/wiki/index.ts src/main/__tests__/wiki.engines.test.ts
git commit -m "feat(univers): analysis engine registry + command builder (pure)"
```

---

### Task 2 : IPC main — détection + exécution CLI

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/shared/types/electron.d.ts`

- [ ] **Step 1 : handlers main** — Dans `src/main/index.ts`, importer en haut (avec les autres) :
```typescript
import { spawn } from 'child_process'
import { CLI_ENGINES, engineCommand } from '../shared/wiki/engines.js'
```
(Vérifier le chemin relatif vers `src/shared/wiki/engines` depuis `src/main/index.ts` selon la sortie de build — l'alias `@shared` n'est pas résolu côté main bundle ; utiliser un import relatif `../shared/wiki/engines.js` ou, si le main n'importe pas de `src/shared`, dupliquer le petit registre. PRÉFÉRER l'import relatif s'il compile ; sinon, inliner `CLI_ENGINES`/`engineCommand` dans index.ts.)

Ajouter, près des autres `ipcMain.handle` :
```typescript
// Detect which subscription CLIs are installed (resolve via spawning `--version`).
ipcMain.handle('wiki:detectEngines', async () => {
  const available: string[] = []
  await Promise.all(CLI_ENGINES.map(e => new Promise<void>((resolve) => {
    const child = spawn(e.bin, ['--version'])
    child.on('error', () => resolve())          // not installed
    child.on('close', (code) => { if (code === 0) available.push(e.id); resolve() })
  })))
  return { available }
})

// Run a CLI engine: prompt via stdin (no shell, no ARG_MAX limit). Returns stdout.
ipcMain.handle('wiki:runEngine', async (_, payload: { engineId: string; prompt: string }) => {
  const cmd = engineCommand(payload.engineId)
  if (!cmd) return { ok: false, error: `Moteur inconnu: ${payload.engineId}` }
  return await new Promise<{ ok: boolean; text?: string; error?: string }>((resolve) => {
    const child = spawn(cmd.bin, cmd.args, { timeout: 300000 })  // 5 min cap
    let out = '', err = ''
    child.stdout.on('data', d => { out += d.toString() })
    child.stderr.on('data', d => { err += d.toString() })
    child.on('error', (e) => resolve({ ok: false, error: String(e) }))
    child.on('close', (code) => {
      if (code === 0) resolve({ ok: true, text: out })
      else resolve({ ok: false, error: err || `Code ${code}` })
    })
    child.stdin.write(payload.prompt)
    child.stdin.end()
  })
})
```

- [ ] **Step 2 : preload** — Dans `src/main/preload.ts`, ajouter :
```typescript
  detectWikiEngines: () => ipcRenderer.invoke('wiki:detectEngines'),
  runWikiEngine: (payload: { engineId: string; prompt: string }) => ipcRenderer.invoke('wiki:runEngine', payload),
```

- [ ] **Step 3 : types** — Dans `src/shared/types/electron.d.ts`, ajouter à `ElectronAPI` :
```typescript
  detectWikiEngines: () => Promise<{ available: string[] }>
  runWikiEngine: (payload: { engineId: string; prompt: string }) => Promise<{ ok: boolean; text?: string; error?: string }>
```

- [ ] **Step 4 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (vérifier la résolution de l'import `engines` côté main ; inliner si nécessaire), 97 verts.

- [ ] **Step 5 : commit**
```bash
git add src/main/index.ts src/main/preload.ts src/shared/types/electron.d.ts
git commit -m "feat(univers): IPC to detect + run subscription CLIs (stdin, no shell)"
```

---

### Task 3 : Routage renderer + réglage + bouton de test

**Files:**
- Create: `src/renderer/lib/wiki/engine.ts`
- Modify: `src/renderer/stores/uiStore.ts` (réglage `analysisEngine`)
- Modify: `src/renderer/components/univers/FicheNavigator.tsx` (sélecteur + bouton test)

- [ ] **Step 1 : réglage** — Dans `src/renderer/stores/uiStore.ts`, ajouter à `UIState` : `analysisEngine: string` (défaut `'api'`) + `setAnalysisEngine: (id: string) => void` (`set({ analysisEngine: id })`). L'inclure dans `partialize` si présent (persisté).

- [ ] **Step 2 : routeur** — Créer `src/renderer/lib/wiki/engine.ts` :
```typescript
import { isCliEngine } from '@shared/wiki'
import { createAIClientFromStore } from '@/lib/ai/client'
import { useAIStore } from '@/stores/aiStore'
import { useUIStore } from '@/stores/uiStore'

/** Run the configured analysis engine. API → ai:chat ; CLI → main spawn. Returns text. */
export async function runEngine(system: string, user: string): Promise<string> {
  const engineId = useUIStore.getState().analysisEngine
  if (isCliEngine(engineId)) {
    const res = await window.electronAPI.runWikiEngine({ engineId, prompt: `${system}\n\n${user}` })
    if (!res.ok || !res.text) throw new Error(res.error || 'Échec du moteur CLI')
    return res.text
  }
  // API engine: use the configured provider/model.
  const client = createAIClientFromStore()
  const model = useAIStore.getState().selectedModel
  const res = await client.chat({ model, systemPrompt: system, messages: [{ role: 'user', content: user }] })
  return res.content
}

export async function detectEngines(): Promise<string[]> {
  const res = await window.electronAPI.detectWikiEngines()
  return res.available
}
```
(Vérifier la forme exacte de `createAIClientFromStore`/`client.chat` et de `useAIStore` — lire `src/renderer/lib/ai/client.ts` et `src/renderer/stores/aiStore.ts` ; adapter l'appel `chat` à sa vraie signature, ex. `AIRequestOptions { model, messages, systemPrompt }`.)

- [ ] **Step 3 : sélecteur + test (UI)** — Dans `FicheNavigator.tsx`, sous le bouton « Préparer l'analyse approfondie », ajouter un petit bloc : un `<select>` du moteur (options : « API (réglages) » = `api`, + les CLI **détectés** via `detectEngines()` au montage, libellés depuis `CLI_ENGINES`) lié à `analysisEngine`/`setAnalysisEngine`, et un bouton « Tester le moteur » :
```tsx
  const handleTestEngine = async () => {
    try {
      const txt = await runEngine('Réponds en un mot.', 'Dis « ok ».')
      showNotification('success', `Moteur OK : ${txt.trim().slice(0, 40)}`)
    } catch (e) {
      showNotification('error', `Moteur KO : ${e instanceof Error ? e.message : 'erreur'}`)
    }
  }
```
  (Imports : `runEngine`, `detectEngines` de `@/lib/wiki/engine` ; `CLI_ENGINES` de `@shared/wiki` ; `useUIStore`. Charger `detectEngines()` dans un `useEffect` pour ne proposer que les CLI installés ; toujours proposer `api`.)

- [ ] **Step 4 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (pas d'import inutilisé), 97 verts.

- [ ] **Step 5 : commit**
```bash
git add src/renderer/lib/wiki/engine.ts src/renderer/stores/uiStore.ts src/renderer/components/univers/FicheNavigator.tsx
git commit -m "feat(univers): analysis engine routing (API/CLI) + selector + test button"
```

---

### Task 4 : Vérification
- [ ] **Step 1** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, 97 verts.
- [ ] **Step 2 (manuel, sur `~/Desktop/Savana.palim`)** — section Univers : le sélecteur de moteur liste « API » + les CLI installés (ex. `claude`). Choisir `claude` → « Tester le moteur » → notification « Moteur OK : ok ». Choisir « API » → idem si une clé est configurée. Si un CLI absent → il n'apparaît pas ; si présent mais non connecté → « Moteur KO : … » lisible.
  > NB : selon la version exacte des CLI, l'invocation stdin peut devoir être ajustée (`claude -p` lit bien stdin en mode pipe ; sinon, passer le prompt en argument). Ajuster `engines.ts`/le handler au vu du test réel.
- [ ] **Step 3 (si correctifs)** — `git add -A && git commit -m "fix(univers): engine invocation adjustments from manual test"`

## Auto-revue (couverture)
- Registre + builder de commande (pur, testé) → Task 1. ✅
- Détection des CLI + exécution (stdin, sans shell) → Task 2. ✅
- Routage API/CLI + réglage + sélecteur + bouton test → Task 3. ✅
- Sécu : spawn args en tableau, prompt via stdin (pas d'injection, pas d'ARG_MAX). ✅
- Hors périmètre : l'ingestion elle-même (sous-tranche 2) — ici on ne fait que **pouvoir appeler le modèle** par les deux voies et le **vérifier**.

## Cohérence des signatures
- `CLI_ENGINES`, `engineCommand(id): {bin,args}|null`, `isCliEngine(id): boolean` — Task 1, utilisés Tasks 2 & 3.
- `electronAPI.detectWikiEngines()`, `electronAPI.runWikiEngine({engineId,prompt})` — Task 2, utilisés Task 3.
- `runEngine(system,user): Promise<string>` — Task 3 ; sera réutilisé par l'ingestion (sous-tranche 2).
- `uiStore.analysisEngine` + `setAnalysisEngine` — Task 3.
