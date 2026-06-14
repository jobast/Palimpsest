# Section « Univers » + éditeur de fiche (slices 1+2) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Ajouter une section « Univers » (commutateur Écriture/Univers, 3 volets) avec un navigateur de fiches et un éditeur de fiche (titre, champs structurés dont la carte des lieux, corps markdown autosave, backlinks) — édition manuelle.

**Architecture:** Nouvel état `activeSection` (uiStore) ; nouveau `wikiStore` (Zustand) par-dessus `wikiIO` ; `Layout` rend `UniversLayout` (navigateur + éditeur + volet droit réservé) quand la section est « univers ». Composants sous `src/renderer/components/univers/`. Réutilise `@shared/wiki` (backlinks, types) et `MapPicker`.

**Tech Stack:** React 18, Zustand 4, `@shared/wiki`, `MapPicker` (leaflet). Branche `feat/wiki`. Préfixer node par `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`. Build `npm run build` ; tests `npm run test:main` (89 verts). Vérif comportementale = manuelle (`npm run launch:dev`), pas de harnais renderer.

---

## Structure des fichiers
**Créés :**
- `src/shared/wiki/group.ts` — `ficheKey`, `groupFichesByCategory` (purs, testés).
- `src/renderer/stores/wikiStore.ts` — store wiki renderer.
- `src/renderer/components/univers/UniversLayout.tsx`
- `src/renderer/components/univers/FicheNavigator.tsx`
- `src/renderer/components/univers/FicheEditor.tsx`
- `src/renderer/components/univers/FicheStructuredFields.tsx`
- Test : `src/main/__tests__/wiki.group.test.ts`
**Modifiés :**
- `src/renderer/stores/uiStore.ts` — `activeSection` + `setActiveSection`.
- `src/shared/wiki/index.ts` — exporter `./group.js`.
- `src/renderer/components/layout/Layout.tsx` — commutateur + rendu Univers.

---

### Task 1 : Helpers purs de regroupement + état section

**Files:**
- Create: `src/shared/wiki/group.ts`
- Modify: `src/shared/wiki/index.ts`
- Test: `src/main/__tests__/wiki.group.test.ts`
- Modify: `src/renderer/stores/uiStore.ts`

- [ ] **Step 1 : test qui échoue** — Créer `src/main/__tests__/wiki.group.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { ficheKey, groupFichesByCategory } from '../../shared/wiki/group.js'
import type { Fiche } from '../../shared/wiki/types.js'

const f = (category: Fiche['category'], slug: string, title: string): Fiche =>
  ({ slug, category, title, created: '2026-06-14', body: '' })

test('ficheKey is category/slug', () => {
  assert.equal(ficheKey(f('lieux', 'paris', 'Paris')), 'lieux/paris')
})

test('groupFichesByCategory groups in canonical category order, sorts by title', () => {
  const groups = groupFichesByCategory([
    f('lieux', 'b', 'Beta'), f('personnages', 'z', 'Zoe'), f('personnages', 'a', 'Alice'), f('lieux', 'a', 'Alpha')
  ])
  assert.deepEqual(groups.map(g => g.category), ['personnages', 'lieux'])
  assert.deepEqual(groups[0].fiches.map(x => x.title), ['Alice', 'Zoe'])
  assert.deepEqual(groups[1].fiches.map(x => x.title), ['Alpha', 'Beta'])
})

test('empty categories are omitted', () => {
  const groups = groupFichesByCategory([f('notes', 'n', 'Note')])
  assert.deepEqual(groups.map(g => g.category), ['notes'])
})
```

- [ ] **Step 2 : run (fail)** — `npm run test:main`.

- [ ] **Step 3 : implémenter** — Créer `src/shared/wiki/group.ts` :
```typescript
import { WIKI_CATEGORIES, type Fiche, type WikiCategory } from './types.js'

export function ficheKey(fiche: Fiche): string {
  return `${fiche.category}/${fiche.slug}`
}

export interface FicheGroup { category: WikiCategory; fiches: Fiche[] }

/** Group fiches by category (canonical order), each group sorted by title. Empty groups omitted. */
export function groupFichesByCategory(fiches: Fiche[]): FicheGroup[] {
  const groups: FicheGroup[] = []
  for (const category of WIKI_CATEGORIES) {
    const inCat = fiches.filter(f => f.category === category)
      .sort((a, b) => a.title.localeCompare(b.title))
    if (inCat.length) groups.push({ category, fiches: inCat })
  }
  return groups
}
```

- [ ] **Step 4 : baril** — Dans `src/shared/wiki/index.ts`, ajouter `export * from './group.js'`.

- [ ] **Step 5 : run (pass)** — `npm run test:main` (→ 92).

- [ ] **Step 6 : état section (uiStore)** — Dans `src/renderer/stores/uiStore.ts` :
  - Ajouter au type `UIState` : `activeSection: 'ecriture' | 'univers'` et `setActiveSection: (s: 'ecriture' | 'univers') => void`.
  - Dans le `create(persist(...))`, état initial : `activeSection: 'ecriture'`, et l'action `setActiveSection: (activeSection) => set({ activeSection })`.
  - Si le `persist` a une liste `partialize`, y inclure `activeSection` (sinon laisser : tout est persisté).

- [ ] **Step 7 : build + commit** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main` puis :
```bash
git add src/shared/wiki/group.ts src/shared/wiki/index.ts src/main/__tests__/wiki.group.test.ts src/renderer/stores/uiStore.ts
git commit -m "feat(univers): fiche grouping helpers (pure) + activeSection UI state"
```

---

### Task 2 : Store wiki renderer

**Files:** Create `src/renderer/stores/wikiStore.ts`

- [ ] **Step 1 : implémenter** — Créer `src/renderer/stores/wikiStore.ts` :
```typescript
import { create } from 'zustand'
import { type Fiche, type WikiCategory, ficheKey } from '@shared/wiki'
import { loadFiches, saveFiche as ioSaveFiche, deleteFiche as ioDeleteFiche, createFiche as ioCreateFiche } from '@/lib/wiki/wikiIO'
import { useProjectStore } from './projectStore'

interface WikiState {
  fiches: Fiche[]
  activeFicheKey: string | null
  loadedPath: string | null
  isLoading: boolean

  loadWiki: (projectPath: string) => Promise<void>
  ensureLoaded: () => Promise<void>
  setActiveFiche: (key: string | null) => void
  getActiveFiche: () => Fiche | null
  saveFiche: (fiche: Fiche) => Promise<void>
  createFiche: (category: WikiCategory, title: string) => Promise<void>
  deleteFiche: (fiche: Fiche) => Promise<void>
}

export const useWikiStore = create<WikiState>((set, get) => ({
  fiches: [],
  activeFicheKey: null,
  loadedPath: null,
  isLoading: false,

  loadWiki: async (projectPath) => {
    set({ isLoading: true })
    const fiches = await loadFiches(projectPath)
    set({ fiches, loadedPath: projectPath, isLoading: false })
  },

  ensureLoaded: async () => {
    const { projectPath } = useProjectStore.getState()
    if (!projectPath) return
    if (get().loadedPath === projectPath) return
    await get().loadWiki(projectPath)
  },

  setActiveFiche: (key) => set({ activeFicheKey: key }),

  getActiveFiche: () => {
    const { fiches, activeFicheKey } = get()
    return fiches.find(f => ficheKey(f) === activeFicheKey) ?? null
  },

  saveFiche: async (fiche) => {
    const { projectPath } = useProjectStore.getState()
    if (!projectPath) return
    await ioSaveFiche(projectPath, fiche)
    set(state => ({
      fiches: state.fiches.map(f => ficheKey(f) === ficheKey(fiche) ? fiche : f)
    }))
  },

  createFiche: async (category, title) => {
    const { projectPath } = useProjectStore.getState()
    if (!projectPath) return
    const fiche = await ioCreateFiche(projectPath, category, title, '', get().fiches)
    set(state => ({ fiches: [...state.fiches, fiche], activeFicheKey: ficheKey(fiche) }))
  },

  deleteFiche: async (fiche) => {
    const { projectPath } = useProjectStore.getState()
    if (!projectPath) return
    await ioDeleteFiche(projectPath, fiche)
    set(state => ({
      fiches: state.fiches.filter(f => ficheKey(f) !== ficheKey(fiche)),
      activeFicheKey: state.activeFicheKey === ficheKey(fiche) ? null : state.activeFicheKey
    }))
  }
}))
```
(Vérifier que `@shared/wiki` exporte `ficheKey` — ajouté en Task 1 — et que `wikiIO` exporte `loadFiches/saveFiche/createFiche/deleteFiche` ; adapter les noms si besoin après lecture des fichiers.)

- [ ] **Step 2 : build** — `npm run build`. Expected: OK.
- [ ] **Step 3 : commit** — `git add src/renderer/stores/wikiStore.ts && git commit -m "feat(univers): wiki renderer store over wikiIO"`

---

### Task 3 : Champs structurés de fiche

**Files:** Create `src/renderer/components/univers/FicheStructuredFields.tsx`

- [ ] **Step 1 : implémenter** — Créer `src/renderer/components/univers/FicheStructuredFields.tsx` :
```tsx
import { MapPicker } from '../maps/MapPicker'
import type { Fiche } from '@shared/wiki'

interface Props {
  fiche: Fiche
  onChange: (meta: Record<string, unknown>) => void
}

function setMeta(fiche: Fiche, key: string, value: unknown): Record<string, unknown> {
  const meta = { ...(fiche.meta ?? {}) }
  if (value === undefined || value === '' || value === null) delete meta[key]
  else meta[key] = value
  return meta
}

/** Category-specific structured fields, read/written into fiche.meta. */
export function FicheStructuredFields({ fiche, onChange }: Props) {
  const meta = fiche.meta ?? {}

  if (fiche.category === 'lieux') {
    const coords = meta.coordinates as { latitude: number; longitude: number } | undefined
    const zoom = typeof meta.mapZoom === 'number' ? meta.mapZoom : 13
    return (
      <div className="space-y-2 p-3 border-b border-border">
        <MapPicker
          coordinates={coords}
          zoom={zoom}
          onChange={(c, z) => onChange({ ...setMeta(fiche, 'coordinates', c), mapZoom: z })}
          className="h-48 rounded"
        />
        <input
          className="w-full bg-background border border-border rounded px-2 py-1 text-sm"
          placeholder="Importance narrative…"
          value={(meta.significance as string) ?? ''}
          onChange={e => onChange(setMeta(fiche, 'significance', e.target.value))}
        />
        <textarea
          className="w-full bg-background border border-border rounded px-2 py-1 text-sm resize-none"
          rows={2}
          placeholder="Détails sensoriels…"
          value={(meta.sensoryDetails as string) ?? ''}
          onChange={e => onChange(setMeta(fiche, 'sensoryDetails', e.target.value))}
        />
      </div>
    )
  }

  if (fiche.category === 'personnages') {
    const roles = ['protagonist', 'antagonist', 'secondary', 'minor'] as const
    return (
      <div className="space-y-2 p-3 border-b border-border">
        <select
          className="w-full bg-background border border-border rounded px-2 py-1 text-sm"
          value={(meta.role as string) ?? ''}
          onChange={e => onChange(setMeta(fiche, 'role', e.target.value))}
        >
          <option value="">(rôle…)</option>
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input
          className="w-full bg-background border border-border rounded px-2 py-1 text-sm"
          placeholder="Apparence physique…"
          value={(meta.physicalDescription as string) ?? ''}
          onChange={e => onChange(setMeta(fiche, 'physicalDescription', e.target.value))}
        />
      </div>
    )
  }

  return null
}
```
(Vérifier l'export et les props exacts de `MapPicker` : `coordinates?`, `zoom?`, `onChange:(coords,zoom)=>void`, `className?`.)

- [ ] **Step 2 : build** — `npm run build`. Expected: OK.
- [ ] **Step 3 : commit** — `git add src/renderer/components/univers/FicheStructuredFields.tsx && git commit -m "feat(univers): structured fiche fields (map for lieux, role for persos)"`

---

### Task 4 : Éditeur de fiche (centre)

**Files:** Create `src/renderer/components/univers/FicheEditor.tsx`

- [ ] **Step 1 : implémenter** — Créer `src/renderer/components/univers/FicheEditor.tsx` :
```tsx
import { useEffect, useRef, useState } from 'react'
import { useWikiStore } from '@/stores/wikiStore'
import { FicheStructuredFields } from './FicheStructuredFields'
import { backlinks, ficheKey, type Fiche } from '@shared/wiki'

export function FicheEditor() {
  const { getActiveFiche, fiches, saveFiche, setActiveFiche } = useWikiStore()
  const fiche = getActiveFiche()
  const [draft, setDraft] = useState<Fiche | null>(fiche)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const key = fiche ? ficheKey(fiche) : null

  // Reload the draft when the active fiche changes.
  useEffect(() => { setDraft(fiche) /* eslint-disable-next-line */ }, [key])

  // Flush pending save on unmount / fiche switch.
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [key])

  if (!fiche || !draft) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Sélectionnez une fiche</div>
  }

  const scheduleSave = (next: Fiche) => {
    setDraft(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void saveFiche(next) }, 500)
  }

  const back = backlinks(fiche, fiches)

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <input
          className="flex-1 bg-transparent text-lg font-semibold focus:outline-none"
          value={draft.title}
          onChange={e => scheduleSave({ ...draft, title: e.target.value })}
        />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{draft.category}</span>
      </div>

      <FicheStructuredFields fiche={draft} onChange={meta => scheduleSave({ ...draft, meta })} />

      <textarea
        className="flex-1 w-full resize-none bg-background text-foreground p-4 focus:outline-none font-serif leading-relaxed min-h-[12rem]"
        placeholder="Contenu de la fiche (markdown)…"
        value={draft.body}
        onChange={e => scheduleSave({ ...draft, body: e.target.value })}
      />

      {back.length > 0 && (
        <div className="px-4 py-2 border-t border-border text-xs">
          <div className="text-muted-foreground mb-1">Rétroliens</div>
          <div className="flex flex-wrap gap-2">
            {back.map(b => (
              <button
                key={ficheKey(b)}
                onClick={() => setActiveFiche(ficheKey(b))}
                className="px-2 py-0.5 rounded bg-accent hover:bg-accent/70"
              >
                {b.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2 : build** — `npm run build`. Expected: OK.
- [ ] **Step 3 : commit** — `git add src/renderer/components/univers/FicheEditor.tsx && git commit -m "feat(univers): fiche editor (title, structured fields, markdown body autosave, backlinks)"`

---

### Task 5 : Navigateur de fiches (gauche)

**Files:** Create `src/renderer/components/univers/FicheNavigator.tsx`

- [ ] **Step 1 : implémenter** — Créer `src/renderer/components/univers/FicheNavigator.tsx` :
```tsx
import { useState } from 'react'
import { useWikiStore } from '@/stores/wikiStore'
import { groupFichesByCategory, ficheKey, WIKI_CATEGORIES, type WikiCategory } from '@shared/wiki'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const CATEGORY_LABELS: Record<WikiCategory, string> = {
  personnages: 'Personnages', lieux: 'Lieux', intrigues: 'Intrigues',
  structure: 'Structure', ecriture: 'Écriture', notes: 'Notes'
}

export function FicheNavigator() {
  const { fiches, activeFicheKey, setActiveFiche, createFiche, deleteFiche } = useWikiStore()
  const [adding, setAdding] = useState<WikiCategory | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const groups = groupFichesByCategory(fiches)

  const submitNew = (category: WikiCategory) => {
    const title = newTitle.trim()
    if (title) void createFiche(category, title)
    setAdding(null); setNewTitle('')
  }

  return (
    <div className="p-2 space-y-3 overflow-auto h-full">
      {WIKI_CATEGORIES.map(category => {
        const group = groups.find(g => g.category === category)
        return (
          <div key={category}>
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{CATEGORY_LABELS[category]}</span>
              <button onClick={() => { setAdding(category); setNewTitle('') }} className="p-0.5 rounded hover:bg-accent text-muted-foreground" title="Nouvelle fiche">
                <Plus size={13} />
              </button>
            </div>
            {adding === category && (
              <input
                autoFocus
                className="w-full mb-1 bg-background border border-border rounded px-1 text-sm"
                value={newTitle}
                placeholder="Titre…"
                onChange={e => setNewTitle(e.target.value)}
                onBlur={() => submitNew(category)}
                onKeyDown={e => { if (e.key === 'Enter') submitNew(category); if (e.key === 'Escape') { setAdding(null); setNewTitle('') } }}
              />
            )}
            <div className="space-y-0.5">
              {group?.fiches.map(f => {
                const key = ficheKey(f)
                return (
                  <div
                    key={key}
                    className={cn('group flex items-center gap-1 px-2 py-1 rounded text-sm cursor-pointer',
                      activeFicheKey === key ? 'bg-primary/10 text-primary' : 'hover:bg-accent')}
                    onClick={() => setActiveFiche(key)}
                  >
                    <span className="truncate flex-1">{f.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm(`Supprimer « ${f.title} » ?`)) void deleteFiche(f) }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent text-muted-foreground"
                      title="Supprimer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2 : build** — `npm run build`. Expected: OK.
- [ ] **Step 3 : commit** — `git add src/renderer/components/univers/FicheNavigator.tsx && git commit -m "feat(univers): fiche navigator (by category, create/delete)"`

---

### Task 6 : Agencement Univers + commutateur dans Layout

**Files:**
- Create: `src/renderer/components/univers/UniversLayout.tsx`
- Modify: `src/renderer/components/layout/Layout.tsx`

- [ ] **Step 1 : UniversLayout** — Créer `src/renderer/components/univers/UniversLayout.tsx` :
```tsx
import { useEffect } from 'react'
import { useWikiStore } from '@/stores/wikiStore'
import { FicheNavigator } from './FicheNavigator'
import { FicheEditor } from './FicheEditor'

export function UniversLayout() {
  const ensureLoaded = useWikiStore(s => s.ensureLoaded)
  useEffect(() => { void ensureLoaded() }, [ensureLoaded])

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-64 border-r border-border bg-card overflow-hidden">
        <FicheNavigator />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <FicheEditor />
      </div>
      {/* Volet droit réservé (dashboards/suggestions/recherche — slice 4) */}
      <div className="w-72 border-l border-border bg-card hidden xl:block" />
    </div>
  )
}
```

- [ ] **Step 2 : commutateur + rendu dans Layout** — Dans `src/renderer/components/layout/Layout.tsx` :
  - Importer : `import { UniversLayout } from '../univers/UniversLayout'` et ajouter `activeSection, setActiveSection` au destructuring `useUIStore()`.
  - Dans la titlebar (le `<div className="h-8 titlebar-drag-region …">`), après le `<span>{project.meta.name}</span>`, ajouter un commutateur (non-draggable) :
```tsx
        <div className="ml-4 flex items-center gap-1 titlebar-no-drag">
          <button
            onClick={() => setActiveSection('ecriture')}
            className={cn('px-2 py-0.5 rounded text-xs', activeSection === 'ecriture' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}
          >Écriture</button>
          <button
            onClick={() => setActiveSection('univers')}
            className={cn('px-2 py-0.5 rounded text-xs', activeSection === 'univers' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}
          >Univers</button>
        </div>
```
  (Si la classe `titlebar-no-drag` n'existe pas, utiliser `style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}` sur le conteneur du commutateur pour qu'il reste cliquable malgré la drag-region.)
  - Remplacer le bloc « Main content » : quand `activeSection === 'univers'` ET pas en focusMode, rendre `<UniversLayout />` à la place de l'agencement Écriture (Sidebar+Editor+right). Concrètement, après la titlebar :
```tsx
      {activeSection === 'univers' && !focusMode ? (
        <UniversLayout />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* …agencement Écriture existant (sidebar gauche + editor + right sidebar)… */}
        </div>
      )}
```
  Garder l'agencement Écriture existant **inchangé** dans la branche `else`.

- [ ] **Step 3 : build** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, 92 tests verts.

- [ ] **Step 4 : commit** — `git add src/renderer/components/univers/UniversLayout.tsx src/renderer/components/layout/Layout.tsx && git commit -m "feat(univers): Univers section layout + Écriture/Univers switch"`

---

### Task 7 : Vérification (manuelle)

- [ ] **Step 1 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, 92 verts.
- [ ] **Step 2 : cycle manuel** — `npm run launch:dev`, projet ouvert :
  1. Le commutateur **Écriture/Univers** apparaît ; **Écriture inchangé** (manuscrit + panneaux).
  2. Passer en **Univers** → navigateur de fiches à gauche (vide au début).
  3. Créer une fiche **personnage** (« + » → titre) ; éditer le rôle + le corps ; revenir/rouvrir → persisté en `wiki/personnages/<slug>.md`.
  4. Créer une fiche **lieu** ; poser une position sur la **carte** → rouvrir → `meta.coordinates`/`mapZoom` persistent (carte recentrée).
  5. Dans une fiche, écrire `[[autre-fiche]]` → l'autre fiche montre un **rétrolien** cliquable.
  6. Supprimer une fiche (confirmation) → disparaît ; restaurable via `.recovery` si besoin.
  7. Rebasculer en **Écriture** → tout est intact.
- [ ] **Step 3 : commit (si correctifs)** — `git add -A && git commit -m "fix(univers): adjustments from manual verification"`

---

## Auto-revue (couverture du spec)
- Commutateur Écriture/Univers + état → Task 1 (uiStore) + Task 6 (Layout). ✅
- Disposition 3 volets (nav/éditeur/droite réservée) → Task 6 (UniversLayout). ✅
- Navigateur fiches par catégorie + créer/supprimer → Task 5 + helpers Task 1. ✅
- Store wiki (charge paresseuse, save/create/delete) → Task 2. ✅
- Éditeur fiche : titre, champs structurés (carte lieux), corps markdown autosave, backlinks → Tasks 3, 4. ✅
- Réutilise `@shared/wiki` (backlinks, group, ficheKey) + `wikiIO` + `MapPicker`. ✅
- Édition manuelle seule ; IA/panneau droit/compagnon/migration = hors périmètre. ✅
- Tests purs (group) → Task 1 ; le reste = vérif manuelle (pas de harnais renderer), conforme au spec. ✅

## Cohérence des types/signatures
- `ficheKey(fiche): string`, `groupFichesByCategory(fiches): FicheGroup[]` — Task 1, utilisés Tasks 2/4/5.
- `useWikiStore` : `fiches, activeFicheKey, ensureLoaded, setActiveFiche, getActiveFiche, saveFiche, createFiche, deleteFiche` — Task 2, utilisés Tasks 4/5/6.
- `wikiIO` : `loadFiches/saveFiche/createFiche/deleteFiche` (signatures `(projectPath, …)`) — déjà en place.
- `MapPicker` props : `coordinates?`, `zoom?`, `onChange:(coords,zoom)=>void`, `className?` — Task 3.
- `uiStore.activeSection: 'ecriture'|'univers'` + `setActiveSection` — Task 1, utilisé Task 6.
