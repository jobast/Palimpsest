# Wiki W1 — Cœur stockage + modèle — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser le cœur TypeScript pur du wiki (modèle, codecs frontmatter↔objets, parsing des suggestions LLM, log), entièrement testable `node:test`.

**Architecture:** Modules purs sous `src/shared/wiki/`, réutilisant l'infra markdown existante (`src/shared/markdown/frontmatter` pour le YAML, `src/shared/markdown/filename` pour `slugify`). Aucune E/S, aucun DOM. Les fiches portent leurs champs structurés via un sac `meta` (frontmatter ouvert) pour préserver carte/rôle/relations. La couche disque (renderer + IPC) viendra dans un plan suivant (W1b).

**Tech Stack:** TypeScript, `js-yaml` (via l'infra markdown), `node:test`. Branche `feat/wiki`.

**Environnement :** node via nvm — préfixer par `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`. Tests `npm run test:main` (actuellement 53 verts). Imports relatifs `src/shared/` en `.js`.

---

## Structure des fichiers (créés)
- `src/shared/wiki/types.ts` — `WikiCategory`, `Fiche`, `Suggestion`, `Alert` (+ sous-types).
- `src/shared/wiki/fiche.ts` — `parseFiche`, `serializeFiche`, `addSourceToFiche`.
- `src/shared/wiki/suggestion.ts` — `parseSuggestionsBlock`, `serializeSuggestion`, `parseSuggestion`.
- `src/shared/wiki/alert.ts` — `parseAlert`, `serializeAlert`, `suggestionToAlert`.
- `src/shared/wiki/log.ts` — `formatLogEntry`, `prependLogEntry`.
- `src/shared/wiki/index.ts` — baril.
- Tests : `src/main/__tests__/wiki.fiche.test.ts`, `wiki.suggestion.test.ts`, `wiki.alert.test.ts`, `wiki.log.test.ts`.

---

### Task 1 : Types + codec fiche

**Files:**
- Create: `src/shared/wiki/types.ts`
- Create: `src/shared/wiki/fiche.ts`
- Test: `src/main/__tests__/wiki.fiche.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/main/__tests__/wiki.fiche.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFiche, serializeFiche, addSourceToFiche } from '../../shared/wiki/fiche.js'
import type { Fiche } from '../../shared/wiki/types.js'

test('round-trip preserves core fields and structured meta', () => {
  const md = [
    '---', 'titre: Marseille', 'categorie: lieux', 'cree: 2026-06-14',
    'last_updated: 2026-06-14', 'sources: [ch-1, ch-2]',
    'coordinates: {latitude: 43.3, longitude: 5.4}', 'mapZoom: 11',
    '---', 'Ville portuaire.', ''
  ].join('\n')
  const fiche = parseFiche(md, 'marseille', 'lieux')
  assert.equal(fiche.title, 'Marseille')
  assert.equal(fiche.category, 'lieux')
  assert.equal(fiche.slug, 'marseille')
  assert.deepEqual(fiche.sources, ['ch-1', 'ch-2'])
  assert.equal(fiche.body.trim(), 'Ville portuaire.')
  // structured fields land in meta
  assert.equal(fiche.meta?.mapZoom, 11)
  assert.deepEqual(fiche.meta?.coordinates, { latitude: 43.3, longitude: 5.4 })
  // re-serialize keeps them
  const out = serializeFiche(fiche)
  assert.match(out, /titre: Marseille/)
  assert.match(out, /mapZoom: 11/)
  assert.match(out, /latitude: 43\.3/)
  const reparsed = parseFiche(out, 'marseille', 'lieux')
  assert.equal(reparsed.meta?.mapZoom, 11)
})

test('missing/invalid frontmatter falls back without throwing', () => {
  const fiche = parseFiche('Juste du texte.', '003-x', 'notes')
  assert.equal(fiche.slug, '003-x')
  assert.equal(fiche.category, 'notes')
  assert.equal(fiche.title, '003-x')          // fallback to slug
  assert.equal(fiche.body.trim(), 'Juste du texte.')
})

test('invalid category in frontmatter falls back to provided category', () => {
  const md = '---\ntitre: X\ncategorie: bogus\ncree: 2026-06-14\n---\nb'
  const fiche = parseFiche(md, 'x', 'personnages')
  assert.equal(fiche.category, 'personnages')
})

test('addSourceToFiche is idempotent and refreshes lastUpdated', () => {
  const base: Fiche = { slug: 'a', category: 'notes', title: 'A', created: '2026-06-01', body: 'x', sources: ['ch-1'] }
  const once = addSourceToFiche(base, 'ch-2', '2026-06-14')
  assert.deepEqual(once.sources, ['ch-1', 'ch-2'])
  assert.equal(once.lastUpdated, '2026-06-14')
  const twice = addSourceToFiche(once, 'ch-2', '2026-06-15')
  assert.deepEqual(twice.sources, ['ch-1', 'ch-2'])   // no dup
  assert.equal(twice.lastUpdated, '2026-06-14')       // unchanged when nothing added
})
```

- [ ] **Step 2 : Lancer le test (échec)** — Run `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run test:main`. Expected: FAIL — modules `types.js`/`fiche.js` introuvables.

- [ ] **Step 3 : Implémenter les types** — Créer `src/shared/wiki/types.ts` :
```typescript
export type WikiCategory =
  | 'personnages' | 'lieux' | 'intrigues' | 'structure' | 'ecriture' | 'notes'

export const WIKI_CATEGORIES: WikiCategory[] =
  ['personnages', 'lieux', 'intrigues', 'structure', 'ecriture', 'notes']

export interface Fiche {
  slug: string
  category: WikiCategory
  title: string
  created: string
  body: string
  lastUpdated?: string
  sources?: string[]
  type?: string
  meta?: Record<string, unknown>   // structured fields preserved from frontmatter
}

export type SuggestionType = 'nouvelle_fiche' | 'ajout' | 'incoherence'
export interface Suggestion {
  id: string
  type: SuggestionType
  cible: string
  title: string
  resume: string
  body: string
  sourceChapitre?: string
}

export type AlertType = 'contradiction' | 'nom_manquant' | 'decision' | 'autre'
export type AlertStatus = 'ouverte' | 'resolue'
export interface Alert {
  id: string
  type: AlertType
  title: string
  resume: string
  body: string
  created: string
  status: AlertStatus
}
```

- [ ] **Step 4 : Implémenter le codec fiche** — Créer `src/shared/wiki/fiche.ts` :
```typescript
import { parseFrontmatter, stringifyFrontmatter } from '../markdown/frontmatter.js'
import { WIKI_CATEGORIES, type Fiche, type WikiCategory } from './types.js'

const KNOWN_KEYS = new Set(['titre', 'categorie', 'cree', 'last_updated', 'sources', 'type'])

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const arr = v.filter((x): x is string => typeof x === 'string')
  return arr.length ? arr : undefined
}

/** chapter .md text → Fiche. Unknown frontmatter keys are preserved in `meta`. */
export function parseFiche(md: string, fallbackSlug: string, fallbackCategory: WikiCategory): Fiche {
  const { data, body } = parseFrontmatter(md)
  const rawCat = typeof data.categorie === 'string' ? data.categorie : ''
  const category = (WIKI_CATEGORIES as string[]).includes(rawCat)
    ? (rawCat as WikiCategory)
    : fallbackCategory
  const title = typeof data.titre === 'string' && data.titre.trim() ? data.titre : fallbackSlug
  const meta: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (!KNOWN_KEYS.has(k)) meta[k] = v
  }
  const fiche: Fiche = {
    slug: fallbackSlug,
    category,
    title,
    created: typeof data.cree === 'string' ? data.cree : '',
    body
  }
  if (typeof data.last_updated === 'string') fiche.lastUpdated = data.last_updated
  const sources = asStringArray(data.sources)
  if (sources) fiche.sources = sources
  if (typeof data.type === 'string') fiche.type = data.type
  if (Object.keys(meta).length) fiche.meta = meta
  return fiche
}

/** Fiche → chapter .md text. Title/category from fields; structured meta re-emitted. */
export function serializeFiche(fiche: Fiche): string {
  const data: Record<string, unknown> = {
    titre: fiche.title,
    categorie: fiche.category,
    cree: fiche.created
  }
  if (fiche.lastUpdated) data.last_updated = fiche.lastUpdated
  if (fiche.sources && fiche.sources.length) data.sources = fiche.sources
  if (fiche.type) data.type = fiche.type
  if (fiche.meta) {
    for (const [k, v] of Object.entries(fiche.meta)) data[k] = v
  }
  return stringifyFrontmatter(data, fiche.body)
}

/** Append a chapter to a fiche's sources (idempotent); refresh lastUpdated only on change. */
export function addSourceToFiche(fiche: Fiche, chapterId: string, today: string): Fiche {
  const sources = fiche.sources ?? []
  if (sources.includes(chapterId)) return fiche
  return { ...fiche, sources: [...sources, chapterId], lastUpdated: today }
}
```

- [ ] **Step 5 : Lancer le test (succès)** — Run `npm run test:main`. Expected: PASS (4 nouveaux + 53 → 57).

- [ ] **Step 6 : Commit**
```bash
git add src/shared/wiki/types.ts src/shared/wiki/fiche.ts src/main/__tests__/wiki.fiche.test.ts
git commit -m "feat(wiki): fiche model + frontmatter codec (structured meta preserved)"
```

---

### Task 2 : Suggestions (parsing LLM + codec)

**Files:**
- Create: `src/shared/wiki/suggestion.ts`
- Test: `src/main/__tests__/wiki.suggestion.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/main/__tests__/wiki.suggestion.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSuggestionsBlock, serializeSuggestion, parseSuggestion } from '../../shared/wiki/suggestion.js'

const llm = [
  '=== SUGGESTION ===',
  'TYPE: nouvelle_fiche',
  'CIBLE: personnages',
  'TITRE: Anna Lefèvre',
  'RESUME: jeune femme mystérieuse',
  'CORPS:',
  'Apparition au chapitre 3. Regard perçant. (non vérifié)',
  '=== SUGGESTION ===',
  'TYPE: ajout',
  'CIBLE: personnages/anna-lefevre',
  'TITRE: Relation au Comte',
  'RESUME: lien révélé',
  'CORPS:',
  'Ils se connaissaient avant.',
  '=== SUGGESTION ===',
  'TYPE: incoherence',
  'CIBLE:',
  'TITRE: Anachronisme',
  'RESUME: 1850 vs 1845',
  'CORPS:',
  'Le chapitre dit 1850 mais la fiche dit 1845.'
].join('\n')

test('parseSuggestionsBlock parses multiple blocks', () => {
  const s = parseSuggestionsBlock(llm)
  assert.equal(s.length, 3)
  assert.equal(s[0].type, 'nouvelle_fiche')
  assert.equal(s[0].cible, 'personnages')
  assert.equal(s[0].title, 'Anna Lefèvre')
  assert.match(s[0].body, /Regard perçant/)
  assert.equal(s[1].type, 'ajout')
  assert.equal(s[1].cible, 'personnages/anna-lefevre')
  assert.equal(s[2].type, 'incoherence')
})

test('AUCUNE SUGGESTION yields empty array', () => {
  assert.deepEqual(parseSuggestionsBlock('AUCUNE SUGGESTION'), [])
})

test('blocks with invalid/missing TYPE are skipped', () => {
  const s = parseSuggestionsBlock('=== SUGGESTION ===\nTYPE: bogus\nTITRE: x\nCORPS:\ny')
  assert.deepEqual(s, [])
})

test('suggestion frontmatter round-trips', () => {
  const out = serializeSuggestion({ id: 'u1', type: 'ajout', cible: 'lieux/marseille', title: 'Port', resume: 'r', body: 'Corps.', sourceChapitre: 'ch-3' })
  const back = parseSuggestion(out, 'u1')
  assert.equal(back.type, 'ajout')
  assert.equal(back.cible, 'lieux/marseille')
  assert.equal(back.title, 'Port')
  assert.equal(back.sourceChapitre, 'ch-3')
  assert.equal(back.body.trim(), 'Corps.')
})
```

- [ ] **Step 2 : Lancer le test (échec)** — Run `npm run test:main`. Expected: FAIL — module `suggestion.js` introuvable.

- [ ] **Step 3 : Implémenter** — Créer `src/shared/wiki/suggestion.ts` :
```typescript
import { parseFrontmatter, stringifyFrontmatter } from '../markdown/frontmatter.js'
import type { Suggestion, SuggestionType } from './types.js'

const VALID: SuggestionType[] = ['nouvelle_fiche', 'ajout', 'incoherence']

/** Parse the LLM ingest output: blocks separated by "=== SUGGESTION ===". Tolerant. */
export function parseSuggestionsBlock(text: string): Suggestion[] {
  const out: Suggestion[] = []
  const blocks = text.split(/^[ \t]*===\s*SUGGESTION\s*===[ \t]*$/m)
  for (const raw of blocks) {
    const block = raw.trim()
    if (!block || /^AUCUNE SUGGESTION\.?$/i.test(block)) continue
    let type = '', cible = '', title = '', resume = ''
    const bodyLines: string[] = []
    let inBody = false
    for (const line of block.split('\n')) {
      if (inBody) { bodyLines.push(line); continue }
      const m = line.match(/^(TYPE|CIBLE|TITRE|RESUME|CORPS)\s*:\s*(.*)$/i)
      if (!m) continue
      const key = m[1].toUpperCase()
      const val = m[2]
      if (key === 'TYPE') type = val.trim()
      else if (key === 'CIBLE') cible = val.trim()
      else if (key === 'TITRE') title = val.trim()
      else if (key === 'RESUME') resume = val.trim()
      else { inBody = true; if (val.trim()) bodyLines.push(val) }
    }
    if (!(VALID as string[]).includes(type)) continue
    out.push({ id: '', type: type as SuggestionType, cible, title, resume, body: bodyLines.join('\n').trim() })
  }
  return out
}

/** Suggestion → _suggestions/<uuid>.md text. */
export function serializeSuggestion(s: Suggestion): string {
  const data: Record<string, unknown> = { type: s.type, cible: s.cible, titre: s.title, resume: s.resume }
  if (s.sourceChapitre) data.source_chapitre = s.sourceChapitre
  return stringifyFrontmatter(data, s.body)
}

/** _suggestions/<uuid>.md text → Suggestion (id supplied by the store from the filename). */
export function parseSuggestion(md: string, id: string): Suggestion {
  const { data, body } = parseFrontmatter(md)
  const rawType = typeof data.type === 'string' ? data.type : ''
  const type = (VALID as string[]).includes(rawType) ? (rawType as SuggestionType) : 'ajout'
  const s: Suggestion = {
    id,
    type,
    cible: typeof data.cible === 'string' ? data.cible : '',
    title: typeof data.titre === 'string' ? data.titre : '',
    resume: typeof data.resume === 'string' ? data.resume : '',
    body
  }
  if (typeof data.source_chapitre === 'string') s.sourceChapitre = data.source_chapitre
  return s
}
```

- [ ] **Step 4 : Lancer le test (succès)** — Run `npm run test:main`. Expected: PASS (→ 61).

- [ ] **Step 5 : Commit**
```bash
git add src/shared/wiki/suggestion.ts src/main/__tests__/wiki.suggestion.test.ts
git commit -m "feat(wiki): suggestion LLM-block parsing + frontmatter codec"
```

---

### Task 3 : Alertes (codec + conversion depuis suggestion)

**Files:**
- Create: `src/shared/wiki/alert.ts`
- Test: `src/main/__tests__/wiki.alert.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/main/__tests__/wiki.alert.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAlert, serializeAlert, suggestionToAlert } from '../../shared/wiki/alert.js'
import type { Suggestion } from '../../shared/wiki/types.js'

test('alert frontmatter round-trips', () => {
  const out = serializeAlert({ id: 'a1', type: 'contradiction', title: 'Âge d\'Anna', resume: '20 puis 40', body: 'détail', created: '2026-06-14', status: 'ouverte' })
  const back = parseAlert(out, 'a1')
  assert.equal(back.type, 'contradiction')
  assert.equal(back.title, 'Âge d\'Anna')
  assert.equal(back.status, 'ouverte')
  assert.equal(back.body.trim(), 'détail')
})

test('suggestionToAlert maps an incoherence to an open contradiction', () => {
  const s: Suggestion = { id: '', type: 'incoherence', cible: '', title: 'Anachronisme', resume: '1850 vs 1845', body: 'le texte dit…' }
  const a = suggestionToAlert(s, '2026-06-14')
  assert.equal(a.type, 'contradiction')
  assert.equal(a.title, 'Anachronisme')
  assert.equal(a.resume, '1850 vs 1845')
  assert.equal(a.status, 'ouverte')
  assert.equal(a.created, '2026-06-14')
})

test('parseAlert tolerates invalid type/status', () => {
  const a = parseAlert('---\ntype: bogus\ntitre: X\nstatut: weird\ncree: 2026-06-14\n---\nb', 'a2')
  assert.equal(a.type, 'autre')
  assert.equal(a.status, 'ouverte')
})
```

- [ ] **Step 2 : Lancer le test (échec)** — Run `npm run test:main`. Expected: FAIL — module `alert.js` introuvable.

- [ ] **Step 3 : Implémenter** — Créer `src/shared/wiki/alert.ts` :
```typescript
import { parseFrontmatter, stringifyFrontmatter } from '../markdown/frontmatter.js'
import type { Alert, AlertType, AlertStatus, Suggestion } from './types.js'

const TYPES: AlertType[] = ['contradiction', 'nom_manquant', 'decision', 'autre']
const STATUSES: AlertStatus[] = ['ouverte', 'resolue']

export function serializeAlert(a: Alert): string {
  return stringifyFrontmatter(
    { type: a.type, titre: a.title, resume: a.resume, cree: a.created, statut: a.status },
    a.body
  )
}

export function parseAlert(md: string, id: string): Alert {
  const { data, body } = parseFrontmatter(md)
  const rawType = typeof data.type === 'string' ? data.type : ''
  const rawStatus = typeof data.statut === 'string' ? data.statut : ''
  return {
    id,
    type: (TYPES as string[]).includes(rawType) ? (rawType as AlertType) : 'autre',
    title: typeof data.titre === 'string' ? data.titre : '',
    resume: typeof data.resume === 'string' ? data.resume : '',
    body,
    created: typeof data.cree === 'string' ? data.cree : '',
    status: (STATUSES as string[]).includes(rawStatus) ? (rawStatus as AlertStatus) : 'ouverte'
  }
}

/** An accepted "incoherence" suggestion becomes a persistent open contradiction alert. */
export function suggestionToAlert(s: Suggestion, today: string): Omit<Alert, 'id'> {
  return {
    type: 'contradiction',
    title: s.title,
    resume: s.resume,
    body: s.body,
    created: today,
    status: 'ouverte'
  }
}
```

- [ ] **Step 4 : Lancer le test (succès)** — Run `npm run test:main`. Expected: PASS (→ 64).

- [ ] **Step 5 : Commit**
```bash
git add src/shared/wiki/alert.ts src/main/__tests__/wiki.alert.test.ts
git commit -m "feat(wiki): alert codec + incoherence→alert conversion"
```

---

### Task 4 : Log + baril

**Files:**
- Create: `src/shared/wiki/log.ts`
- Create: `src/shared/wiki/index.ts`
- Test: `src/main/__tests__/wiki.log.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/main/__tests__/wiki.log.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { formatLogEntry, prependLogEntry } from '../../shared/wiki/log.js'

test('formatLogEntry has the expected shape', () => {
  const e = formatLogEntry('NEW PAGE', 'personnages/anna', 'Création de la fiche.', '2026-06-14')
  assert.equal(e, '## 2026-06-14 - NEW PAGE personnages/anna\n\nCréation de la fiche.\n\n---\n')
})

test('prependLogEntry puts the newest entry first', () => {
  const first = formatLogEntry('NEW PAGE', 'a', 'd1', '2026-06-14')
  const second = formatLogEntry('UPDATE', 'a', 'd2', '2026-06-15')
  const log = prependLogEntry(first, second)
  assert.ok(log.indexOf('UPDATE') < log.indexOf('NEW PAGE'))
  assert.ok(log.startsWith('## 2026-06-15'))
})
```

- [ ] **Step 2 : Lancer le test (échec)** — Run `npm run test:main`. Expected: FAIL — module `log.js` introuvable.

- [ ] **Step 3 : Implémenter le log** — Créer `src/shared/wiki/log.ts` :
```typescript
/** A single append-only journal entry. */
export function formatLogEntry(action: string, subject: string, detail: string, today: string): string {
  return `## ${today} - ${action} ${subject}\n\n${detail}\n\n---\n`
}

/** Prepend a new entry to the existing log (newest first). */
export function prependLogEntry(existingLog: string, entry: string): string {
  const trimmed = existingLog.trimStart()
  return trimmed ? `${entry}\n${trimmed}` : entry
}
```

- [ ] **Step 4 : Créer le baril** — Créer `src/shared/wiki/index.ts` :
```typescript
export * from './types.js'
export * from './fiche.js'
export * from './suggestion.js'
export * from './alert.js'
export * from './log.js'
```

- [ ] **Step 5 : Lancer le test (succès) + build** — Run `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run test:main && npm run build`. Expected: tests PASS (→ 66), build OK.

- [ ] **Step 6 : Commit**
```bash
git add src/shared/wiki/log.ts src/shared/wiki/index.ts src/main/__tests__/wiki.log.test.ts
git commit -m "feat(wiki): log helpers + module barrel"
```

---

### Task 5 : Vérification

**Files:** aucun

- [ ] **Step 1 : Build + tests complets** — Run `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, ~66 tests verts.
- [ ] **Step 2 : Revue rapide** — Confirmer : aucun `Date.now()` dans le cœur (dates injectées) ; tout tolérant (jamais d'exception sur entrée douteuse) ; `meta` préserve les champs inconnus en round-trip ; baril exporte tout.

---

## Auto-revue (couverture du spec W1)
- Modèle `Fiche`/`Suggestion`/`Alert` + `WikiCategory` → Task 1, 2, 3. ✅
- Champs structurés préservés (`meta`, round-trip) → Task 1. ✅
- `parseFiche/serializeFiche/addSourceToFiche` (idempotent, date injectée) → Task 1. ✅
- `parseSuggestionsBlock` (tolérant, AUCUNE SUGGESTION, TYPE invalide ignoré) + codec → Task 2. ✅
- Alertes codec + `suggestionToAlert` → Task 3. ✅
- Log `formatLogEntry`/`prependLogEntry` (plus récent en tête) → Task 4. ✅
- Réutilise `markdown/frontmatter` + (slug dispo via `markdown/filename` pour la couche store) → Tasks 1-3. ✅
- Couche disque (store renderer/IPC) = HORS W1 (plan W1b suivant). Noté.

## Cohérence des types/signatures
- `parseFiche(md, fallbackSlug, fallbackCategory): Fiche` ; `serializeFiche(fiche): string` ; `addSourceToFiche(fiche, chapterId, today): Fiche`.
- `parseSuggestionsBlock(text): Suggestion[]` ; `serializeSuggestion(s): string` ; `parseSuggestion(md, id): Suggestion`.
- `parseAlert(md, id): Alert` ; `serializeAlert(a): string` ; `suggestionToAlert(s, today): Omit<Alert,'id'>`.
- `formatLogEntry(action, subject, detail, today): string` ; `prependLogEntry(existing, entry): string`.
- Toutes les dates sont des paramètres `today: string` (pas de `Date.now()` dans le cœur pur).
