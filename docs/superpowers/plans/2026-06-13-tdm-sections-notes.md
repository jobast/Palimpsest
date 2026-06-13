# TDM : sections + notes comme items sous les chapitres — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher sous chaque chapitre de la TDM ses sections (dérivées des `* * *`, navigation seule) et sa note privée (item ouvrant la note dans la zone centrale), sans rien changer au stockage.

**Architecture:** Enfants dérivés en rendu pur (jamais des `ManuscriptItem`). Les sections sont comptées depuis le doc TipTap en mémoire (`editorStore.documentContents`). La note ouvre une vue centrale via un nouvel état `activeNoteId` (comme `activeSheetId`/`activeReportId`). L'existence d'une note par chapitre est suivie dans un `Set` du `projectStore`, peuplé à l'ouverture et mis à jour à la sauvegarde de note.

**Tech Stack:** React 18, TipTap 2, Zustand 4, `node:test`. Branche `feat/stockage-markdown` (suite du stockage Markdown).

**Environnement :** node via nvm — préfixer toute commande node/npm par `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`. Tests : `npm run test:main`. Build : `npm run build`. Imports relatifs dans `src/shared/` avec extension `.js` (ESM/Node 22).

---

## Structure des fichiers

**Créés :**
- `src/shared/markdown/sections.ts` — `countSections(docJson)` pur (compte les `sceneBreak`).
- `src/main/__tests__/markdown.sections.test.ts` — tests de `countSections`.
- `src/renderer/components/editor/NoteEditor.tsx` — vue note centrale (textarea + autosave).

**Modifiés :**
- `src/shared/markdown/index.ts` — exporter `./sections.js`.
- `src/renderer/stores/projectStore.ts` — `chaptersWithNote: Set<string>` (état + peuplement aux 3 chemins d'ouverture + maj dans `saveChapterNote`) ; `activeNoteId` + `setActiveNote` ; effacer `activeNoteId` dans `setActiveDocument`/`setActiveSheet`/`setActiveReport` ; `setProject` reset.
- `src/renderer/stores/editorStore.ts` — `pendingSectionIndex: number | null` + `requestSectionScroll(index)` + `clearPendingSectionScroll()`.
- `src/renderer/components/editor/EditorArea.tsx` — rendre `NoteEditor` si `activeNoteId` ; effet de scroll vers la section en attente.
- `src/renderer/components/layout/Sidebar.tsx` — rendre les items « Section N » + « Note » dérivés ; câbler les clics ; **retirer la modale de note (Task 14)** ; le menu contextuel « Note du chapitre » appelle `setActiveNote`.

---

### Task 1 : `countSections` (utilitaire pur)

**Files:**
- Create: `src/shared/markdown/sections.ts`
- Modify: `src/shared/markdown/index.ts`
- Test: `src/main/__tests__/markdown.sections.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/main/__tests__/markdown.sections.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { countSections } from '../../shared/markdown/sections.js'

const doc = (content: unknown[]) => JSON.stringify({ type: 'doc', content })
const title = { type: 'chapterTitle', content: [{ type: 'text', text: 'T' }] }
const p = (t: string) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })
const sb = { type: 'sceneBreak' }

test('a chapter with no scene break has 1 section', () => {
  assert.equal(countSections(doc([title, p('a'), p('b')])), 1)
})

test('one scene break yields 2 sections', () => {
  assert.equal(countSections(doc([title, p('a'), sb, p('b')])), 2)
})

test('three scene breaks yield 4 sections', () => {
  assert.equal(countSections(doc([title, p('a'), sb, p('b'), sb, p('c'), sb, p('d')])), 4)
})

test('empty or invalid input yields 0', () => {
  assert.equal(countSections(undefined), 0)
  assert.equal(countSections(''), 0)
  assert.equal(countSections('not json'), 0)
  assert.equal(countSections(JSON.stringify({ type: 'doc' })), 0) // no content
})
```

- [ ] **Step 2 : Lancer le test pour vérifier l'échec**

Run : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run test:main`
Expected : FAIL — module `sections.js` introuvable.

- [ ] **Step 3 : Écrire l'implémentation**

Créer `src/shared/markdown/sections.ts` :
```typescript
import type { TipTapDoc, TipTapNode } from './types.js'

/**
 * Number of sections in a chapter doc = (# top-level sceneBreak nodes) + 1.
 * Returns 0 for empty/invalid input or a doc with no content (nothing to show).
 */
export function countSections(docJson: string | undefined): number {
  if (!docJson) return 0
  let doc: TipTapDoc
  try {
    doc = JSON.parse(docJson) as TipTapDoc
  } catch {
    return 0
  }
  const content: TipTapNode[] = Array.isArray(doc?.content) ? doc.content : []
  if (content.length === 0) return 0
  const breaks = content.filter(n => n.type === 'sceneBreak').length
  return breaks + 1
}
```

- [ ] **Step 4 : Compléter le baril**

Dans `src/shared/markdown/index.ts`, ajouter :
```typescript
export * from './sections.js'
```

- [ ] **Step 5 : Lancer le test pour vérifier le succès**

Run : `npm run test:main`
Expected : PASS (les 4 nouveaux tests + les 39 existants verts → 43).

- [ ] **Step 6 : Commit**
```bash
git add src/shared/markdown/sections.ts src/shared/markdown/index.ts src/main/__tests__/markdown.sections.test.ts
git commit -m "feat(markdown): countSections derived from sceneBreak nodes"
```

---

### Task 2 : Suivi de l'existence des notes (`chaptersWithNote`)

**Files:**
- Modify: `src/renderer/stores/projectStore.ts`

> Contexte : Task 14 a ajouté `getChapterNotePath`/`loadChapterNote`/`saveChapterNote` et l'état `chapterRefs`. Les 3 chemins d'ouverture (`openRecentProject` ~l.428, `openProject`, `openLastProject`/`loadLastProject`) appellent `loadManuscriptFromDisk` puis posent l'état via `set({...})`.

- [ ] **Step 1 : Déclarer l'état + l'action dans `ProjectState`**

Près de `chapterRefs` dans l'interface `ProjectState`, ajouter :
```typescript
  chaptersWithNote: Set<string>   // chapter ids that have a .note.md sidecar
```
Et près de `saveChapterNote` :
```typescript
  refreshChaptersWithNote: () => Promise<void>
```

- [ ] **Step 2 : Initialiser l'état**

Dans l'état initial du store (à côté de `chapterRefs: []`), ajouter :
```typescript
  chaptersWithNote: new Set<string>(),
```

- [ ] **Step 3 : Implémenter `refreshChaptersWithNote`**

Après `getChapterNotePath` (ou près des helpers de note), ajouter :
```typescript
  // Probe each chapter's sidecar to know which notes exist (for the TDM item).
  refreshChaptersWithNote: async () => {
    const { projectPath, chapterRefs } = get()
    if (!projectPath) { set({ chaptersWithNote: new Set() }); return }
    const entries = await Promise.all(
      chapterRefs.map(async (ref) => {
        const notePath = `${projectPath}/${ref.file.replace(/\.md$/, '.note.md')}`
        const exists = await window.electronAPI.exists(notePath)
        return exists ? ref.id : null
      })
    )
    set({ chaptersWithNote: new Set(entries.filter((id): id is string => id !== null)) })
  },
```

- [ ] **Step 4 : Mettre à jour le Set dans `saveChapterNote`**

In `saveChapterNote`, after the write/delete, update the set:
```typescript
  saveChapterNote: async (id, note) => {
    const path = get().getChapterNotePath(id)
    if (!path) return
    const next = new Set(get().chaptersWithNote)
    if (note.trim() === '') {
      await window.electronAPI.deleteFile(path)
      next.delete(id)
    } else {
      await window.electronAPI.writeFile(path, note)
      next.add(id)
    }
    set({ chaptersWithNote: next })
  },
```
(Replace the existing `saveChapterNote` body from Task 14 with this version — same behavior plus the set update.)

- [ ] **Step 5 : Appeler `refreshChaptersWithNote` après chaque ouverture**

In each of the three open paths, AFTER the `set({...})` that sets `chapterRefs`, call:
```typescript
      void get().refreshChaptersWithNote()
```
(Fire-and-forget; the tree re-renders when the set lands. Place it after each path's main `set`. There are 3 sites.)

- [ ] **Step 6 : Reset on project close/create**

In `setProject` (the one that resets `activeSheetId`/`activeReportId`), and in `createNewProject`'s final `set`, ensure `chaptersWithNote` starts empty: add `chaptersWithNote: new Set()` to those `set({...})` calls (a freshly created project has no notes).

- [ ] **Step 7 : Vérifier compilation + tests**

Run : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`
Expected : build OK, 43 tests verts.

- [ ] **Step 8 : Commit**
```bash
git add src/renderer/stores/projectStore.ts
git commit -m "feat(store): track which chapters have a note sidecar"
```

---

### Task 3 : Vue note centrale — état `activeNoteId`

**Files:**
- Modify: `src/renderer/stores/projectStore.ts`

> Contexte : `setActiveDocument` (~l.399) pose `activeSheetId: null` ; `setActiveSheet`/`setActiveReport` (~l.404-406) gèrent l'exclusivité. EditorArea choisit la vue dans l'ordre report → sheet → doc (~l.309-330).

- [ ] **Step 1 : Déclarer l'état + l'action**

Dans `ProjectState`, près de `activeReportId` :
```typescript
  activeNoteId: string | null   // chapter id whose private note is open (center view)
```
et près de `setActiveReport` :
```typescript
  setActiveNote: (id: string | null) => void
```

- [ ] **Step 2 : Initialiser**

Dans l'état initial, à côté de `activeReportId: null`, ajouter :
```typescript
  activeNoteId: null,
```

- [ ] **Step 3 : Implémenter `setActiveNote` + exclusivité**

Add the setter and clear `activeNoteId` in the other three setters. Replace the existing three setters + add the new one so the block reads:
```typescript
  setActiveDocument: (id) => set({
    activeDocumentId: id && isValidDocumentId(id) ? id : null,
    activeSheetId: null,
    activeNoteId: null
  }),

  setActiveSheet: (id) => set({ activeSheetId: id, activeReportId: null, activeNoteId: null }),

  setActiveReport: (id) => set({ activeReportId: id, activeSheetId: null, activeNoteId: null }),

  setActiveNote: (id) => set({
    activeNoteId: id,
    activeDocumentId: null,
    activeSheetId: null,
    activeReportId: null
  }),
```

- [ ] **Step 4 : Reset dans `setProject`**

In `setProject` (~l.386), add `activeNoteId: null` to the reset `set({...})`.

- [ ] **Step 5 : Vérifier compilation**

Run : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build`
Expected : build OK.

- [ ] **Step 6 : Commit**
```bash
git add src/renderer/stores/projectStore.ts
git commit -m "feat(store): activeNoteId center-view state with view exclusivity"
```

---

### Task 4 : Composant `NoteEditor` + rendu dans `EditorArea`

**Files:**
- Create: `src/renderer/components/editor/NoteEditor.tsx`
- Modify: `src/renderer/components/editor/EditorArea.tsx`

> Contexte : modèle de coquille = `SheetEditor.tsx` (bouton retour, conteneur centré). On veut un simple `textarea` + autosave débouncé, PAS un éditeur riche (YAGNI). Le titre du chapitre se lit dans `project.manuscript.items`.

- [ ] **Step 1 : Créer `NoteEditor.tsx`**
```tsx
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'

/**
 * NoteEditor - center view for a chapter's private note (.note.md sidecar).
 * Plain textarea with debounced autosave. Never part of the manuscript/export.
 */
export function NoteEditor() {
  const { activeNoteId, project, loadChapterNote, saveChapterNote, setActiveDocument } = useProjectStore()
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const chapter = project && activeNoteId
    ? project.manuscript.items.find(i => i.id === activeNoteId)
    : null

  // Load the note when the active note changes.
  useEffect(() => {
    let cancelled = false
    if (!activeNoteId) return
    setLoading(true)
    loadChapterNote(activeNoteId).then((content) => {
      if (!cancelled) { setValue(content); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [activeNoteId, loadChapterNote])

  // Flush pending save on unmount / note switch.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const handleChange = (next: string) => {
    setValue(next)
    if (!activeNoteId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const id = activeNoteId
    saveTimer.current = setTimeout(() => { void saveChapterNote(id, next) }, 500)
  }

  if (!activeNoteId) return null

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <button
          onClick={() => {
            if (saveTimer.current) { clearTimeout(saveTimer.current); void saveChapterNote(activeNoteId, value) }
            setActiveDocument(activeNoteId)
          }}
          className="p-1 rounded hover:bg-accent text-muted-foreground"
          title="Retour au chapitre"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="text-sm font-medium">
          Note — {chapter?.title ?? 'Chapitre'}
        </span>
      </div>
      <textarea
        value={loading ? '' : value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Note privée du chapitre (jamais exportée)…"
        className="flex-1 w-full resize-none bg-background text-foreground p-6 focus:outline-none font-serif leading-relaxed"
        autoFocus
      />
    </div>
  )
}
```

- [ ] **Step 2 : Rendre `NoteEditor` dans `EditorArea`**

In `EditorArea.tsx`, add the import near the other view imports (l.20-21):
```typescript
import { NoteEditor } from './NoteEditor'
```
Add `activeNoteId` to the store destructuring (l.40):
```typescript
  const { activeDocumentId, activeSheetId, activeReportId, activeNoteId, project, setDirty } = useProjectStore()
```
In the render selection (l.308-316), add the note view FIRST (so it wins; the setters guarantee exclusivity):
```typescript
  // Show note editor if a chapter note is open
  if (activeNoteId) {
    return <NoteEditor />
  }

  // Show report viewer if a report is active
  if (activeReportId) {
    return <ReportViewer />
  }
```

- [ ] **Step 3 : Vérifier compilation**

Run : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build`
Expected : build OK (no unused vars).

- [ ] **Step 4 : Commit**
```bash
git add src/renderer/components/editor/NoteEditor.tsx src/renderer/components/editor/EditorArea.tsx
git commit -m "feat(editor): center NoteEditor view for chapter notes"
```

---

### Task 5 : Navigation vers une section (scroll)

**Files:**
- Modify: `src/renderer/stores/editorStore.ts`
- Modify: `src/renderer/components/editor/EditorArea.tsx`

> Contexte : `editorStore` détient l'instance `editor` (TipTap). EditorArea charge le contenu du chapitre dans un effet sur `activeDocumentId`. On veut : cliquer « Section N » ouvre le chapitre puis scrolle au début de la N-ième section (après le (N-1)-ième `sceneBreak`).

- [ ] **Step 1 : Ajouter l'état de scroll en attente dans `editorStore`**

In `EditorState` interface (editorStore.ts), add:
```typescript
  pendingSectionIndex: number | null
  requestSectionScroll: (index: number) => void
  clearPendingSectionScroll: () => void
```
In the initial state (near `editor: null`):
```typescript
  pendingSectionIndex: null,
```
In the store body (near `setEditor`):
```typescript
  requestSectionScroll: (index) => set({ pendingSectionIndex: index }),
  clearPendingSectionScroll: () => set({ pendingSectionIndex: null }),
```

- [ ] **Step 2 : Appliquer le scroll dans `EditorArea`**

In `EditorArea.tsx`, read `pendingSectionIndex` + actions from the editor store. Near the existing `useEditorStore` destructuring (l.41-47), add:
```typescript
  const { pendingSectionIndex, clearPendingSectionScroll } = useEditorStore()
```
Add an effect AFTER the content-loading effect (after l.206):
```typescript
  // Scroll to a requested section (1-indexed) once content is loaded.
  useEffect(() => {
    if (!editor || pendingSectionIndex == null) return
    // Section i starts after the (i-1)-th sceneBreak; section 1 = top.
    let breaksSeen = 0
    let targetPos: number | null = null
    if (pendingSectionIndex <= 1) {
      targetPos = 1
    } else {
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'sceneBreak') {
          breaksSeen += 1
          if (breaksSeen === pendingSectionIndex - 1) {
            targetPos = pos + node.nodeSize
            return false
          }
        }
        return true
      })
    }
    if (targetPos != null) {
      const pos = Math.min(targetPos, editor.state.doc.content.size)
      editor.chain().setTextSelection(pos).scrollIntoView().run()
    }
    clearPendingSectionScroll()
  }, [editor, activeDocumentId, pendingSectionIndex, clearPendingSectionScroll])
```

- [ ] **Step 3 : Vérifier compilation**

Run : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build`
Expected : build OK.

- [ ] **Step 4 : Commit**
```bash
git add src/renderer/stores/editorStore.ts src/renderer/components/editor/EditorArea.tsx
git commit -m "feat(editor): scroll to a chapter section by index"
```

---

### Task 6 : Rendu des items dérivés dans la TDM + retrait de la modale

**Files:**
- Modify: `src/renderer/components/layout/Sidebar.tsx`

> Contexte : `ManuscriptTreeItem` (~l.175-349) rend un chapitre. Task 14 y a ajouté une modale de note (état `noteOpen/noteValue/noteLoading`, handlers `handleOpenNote/handleSaveNote/handleCloseNote`, l'effet Escape, et le JSX de la modale) + l'entrée de menu « Note du chapitre ». Cette tâche : (a) retire la modale (remplacée par la vue centrale Task 4) ; (b) route « Note du chapitre » vers `setActiveNote` ; (c) rend les items dérivés Section N + Note sous le chapitre.

- [ ] **Step 1 : Retirer la modale de note (Task 14)**

In `ManuscriptTreeItem`, remove: the `noteOpen`/`noteValue`/`noteLoading` state, `handleOpenNote`/`handleSaveNote`/`handleCloseNote`, the Escape `useEffect` tied to `noteOpen`, the modal JSX block, and the `onLoadNote`/`onSaveNote` props if they become unused after Step 2. Also remove now-unused imports (`X`, `Save`) if nothing else uses them. (The store helpers `loadChapterNote`/`saveChapterNote` stay — `NoteEditor` uses them.)

- [ ] **Step 2 : Récupérer les actions + données nécessaires dans `ManuscriptPanel`**

In `ManuscriptPanel`, from `useProjectStore()` get `setActiveNote` and `chaptersWithNote` (in addition to existing). From `useEditorStore()` get `documentContents` and `requestSectionScroll`. Pass down to each `ManuscriptTreeItem` new props:
```typescript
  sectionCount: countSections(documentContents.get(item.id) ? JSON.stringify(... ) : ...)
```
IMPLEMENTATION NOTE: `documentContents` is a `Map<string,string>` (the value is already the JSON string). So compute per item: `const sectionCount = countSections(documentContents.get(item.id))`. Import `countSections` from `@shared/markdown`. Subscribe to `documentContents` so the count updates live (reading it from `useEditorStore()` already subscribes).

Pass these props to `ManuscriptTreeItem`:
```typescript
  hasNote={chaptersWithNote.has(item.id)}
  sectionCount={sectionCount}
  onSelectSection={(index) => { setActiveDocument(item.id); requestSectionScroll(index) }}
  onOpenNote={() => setActiveNote(item.id)}
  activeNoteId={activeNoteId}
```
(Get `setActiveDocument`, `activeDocumentId`, `activeNoteId` from the store too. `setActiveDocument` is needed to switch to the chapter before scrolling.)

- [ ] **Step 3 : Étendre les props de `ManuscriptTreeItem`**

Add to its props type:
```typescript
  hasNote: boolean
  sectionCount: number
  onSelectSection: (index: number) => void
  onOpenNote: () => void
  activeNoteId: string | null
```
Remove `onLoadNote`/`onSaveNote` from the props type (replaced by `onOpenNote`).

- [ ] **Step 4 : Router « Note du chapitre » vers la vue centrale**

Replace the context-menu "Note du chapitre" `ContextMenuItem`'s onClick (was `handleOpenNote`) with `onOpenNote`. This both creates (opens empty center view) and opens an existing note.

- [ ] **Step 5 : Rendre les enfants dérivés sous le chapitre**

The chapter row has an expand chevron. Derived children should show when expanded. Compute `const hasDerivedChildren = sectionCount >= 2 || hasNote`. Use `hasDerivedChildren` for the chevron (replace the old `hasChildren` based on `item.children`, which is always empty now). After the chapter `<button>` (and after the existing children render, which is now empty), when `expanded && hasDerivedChildren`, render:
```tsx
        {expanded && (
          <div>
            {sectionCount >= 2 && Array.from({ length: sectionCount }, (_, i) => (
              <button
                key={`sec-${i}`}
                onClick={() => onSelectSection(i + 1)}
                className="w-full flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-accent"
                style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
              >
                <span className="w-4" />
                <FileText size={12} />
                <span className="truncate flex-1 text-left">Section {i + 1}</span>
              </button>
            ))}
            {hasNote && (
              <button
                onClick={onOpenNote}
                className={cn(
                  'w-full flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-accent',
                  activeNoteId === item.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                )}
                style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
              >
                <span className="w-4" />
                <StickyNote size={12} />
                <span className="truncate flex-1 text-left">Note</span>
              </button>
            )}
          </div>
        )}
```
Add `StickyNote` to the lucide imports if not present. Ensure the chevron uses `hasDerivedChildren` (so a chapter with sections/note can expand/collapse).

- [ ] **Step 6 : Vérifier compilation + tests**

Run : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`
Expected : build OK (no unused vars/imports), 43 tests verts.

- [ ] **Step 7 : Commit**
```bash
git add src/renderer/components/layout/Sidebar.tsx
git commit -m "feat(tdm): derived section + note items under chapters; drop note modal"
```

---

### Task 7 : Vérification bout-en-bout

**Files:** aucun (vérification)

- [ ] **Step 1 : Build + tests complets**

Run : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`
Expected : build OK, 43 tests verts.

- [ ] **Step 2 : Cycle manuel**

Run : `npm run launch:dev`
Scénario :
1. Chapitre sans `* * *` → **aucun** item « Section » sous lui.
2. Insérer 2 sauts de scène (menu « Insérer un saut de scène ») → « Section 1/2/3 » apparaissent (après le débounce). Cliquer « Section 2 » → l'éditeur scrolle au début de la 2e section.
3. Cliquer sur un autre chapitre puis « Section N » du premier → ouvre le bon chapitre et scrolle.
4. Ajouter une note via « Note du chapitre » → la note s'ouvre **au centre** (pas de modale) ; saisir du texte ; revenir au chapitre → un item « Note » apparaît sous le chapitre. Cliquer l'item « Note » → rouvre la note au centre.
5. Vider la note et revenir → l'item « Note » disparaît ; rouvrir/fermer le projet → l'item reflète l'existence réelle du sidecar.
6. Confirmer que sélectionner un chapitre/fiche referme la vue note.

- [ ] **Step 3 : Commit (si correctifs)**
```bash
git add -A
git commit -m "test: end-to-end verification of TDM sections + notes"
```

---

## Auto-revue (couverture du spec)

- Décision 1-2 (sections navigation, comptées par `sceneBreak`) → Task 1 (`countSections`), Task 6. ✅
- Décision 3 (affichage si ≥ 2 sections) → Task 6 (`sectionCount >= 2`). ✅
- Décision 4 (libellé « Section N ») → Task 6. ✅
- Décision 5 (clic section → ouvrir + scroll) → Task 5 + Task 6 (`onSelectSection`). ✅
- Décision 6 (item note si existe) → Task 2 (`chaptersWithNote`) + Task 6 (`hasNote`). ✅
- Décision 7 (clic note → vue centrale, modale retirée) → Task 3 (`activeNoteId`), Task 4 (`NoteEditor`), Task 6 (retrait modale). ✅
- Décision 8 (création/suppression via menu, item apparaît/disparaît) → Task 6 (menu → `setActiveNote`) + Task 2 (set maj dans `saveChapterNote`). ✅
- Gestion d'erreurs (doc invalide → 0 section ; `exists` échoue → pas d'item) → Task 1, Task 2. ✅
- Hors périmètre (métadonnées par section, éditeur riche note, stockage) respecté.

## Cohérence des types/signatures

- `countSections(docJson: string | undefined): number` — Task 1, appelée Task 6.
- `chaptersWithNote: Set<string>` + `refreshChaptersWithNote(): Promise<void>` — Task 2.
- `activeNoteId: string | null` + `setActiveNote(id)` — Task 3, utilisés Tasks 4 & 6.
- `pendingSectionIndex` + `requestSectionScroll(index)` + `clearPendingSectionScroll()` — Task 5, utilisés Task 6 (requestSectionScroll) et EditorArea.
- `saveChapterNote`/`loadChapterNote` (Task 14) — réutilisés par `NoteEditor` (Task 4) ; `saveChapterNote` étendu Task 2.
- Props `ManuscriptTreeItem` : `hasNote`, `sectionCount`, `onSelectSection`, `onOpenNote`, `activeNoteId` — Task 6 ; `onLoadNote`/`onSaveNote` retirés Task 6.
