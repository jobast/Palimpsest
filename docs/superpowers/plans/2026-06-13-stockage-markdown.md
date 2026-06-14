# Stockage du manuscrit en Markdown — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire du Markdown la source de vérité unique du manuscrit (un `.md` par chapitre + manifeste `project.json`), en remplacement du TipTap JSON, pour préparer le wiki/bible LLM.

**Architecture:** Un codec pur (`src/shared/markdown/`, testable sans DOM) convertit TipTap-doc-JSON ↔ Markdown aux seules frontières load/save du `projectStore`. L'éditeur continue de travailler en TipTap JSON en mémoire (aucun changement de l'éditeur lui-même). Le modèle en mémoire reste `ManuscriptItem[]` mais **plat** (que des chapitres ; les scènes deviennent des séparateurs `* * *` ; les dossiers ne sont plus créés). L'ordre vient du manifeste, le titre du frontmatter.

**Tech Stack:** Electron (contextIsolation ON, nodeIntegration OFF → renderer = navigateur, **pas de Buffer**), React 18, TipTap 2, Zustand 4, `js-yaml` (déjà installé, pur JS) pour le frontmatter, `node:test` pour les tests.

**Décisions verrouillées (cf. spec `2026-06-13-stockage-markdown-design.md` + arbitrages utilisateur 2026-06-13) :**
- MD = source unique. Chapitre = unité d'édition. Scènes = `* * *` (non persistées comme entités).
- Métadonnées au niveau chapitre dans le frontmatter (`status`, `synopsis`, `pov`). `wordCount` recalculé, jamais persisté.
- Liste **plate** de chapitres ; `parts` = overlay futur du manifeste (hors périmètre).
- **Aucune migration de données** (il n'existe aucun projet réel, uniquement des tests). On supprime purement l'ancien format ; `structure.json` et `manuscript/documents/*.json` disparaissent.
- `gray-matter` **rejeté** (dépend de `Buffer`, absent du renderer) → `js-yaml`.
- Soulignement retiré de la barre d'outils (extension `Underline` conservée pour parser `<u>`).
- Fiches (`sheets/*.json`), stats, rapports : **inchangés** ce cycle.

---

## Format disque cible

```
<projet>.palim/
  project.json                    # manifeste : { ...meta, chapters: [{id, file}] }
  chapitres/<NNN-slug>.md         # frontmatter (id, title, status?, synopsis?, pov?) + corps ; scènes = * * *
  chapitres/<NNN-slug>.note.md    # note privée (sidecar), optionnelle
  sheets/*.json                   # INCHANGÉ
  stats/*.json  reports/reports.json   # INCHANGÉ
  .recovery/                      # journal de sauvegarde INCHANGÉ
```

Frontmatter d'un chapitre :
```markdown
---
id: 7f3a2b10-...
title: Le Départ
status: draft
---
Il faisait nuit quand Marie partit…

* * *

La seconde scène commence ici…
```

Le `file` du manifeste est **immuable après création** (généré une fois, conservé même si le titre change → pas de churn git). L'ordre du tableau `chapters` = l'ordre du livre.

---

## Structure des fichiers

**Créés :**
- `src/shared/markdown/types.ts` — types partagés du codec (`ChapterFrontmatter`, `TipTapDoc`, `TipTapNode`, `ParsedChapter`, `ChapterRef`).
- `src/shared/markdown/frontmatter.ts` — `parseFrontmatter` / `stringifyFrontmatter` (js-yaml).
- `src/shared/markdown/filename.ts` — `slugify`, `chapterFileName`, `uniqueFileName`.
- `src/shared/markdown/manifest.ts` — `planChapterFiles`, `orphanFiles`.
- `src/shared/markdown/body.ts` — `docToMarkdownBody`, `markdownBodyToContent`.
- `src/shared/markdown/chapter.ts` — `parseChapter`, `serializeChapter`.
- `src/shared/markdown/index.ts` — ré-exports.
- `src/main/__tests__/markdown.frontmatter.test.ts`
- `src/main/__tests__/markdown.filename.test.ts`
- `src/main/__tests__/markdown.manifest.test.ts`
- `src/main/__tests__/markdown.body.test.ts`
- `src/main/__tests__/markdown.chapter.test.ts`
- `src/main/__tests__/deleteFile.test.ts`

**Modifiés :**
- `package.json` — devDependency `@types/js-yaml`.
- `tsconfig.node.json` — `include` += `src/shared` (pour compiler le codec dans la passe de test).
- `src/main/index.ts` — handler `fs:deleteFile`.
- `src/main/preload.ts` — pont `deleteFile`.
- `src/shared/types/electron.d.ts` — signature `deleteFile`.
- `src/renderer/stores/projectStore.ts` — load/save/create en MD + manifeste ; action `renameChapter` ; helpers note.
- `src/renderer/components/editor/EditorArea.tsx` — sync titre bidirectionnelle (anti-boucle).
- `src/renderer/components/layout/Sidebar.tsx` — rename via `renameChapter` ; « Ajouter une scène » → « Insérer un saut de scène » ; action note.
- `src/renderer/components/layout/Toolbar.tsx` — retrait du bouton souligné.
- `src/renderer/components/editor/FormattingPanel.tsx` — retrait du bouton souligné.

---

## Conventions codec (contrat partagé entre toutes les tâches)

Mapping doc TipTap ↔ Markdown (le corps `.md` ne contient JAMAIS le titre) :

| Nœud TipTap | Markdown |
|---|---|
| `chapterTitle` | **exclu du corps** (→ `frontmatter.title`) |
| `firstParagraph` | sérialisé comme un paragraphe normal ; à la lecture, le **1er** paragraphe du corps redevient `firstParagraph` |
| `paragraph` | ligne de texte, séparée par une ligne vide |
| `sceneBreak` | `* * *` (entouré de lignes vides) |
| `heading` (h2/h3 de StarterKit) | `##` / `###` |
| marque `bold` | `**…**` |
| marque `italic` | `*…*` |
| `hardBreak` | `  \n` (deux espaces + retour, CommonMark) |
| nœud inconnu | repli : son `textContent` en paragraphe (anti-perte) |

Échappement (corps uniquement, jamais le frontmatter) : à la sérialisation, échapper en tête de paragraphe `# > - + *` et `\d+\.` par `\` ; échapper les `*` et `_` littéraux inline par `\*` / `\_`. À la lecture, déséchapper `\` devant ces caractères. La typographie française (U+202F, U+00A0, « » — …) **traverse intacte** (le codec manipule le texte directement).

Types (référence) :
```typescript
// src/shared/markdown/types.ts
import type { DocumentStatus } from '../types/project'

export interface ChapterFrontmatter {
  id: string
  title: string
  status?: DocumentStatus
  synopsis?: string
  pov?: string
}

export interface TipTapMark { type: string; attrs?: Record<string, unknown> }
export interface TipTapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  marks?: TipTapMark[]
  text?: string
}
export interface TipTapDoc { type: 'doc'; content: TipTapNode[] }

export interface ParsedChapter { frontmatter: ChapterFrontmatter; doc: TipTapDoc }
export interface ChapterRef { id: string; file: string }
```

---

### Task 1 : Dépendances, types partagés et câblage des tests

**Files:**
- Modify: `package.json` (devDependencies)
- Modify: `tsconfig.node.json:11` (`include`)
- Create: `src/shared/markdown/types.ts`
- Create: `src/shared/markdown/index.ts`

- [ ] **Step 1 : Installer les types js-yaml**

Run (préfixer le PATH nvm) :
```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
cd /Users/saidimu/DEV/PROJETS/palimpseste && npm install --save-dev @types/js-yaml
```
Expected : `@types/js-yaml` ajouté à `package.json`, pas d'erreur. (`js-yaml` runtime est déjà présent.)

- [ ] **Step 2 : Étendre la compilation de test à `src/shared`**

Dans `tsconfig.node.json`, remplacer la ligne `include` :
```json
  "include": ["src/main", "src/shared", "vite.config.ts", "electron.vite.config.ts"]
```
Raison : le script `test:main` compile via `tsconfig.node.json` puis exécute `node --test dist/main/...`. Le codec vit dans `src/shared` et doit être compilé pour être importé par les tests. Le codec utilise des **imports relatifs** (pas l'alias `@shared`, non résolu par node nu).

- [ ] **Step 3 : Créer les types partagés**

Créer `src/shared/markdown/types.ts` avec le contenu de la section « Conventions codec » ci-dessus (bloc `types.ts`).

- [ ] **Step 4 : Créer le baril d'export**

Créer `src/shared/markdown/index.ts` :
```typescript
export * from './types'
export * from './frontmatter'
export * from './filename'
export * from './manifest'
export * from './body'
export * from './chapter'
```
(Les modules référencés seront créés aux tâches suivantes ; ce fichier compilera seulement une fois la Task 7 finie. Ne pas l'importer avant.)

- [ ] **Step 5 : Commit**
```bash
git add package.json package-lock.json tsconfig.node.json src/shared/markdown/types.ts src/shared/markdown/index.ts
git commit -m "chore(markdown): scaffold shared codec types + test wiring"
```

---

### Task 2 : Frontmatter (parse/stringify via js-yaml)

**Files:**
- Create: `src/shared/markdown/frontmatter.ts`
- Test: `src/main/__tests__/markdown.frontmatter.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/main/__tests__/markdown.frontmatter.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFrontmatter, stringifyFrontmatter } from '../../shared/markdown/frontmatter.js'

test('parseFrontmatter extracts YAML data and body', () => {
  const md = '---\nid: abc\ntitle: Le Départ\n---\nIl faisait nuit.\n'
  const { data, body } = parseFrontmatter(md)
  assert.equal(data.id, 'abc')
  assert.equal(data.title, 'Le Départ')
  assert.equal(body, 'Il faisait nuit.\n')
})

test('parseFrontmatter returns empty data when no fence', () => {
  const md = 'Pas de frontmatter ici.'
  const { data, body } = parseFrontmatter(md)
  assert.deepEqual(data, {})
  assert.equal(body, 'Pas de frontmatter ici.')
})

test('parseFrontmatter tolerates a title containing a colon', () => {
  const md = '---\nid: x\ntitle: "Chapitre 1: Le seuil"\n---\nTexte.'
  const { data } = parseFrontmatter(md)
  assert.equal(data.title, 'Chapitre 1: Le seuil')
})

test('stringifyFrontmatter round-trips arbitrary titles', () => {
  const out = stringifyFrontmatter({ id: 'x', title: 'Titre: avec « accents »' }, 'Corps.\n')
  const { data, body } = parseFrontmatter(out)
  assert.equal(data.id, 'x')
  assert.equal(data.title, 'Titre: avec « accents »')
  assert.equal(body, 'Corps.\n')
})

test('parseFrontmatter on corrupt YAML returns empty data, keeps body', () => {
  const md = '---\n: : : bad\n---\nCorps.'
  const { data, body } = parseFrontmatter(md)
  assert.deepEqual(data, {})
  assert.equal(body, 'Corps.')
})
```

- [ ] **Step 2 : Lancer le test pour vérifier l'échec**

Run :
```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
cd /Users/saidimu/DEV/PROJETS/palimpseste && npm run test:main
```
Expected : FAIL — `Cannot find module '../../shared/markdown/frontmatter.js'`.

- [ ] **Step 3 : Écrire l'implémentation**

Créer `src/shared/markdown/frontmatter.ts` :
```typescript
import { load as yamlLoad, dump as yamlDump } from 'js-yaml'

export interface FrontmatterResult {
  data: Record<string, unknown>
  body: string
}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** Split a `---`-delimited YAML frontmatter from the markdown body. */
export function parseFrontmatter(md: string): FrontmatterResult {
  const match = md.match(FENCE)
  if (!match) {
    return { data: {}, body: md }
  }
  const body = md.slice(match[0].length)
  try {
    const loaded = yamlLoad(match[1])
    const data = loaded && typeof loaded === 'object' ? (loaded as Record<string, unknown>) : {}
    return { data, body }
  } catch {
    // Corrupt YAML: never throw, never lose the body.
    return { data: {}, body }
  }
}

/** Re-emit a markdown string with a YAML frontmatter block + body. */
export function stringifyFrontmatter(data: Record<string, unknown>, body: string): string {
  const yaml = yamlDump(data, { lineWidth: -1 }).replace(/\n$/, '')
  return `---\n${yaml}\n---\n${body}`
}
```

- [ ] **Step 4 : Lancer le test pour vérifier le succès**

Run : `npm run test:main`
Expected : PASS (tous les `markdown.frontmatter` verts).

- [ ] **Step 5 : Commit**
```bash
git add src/shared/markdown/frontmatter.ts src/main/__tests__/markdown.frontmatter.test.ts
git commit -m "feat(markdown): frontmatter parse/stringify via js-yaml"
```

---

### Task 3 : Noms de fichiers de chapitre (slug + unicité)

**Files:**
- Create: `src/shared/markdown/filename.ts`
- Test: `src/main/__tests__/markdown.filename.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/main/__tests__/markdown.filename.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { slugify, chapterFileName, uniqueFileName } from '../../shared/markdown/filename.js'

test('slugify strips accents, lowercases, hyphenates', () => {
  assert.equal(slugify('Le Départ à l’aube'), 'le-depart-a-l-aube')
})

test('slugify falls back to "chapitre" when empty', () => {
  assert.equal(slugify('   ***   '), 'chapitre')
})

test('chapterFileName pads the index to 3 digits', () => {
  assert.equal(chapterFileName(0, 'Le Départ'), '001-le-depart.md')
  assert.equal(chapterFileName(11, 'Fin'), '012-fin.md')
})

test('uniqueFileName appends a numeric suffix on collision', () => {
  const taken = new Set(['001-fin.md'])
  assert.equal(uniqueFileName('001-fin.md', taken), '001-fin-2.md')
  taken.add('001-fin-2.md')
  assert.equal(uniqueFileName('001-fin.md', taken), '001-fin-3.md')
})
```

- [ ] **Step 2 : Lancer le test pour vérifier l'échec**

Run : `npm run test:main`
Expected : FAIL — module `filename.js` introuvable.

- [ ] **Step 3 : Écrire l'implémentation**

Créer `src/shared/markdown/filename.ts` :
```typescript
/** Accent-stripped, lowercase, hyphenated slug. Falls back to "chapitre". */
export function slugify(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, '')           // trim hyphens
  return slug || 'chapitre'
}

function pad3(n: number): string {
  return String(n).padStart(3, '0')
}

/** `001-le-depart.md` from a zero-based index + title. */
export function chapterFileName(index: number, title: string): string {
  return `${pad3(index + 1)}-${slugify(title)}.md`
}

/** Disambiguate `name.md` against a set of already-taken names. */
export function uniqueFileName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name
  const dot = name.lastIndexOf('.')
  const stem = dot >= 0 ? name.slice(0, dot) : name
  const ext = dot >= 0 ? name.slice(dot) : ''
  let i = 2
  let candidate = `${stem}-${i}${ext}`
  while (taken.has(candidate)) {
    i += 1
    candidate = `${stem}-${i}${ext}`
  }
  return candidate
}
```

- [ ] **Step 4 : Lancer le test pour vérifier le succès**

Run : `npm run test:main`
Expected : PASS.

- [ ] **Step 5 : Commit**
```bash
git add src/shared/markdown/filename.ts src/main/__tests__/markdown.filename.test.ts
git commit -m "feat(markdown): chapter filename slug + uniqueness helpers"
```

---

### Task 4 : Manifeste (mapping id↔fichier stable + orphelins)

**Files:**
- Create: `src/shared/markdown/manifest.ts`
- Test: `src/main/__tests__/markdown.manifest.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/main/__tests__/markdown.manifest.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { planChapterFiles, orphanFiles } from '../../shared/markdown/manifest.js'

test('planChapterFiles reuses existing files by id (no churn on rename/reorder)', () => {
  const existing = [
    { id: 'a', file: 'chapitres/001-un.md' },
    { id: 'b', file: 'chapitres/002-deux.md' }
  ]
  // reordered + 'a' renamed in title; ids unchanged
  const items = [{ id: 'b', title: 'Deux' }, { id: 'a', title: 'Un (renommé)' }]
  const refs = planChapterFiles(items, existing)
  assert.deepEqual(refs, [
    { id: 'b', file: 'chapitres/002-deux.md' },
    { id: 'a', file: 'chapitres/001-un.md' }
  ])
})

test('planChapterFiles generates unique files for new chapters', () => {
  const existing = [{ id: 'a', file: 'chapitres/001-fin.md' }]
  const items = [
    { id: 'a', title: 'Fin' },
    { id: 'c', title: 'Fin' },          // same slug → must disambiguate
    { id: 'd', title: 'Nouveau' }
  ]
  const refs = planChapterFiles(items, existing)
  assert.equal(refs[0].file, 'chapitres/001-fin.md')
  assert.equal(refs[1].file, 'chapitres/002-fin.md')
  assert.equal(refs[2].file, 'chapitres/003-nouveau.md')
})

test('orphanFiles returns files no longer referenced', () => {
  const oldRefs = [
    { id: 'a', file: 'chapitres/001-un.md' },
    { id: 'b', file: 'chapitres/002-deux.md' }
  ]
  const newRefs = [{ id: 'a', file: 'chapitres/001-un.md' }]
  assert.deepEqual(orphanFiles(oldRefs, newRefs), ['chapitres/002-deux.md'])
})
```

- [ ] **Step 2 : Lancer le test pour vérifier l'échec**

Run : `npm run test:main`
Expected : FAIL — module `manifest.js` introuvable.

- [ ] **Step 3 : Écrire l'implémentation**

Créer `src/shared/markdown/manifest.ts` :
```typescript
import type { ChapterRef } from './types'
import { chapterFileName, uniqueFileName } from './filename'

const DIR = 'chapitres'

/**
 * Map ordered chapters to file refs. Existing ids keep their file (stable
 * across rename/reorder → no git churn); new ids get a unique slug filename.
 * The numeric prefix for new files continues after the highest existing one.
 */
export function planChapterFiles(
  items: Array<{ id: string; title: string }>,
  existing: ChapterRef[]
): ChapterRef[] {
  const byId = new Map(existing.map(r => [r.id, r.file]))
  const taken = new Set(existing.map(r => r.file))
  let nextIndex = existing.length

  return items.map((item) => {
    const known = byId.get(item.id)
    if (known) return { id: item.id, file: known }
    const base = `${DIR}/${chapterFileName(nextIndex, item.title)}`
    const file = uniqueFileName(base, taken)
    taken.add(file)
    nextIndex += 1
    return { id: item.id, file }
  })
}

/** Files referenced before but not after — safe to delete. */
export function orphanFiles(oldRefs: ChapterRef[], newRefs: ChapterRef[]): string[] {
  const kept = new Set(newRefs.map(r => r.file))
  return oldRefs.filter(r => !kept.has(r.file)).map(r => r.file)
}
```

- [ ] **Step 4 : Lancer le test pour vérifier le succès**

Run : `npm run test:main`
Expected : PASS.

- [ ] **Step 5 : Commit**
```bash
git add src/shared/markdown/manifest.ts src/main/__tests__/markdown.manifest.test.ts
git commit -m "feat(markdown): stable id↔file manifest planning + orphan detection"
```

---

### Task 5 : Corps — sérialisation doc TipTap → Markdown

**Files:**
- Create: `src/shared/markdown/body.ts` (partie sérialisation)
- Test: `src/main/__tests__/markdown.body.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/main/__tests__/markdown.body.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { docToMarkdownBody } from '../../shared/markdown/body.js'
import type { TipTapDoc } from '../../shared/markdown/types.js'

const doc = (content: unknown[]): TipTapDoc => ({ type: 'doc', content: content as never })
const p = (text: string, marks?: unknown[]) =>
  ({ type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] })

test('chapterTitle is excluded from the body', () => {
  const d = doc([
    { type: 'chapterTitle', content: [{ type: 'text', text: 'Le Départ' }] },
    p('Bonjour.')
  ])
  assert.equal(docToMarkdownBody(d), 'Bonjour.\n')
})

test('firstParagraph serializes like a normal paragraph', () => {
  const d = doc([
    { type: 'firstParagraph', content: [{ type: 'text', text: 'Début.' }] },
    p('Suite.')
  ])
  assert.equal(docToMarkdownBody(d), 'Début.\n\nSuite.\n')
})

test('bold and italic marks become ** and *', () => {
  const d = doc([
    p('gras', [{ type: 'bold' }]),
    p('penché', [{ type: 'italic' }])
  ])
  assert.equal(docToMarkdownBody(d), '**gras**\n\n*penché*\n')
})

test('sceneBreak becomes * * *', () => {
  const d = doc([p('Avant.'), { type: 'sceneBreak' }, p('Après.')])
  assert.equal(docToMarkdownBody(d), 'Avant.\n\n* * *\n\nAprès.\n')
})

test('literal asterisks and leading markers are escaped', () => {
  const d = doc([p('# pas un titre'), p('un * isolé')])
  assert.equal(docToMarkdownBody(d), '\\# pas un titre\n\nun \\* isolé\n')
})

test('French typography passes through untouched', () => {
  const d = doc([p('« Bonjour » dit-il…')])
  assert.equal(docToMarkdownBody(d), '« Bonjour » dit-il…\n')
})
```

- [ ] **Step 2 : Lancer le test pour vérifier l'échec**

Run : `npm run test:main`
Expected : FAIL — module `body.js` introuvable.

- [ ] **Step 3 : Écrire l'implémentation (sérialisation)**

Créer `src/shared/markdown/body.ts` :
```typescript
import type { TipTapDoc, TipTapNode } from './types'

// --- Serialization: doc JSON → markdown body -------------------------------

function escapeInline(text: string): string {
  return text.replace(/([*_\\])/g, '\\$1')
}

function escapeLeading(line: string): string {
  // Escape block markers only at the very start of a paragraph.
  return line.replace(/^(\s*)([#>*+-])/, '$1\\$2').replace(/^(\s*)(\d+)\./, '$1$2\\.')
}

function serializeInline(nodes: TipTapNode[] | undefined): string {
  if (!nodes) return ''
  let out = ''
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      out += '  \n'
      continue
    }
    if (node.type !== 'text' || typeof node.text !== 'string') continue
    let text = escapeInline(node.text)
    const marks = node.marks?.map(m => m.type) ?? []
    if (marks.includes('bold')) text = `**${text}**`
    if (marks.includes('italic')) text = `*${text}*`
    out += text
  }
  return out
}

function serializeBlock(node: TipTapNode): string | null {
  switch (node.type) {
    case 'chapterTitle':
      return null // title lives in frontmatter, never in the body
    case 'sceneBreak':
      return '* * *'
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 2)))
      return `${'#'.repeat(level)} ${serializeInline(node.content)}`
    }
    case 'paragraph':
    case 'firstParagraph':
      return escapeLeading(serializeInline(node.content))
    default:
      // Anti-loss fallback for unexpected nodes.
      return escapeLeading(serializeInline(node.content))
  }
}

/** doc JSON → markdown body (no frontmatter, no chapter title). */
export function docToMarkdownBody(doc: TipTapDoc): string {
  const blocks: string[] = []
  for (const node of doc.content ?? []) {
    const block = serializeBlock(node)
    if (block !== null) blocks.push(block)
  }
  return blocks.length ? blocks.join('\n\n') + '\n' : ''
}
```

- [ ] **Step 4 : Lancer le test pour vérifier le succès**

Run : `npm run test:main`
Expected : PASS.

- [ ] **Step 5 : Commit**
```bash
git add src/shared/markdown/body.ts src/main/__tests__/markdown.body.test.ts
git commit -m "feat(markdown): serialize TipTap doc → markdown body"
```

---

### Task 6 : Corps — parsing Markdown → contenu TipTap

**Files:**
- Modify: `src/shared/markdown/body.ts` (partie parsing)
- Test: `src/main/__tests__/markdown.body.test.ts` (ajouts)

- [ ] **Step 1 : Ajouter les tests qui échouent**

Ajouter à `src/main/__tests__/markdown.body.test.ts` :
```typescript
import { markdownBodyToContent } from '../../shared/markdown/body.js'

test('markdownBodyToContent marks the first paragraph as firstParagraph', () => {
  const nodes = markdownBodyToContent('Début.\n\nSuite.\n')
  assert.equal(nodes[0].type, 'firstParagraph')
  assert.equal(nodes[1].type, 'paragraph')
})

test('markdownBodyToContent maps * * * to sceneBreak', () => {
  const nodes = markdownBodyToContent('Avant.\n\n* * *\n\nAprès.\n')
  assert.deepEqual(nodes.map(n => n.type), ['firstParagraph', 'sceneBreak', 'paragraph'])
})

test('markdownBodyToContent parses bold/italic and unescapes', () => {
  const nodes = markdownBodyToContent('**gras** et \\* littéral')
  const marks = (nodes[0].content ?? []).map(c => ({ text: c.text, m: c.marks?.[0]?.type }))
  assert.deepEqual(marks[0], { text: 'gras', m: 'bold' })
  assert.equal(nodes[0].content?.map(c => c.text).join(''), 'gras et * littéral')
})

test('body round-trips French typography', () => {
  const md = '« Bonjour » dit-il…\n'
  const nodes = markdownBodyToContent(md)
  assert.equal(nodes[0].content?.map(c => c.text).join(''), '« Bonjour » dit-il…')
})
```

- [ ] **Step 2 : Lancer le test pour vérifier l'échec**

Run : `npm run test:main`
Expected : FAIL — `markdownBodyToContent` non exporté.

- [ ] **Step 3 : Écrire l'implémentation (parsing)**

Ajouter à la fin de `src/shared/markdown/body.ts` :
```typescript
// --- Parsing: markdown body → doc content nodes ----------------------------

function unescapeInline(text: string): string {
  return text.replace(/\\([*_\\#>+\-.])/g, '$1')
}

// Tokenize a single paragraph's text into text nodes carrying bold/italic.
// Order matters: *** then ** then *.
function parseInline(line: string): TipTapNode[] {
  const tokens: TipTapNode[] = []
  const re = /\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let last = 0
  let m: RegExpExecArray | null
  const pushText = (raw: string, marks?: string[]) => {
    if (!raw) return
    const node: TipTapNode = { type: 'text', text: unescapeInline(raw) }
    if (marks?.length) node.marks = marks.map(type => ({ type }))
    tokens.push(node)
  }
  while ((m = re.exec(line)) !== null) {
    pushText(line.slice(last, m.index))
    if (m[1] !== undefined) pushText(m[1], ['bold', 'italic'])
    else if (m[2] !== undefined) pushText(m[2], ['bold'])
    else if (m[3] !== undefined) pushText(m[3], ['italic'])
    last = re.lastIndex
  }
  pushText(line.slice(last))
  return tokens
}

function parseBlock(raw: string): TipTapNode | null {
  const block = raw.replace(/^\n+|\n+$/g, '')
  if (!block) return null
  if (/^\*\s\*\s\*$/.test(block.trim())) return { type: 'sceneBreak' }
  const heading = block.match(/^(#{1,3})\s+(.*)$/)
  if (heading) {
    return { type: 'heading', attrs: { level: heading[1].length }, content: parseInline(heading[2]) }
  }
  // Join soft-wrapped lines; CommonMark hard break (two trailing spaces) → hardBreak.
  const lines = block.split('\n')
  const content: TipTapNode[] = []
  lines.forEach((line, i) => {
    const hard = /  $/.test(line)
    content.push(...parseInline(line.replace(/\s+$/, '')))
    if (i < lines.length - 1) content.push(hard ? { type: 'hardBreak' } : { type: 'text', text: ' ' })
  })
  return { type: 'paragraph', content }
}

/**
 * markdown body → array of content nodes. The first paragraph becomes a
 * `firstParagraph` node (no first-line indent after the chapter title).
 */
export function markdownBodyToContent(body: string): TipTapNode[] {
  const blocks = body.split(/\n[ \t]*\n/)
  const nodes: TipTapNode[] = []
  for (const raw of blocks) {
    const node = parseBlock(raw)
    if (node) nodes.push(node)
  }
  const first = nodes.find(n => n.type === 'paragraph')
  if (first) first.type = 'firstParagraph'
  return nodes
}
```

- [ ] **Step 4 : Lancer le test pour vérifier le succès**

Run : `npm run test:main`
Expected : PASS (sérialisation + parsing).

- [ ] **Step 5 : Commit**
```bash
git add src/shared/markdown/body.ts src/main/__tests__/markdown.body.test.ts
git commit -m "feat(markdown): parse markdown body → TipTap content nodes"
```

---

### Task 7 : Codec chapitre (parseChapter / serializeChapter) + round-trip

**Files:**
- Create: `src/shared/markdown/chapter.ts`
- Test: `src/main/__tests__/markdown.chapter.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/main/__tests__/markdown.chapter.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseChapter, serializeChapter } from '../../shared/markdown/chapter.js'
import type { ParsedChapter } from '../../shared/markdown/types.js'

test('parseChapter builds a chapterTitle node from frontmatter', () => {
  const md = '---\nid: x\ntitle: Le Départ\n---\nIl faisait nuit.\n'
  const { frontmatter, doc } = parseChapter(md, 'fallback')
  assert.equal(frontmatter.id, 'x')
  assert.equal(frontmatter.title, 'Le Départ')
  assert.equal(doc.content[0].type, 'chapterTitle')
  assert.equal(doc.content[0].content?.[0].text, 'Le Départ')
  assert.equal(doc.content[1].type, 'firstParagraph')
})

test('parseChapter uses fallback title when frontmatter title missing', () => {
  const { frontmatter } = parseChapter('Juste du texte.', '003-le-seuil')
  assert.equal(frontmatter.title, '003-le-seuil')
  assert.ok(frontmatter.id)  // a generated id
})

test('serializeChapter never duplicates the title in the body', () => {
  const parsed: ParsedChapter = {
    frontmatter: { id: 'x', title: 'Le Départ' },
    doc: { type: 'doc', content: [
      { type: 'chapterTitle', content: [{ type: 'text', text: 'Le Départ' }] },
      { type: 'firstParagraph', content: [{ type: 'text', text: 'Il faisait nuit.' }] }
    ] }
  }
  const md = serializeChapter(parsed)
  assert.equal(md, '---\nid: x\ntitle: Le Départ\n---\nIl faisait nuit.\n')
  assert.equal((md.match(/Le Départ/g) ?? []).length, 1) // only in frontmatter
})

test('round-trip preserves paragraphs, marks, scene breaks and French typography', () => {
  const md = [
    '---', 'id: x', 'title: Chapitre', '---',
    'Première phrase avec **gras** et *italique*.',
    '',
    '* * *',
    '',
    '« Dialogue » dit-elle…'
  ].join('\n') + '\n'
  const reparsed = serializeChapter(parseChapter(md, 'fallback'))
  assert.equal(reparsed, md)
})

test('status/synopsis/pov survive round-trip', () => {
  const md = '---\nid: x\ntitle: T\nstatus: revision\npov: Marie\n---\nTexte.\n'
  const out = serializeChapter(parseChapter(md, 'f'))
  assert.match(out, /status: revision/)
  assert.match(out, /pov: Marie/)
})
```

- [ ] **Step 2 : Lancer le test pour vérifier l'échec**

Run : `npm run test:main`
Expected : FAIL — module `chapter.js` introuvable.

- [ ] **Step 3 : Écrire l'implémentation**

Créer `src/shared/markdown/chapter.ts` :
```typescript
import type { ChapterFrontmatter, ParsedChapter, TipTapNode } from './types'
import type { DocumentStatus } from '../types/project'
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter'
import { docToMarkdownBody, markdownBodyToContent } from './body'

const VALID_STATUS: DocumentStatus[] = ['draft', 'revision', 'final']

function genId(): string {
  // Works in both renderer (window.crypto) and node 22 (global crypto).
  return crypto.randomUUID()
}

/** chapter .md text → { frontmatter, doc } (doc carries a chapterTitle node). */
export function parseChapter(md: string, fallbackTitle: string): ParsedChapter {
  const { data, body } = parseFrontmatter(md)
  const title = typeof data.title === 'string' && data.title.trim() ? data.title : fallbackTitle
  const frontmatter: ChapterFrontmatter = {
    id: typeof data.id === 'string' && data.id ? data.id : genId(),
    title
  }
  if (typeof data.status === 'string' && (VALID_STATUS as string[]).includes(data.status)) {
    frontmatter.status = data.status as DocumentStatus
  }
  if (typeof data.synopsis === 'string') frontmatter.synopsis = data.synopsis
  if (typeof data.pov === 'string') frontmatter.pov = data.pov

  const titleNode: TipTapNode = { type: 'chapterTitle', content: [{ type: 'text', text: title }] }
  const bodyNodes = markdownBodyToContent(body)
  const content = bodyNodes.length
    ? [titleNode, ...bodyNodes]
    : [titleNode, { type: 'firstParagraph', content: [] }]

  return { frontmatter, doc: { type: 'doc', content } }
}

/** { frontmatter, doc } → chapter .md text. Title comes from frontmatter only. */
export function serializeChapter(parsed: ParsedChapter): string {
  const { frontmatter, doc } = parsed
  const data: Record<string, unknown> = { id: frontmatter.id, title: frontmatter.title }
  if (frontmatter.status) data.status = frontmatter.status
  if (frontmatter.synopsis !== undefined) data.synopsis = frontmatter.synopsis
  if (frontmatter.pov !== undefined) data.pov = frontmatter.pov
  return stringifyFrontmatter(data, docToMarkdownBody(doc))
}
```

- [ ] **Step 4 : Lancer le test pour vérifier le succès**

Run : `npm run test:main`
Expected : PASS. Le baril `src/shared/markdown/index.ts` (Task 1) compile désormais.

- [ ] **Step 5 : Commit**
```bash
git add src/shared/markdown/chapter.ts src/main/__tests__/markdown.chapter.test.ts
git commit -m "feat(markdown): chapter codec parse/serialize with round-trip tests"
```

---

### Task 8 : IPC `fs:deleteFile` (journal-aware)

**Files:**
- Modify: `src/main/index.ts:578` (après le handler `fs:exists`)
- Modify: `src/main/preload.ts:37`
- Modify: `src/shared/types/electron.d.ts`
- Test: `src/main/__tests__/deleteFile.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/main/__tests__/deleteFile.test.ts` (teste la logique de sauvegarde-avant-suppression du journal, réutilisable et pure côté main) :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  beginSaveJournal, trackBackupForWrite, recoverSaveJournal
} from '../saveRecovery.js'

test('a deleted file is restored after recovery when backed up in the journal', async () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'palim-del-'))
  const projectRoot = path.join(sandbox, 'book.palim')
  const target = path.join(projectRoot, 'chapitres', '002-deux.md')
  try {
    await fs.promises.mkdir(path.dirname(target), { recursive: true })
    await fs.promises.writeFile(target, 'contenu', 'utf-8')

    await beginSaveJournal(projectRoot)
    await trackBackupForWrite(projectRoot, target)  // same hook deleteFile will use
    await fs.promises.unlink(target)

    const recovery = await recoverSaveJournal(projectRoot)
    assert.equal(recovery.restored, 1)
    assert.equal(await fs.promises.readFile(target, 'utf-8'), 'contenu')
  } finally {
    await fs.promises.rm(sandbox, { recursive: true, force: true })
  }
})
```

- [ ] **Step 2 : Lancer le test pour vérifier l'échec puis le succès partiel**

Run : `npm run test:main`
Expected : PASS (ce test valide le mécanisme du journal ; il guide l'implémentation du handler). Si déjà vert, continuer — le handler IPC ci-dessous s'appuie sur exactement ce mécanisme.

- [ ] **Step 3 : Ajouter le handler IPC**

Dans `src/main/index.ts`, juste après le handler `fs:exists` (ligne ~578), ajouter :
```typescript
ipcMain.handle('fs:deleteFile', async (_, filePath: string) => {
  try {
    const { safePath, safeProjectRoot } = await assertProjectScopedPath(filePath)
    await trackBackupForWrite(safeProjectRoot, safePath)  // journal-aware: restorable
    await fs.promises.unlink(safePath).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err   // deleting a missing file is a no-op
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})
```
(`trackBackupForWrite` est déjà importé dans `index.ts` — il est utilisé par `fs:writeFile`.)

- [ ] **Step 4 : Exposer dans le preload**

Dans `src/main/preload.ts`, après `writeFile` (ligne ~32), ajouter :
```typescript
  deleteFile: (filePath: string) => ipcRenderer.invoke('fs:deleteFile', filePath),
```

- [ ] **Step 5 : Déclarer le type**

Dans `src/shared/types/electron.d.ts`, ajouter à l'interface `ElectronAPI`, près de `writeFile` :
```typescript
  deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
```

- [ ] **Step 6 : Vérifier compilation + tests**

Run :
```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
cd /Users/saidimu/DEV/PROJETS/palimpseste && npm run build && npm run test:main
```
Expected : build OK, tests verts.

- [ ] **Step 7 : Commit**
```bash
git add src/main/index.ts src/main/preload.ts src/shared/types/electron.d.ts src/main/__tests__/deleteFile.test.ts
git commit -m "feat(main): journal-aware fs:deleteFile IPC"
```

---

### Task 9 : Persistance — chargement depuis manifeste + `.md`

**Files:**
- Modify: `src/renderer/stores/projectStore.ts` (helpers de chargement + les 3 chemins d'ouverture)

> Note : `openRecentProject` (l.380), `openProject`/`openLastProject` (l.~939, ~1219) partagent la même logique de lecture `documents/*.json`. On extrait un helper unique `loadManuscriptFromDisk` et on l'appelle aux trois endroits.

- [ ] **Step 1 : Ajouter le helper de chargement**

Dans `projectStore.ts`, après `loadSheetsFromDisk` (l.318), ajouter :
```typescript
import { parseChapter, type ChapterRef } from '@shared/markdown'

interface LoadedManuscript {
  items: ManuscriptItem[]
  documentContents: Record<string, string>  // chapterId → TipTap doc JSON string
  chapterRefs: ChapterRef[]                  // for stable filenames on save
}

// Read the manifest's chapter list + each chapitres/*.md into the in-memory model.
const loadManuscriptFromDisk = async (
  projectPath: string,
  chapterRefs: ChapterRef[]
): Promise<LoadedManuscript> => {
  const items: ManuscriptItem[] = []
  const documentContents: Record<string, string> = {}

  for (const ref of chapterRefs) {
    const fileResult = await window.electronAPI.readFile(`${projectPath}/${ref.file}`)
    if (!fileResult.success || !fileResult.content) continue
    const fallbackTitle = ref.file.replace(/^chapitres\//, '').replace(/\.md$/, '')
    const { frontmatter, doc } = parseChapter(fileResult.content, fallbackTitle)
    const id = frontmatter.id || ref.id
    items.push({
      id,
      type: 'chapter',
      title: frontmatter.title,
      status: frontmatter.status ?? 'draft',
      synopsis: frontmatter.synopsis,
      pov: frontmatter.pov,
      wordCount: 0,            // recomputed by the editor/stats, never persisted
      children: []
    })
    documentContents[id] = JSON.stringify(doc)
  }

  return { items, documentContents, chapterRefs }
}
```

- [ ] **Step 2 : Ajouter `chapterRefs` à l'état du store**

Dans l'interface `ProjectState` (près de `activeDocumentId`), ajouter :
```typescript
  chapterRefs: ChapterRef[]   // id↔file mapping from the manifest (kept stable on save)
```
Et dans l'état initial (l.~332, à côté de `activeDocumentId: null`) :
```typescript
  chapterRefs: [],
```

- [ ] **Step 3 : Réécrire la lecture dans `openRecentProject`**

Dans `openRecentProject`, remplacer le bloc l.407-458 (lecture de `structure.json` + boucle `documents/`) par :
```typescript
      const metaResult = await window.electronAPI.readFile(`${projectPath}/project.json`)
      if (!metaResult.success || !metaResult.content) {
        throw new Error('Impossible de lire project.json')
      }
      const manifest = JSON.parse(metaResult.content) as Record<string, unknown> & { chapters?: ChapterRef[] }
      const { chapters: chapterRefsRaw, ...meta } = manifest
      const chapterRefs: ChapterRef[] = Array.isArray(chapterRefsRaw) ? chapterRefsRaw : []

      const stats = await loadStatsFromDisk(projectPath)
      const sheets = await loadSheetsFromDisk(projectPath)
      const reports = await loadReportsFromDisk(projectPath)

      const loaded = await loadManuscriptFromDisk(projectPath, chapterRefs)
      const manuscript: ManuscriptStructure = { items: loaded.items }

      const project: Project = { meta: meta as ProjectMeta, manuscript, sheets, stats, reports }

      useStatsStore.getState().setProjectId((meta as ProjectMeta).id)
      useStatsStore.getState().loadStats(stats)
      useEditorStore.getState().loadUserOverrides((meta as ProjectMeta).typographyOverrides || {})

      const editorStore = useEditorStore.getState()
      editorStore.clearDocumentContents()
      editorStore.loadDocumentContents(loaded.documentContents)
```
Puis dans le `set({...})` qui suit (l.461), ajouter `chapterRefs: loaded.chapterRefs,` et conserver `activeDocumentId: findFirstValidDocumentId(manuscript.items)`.

- [ ] **Step 4 : Appliquer le même remplacement aux deux autres chemins**

Répéter le remplacement de Step 3 dans `openProject` (bloc l.~939-984) et `openLastProject` (bloc l.~1219-1264) : lire `project.json` → manifeste, `loadManuscriptFromDisk`, charger `documentContents`, poser `chapterRefs` dans le `set`. (Mêmes lignes, code identique — répété ici volontairement, ne pas factoriser en sautant un chemin.)

- [ ] **Step 5 : Vérifier la compilation**

Run :
```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
cd /Users/saidimu/DEV/PROJETS/palimpseste && npm run build
```
Expected : build OK (TypeScript résout `@shared/markdown`).

- [ ] **Step 6 : Commit**
```bash
git add src/renderer/stores/projectStore.ts
git commit -m "feat(store): load manuscript from manifest + chapitres/*.md"
```

---

### Task 10 : Persistance — sauvegarde en manifeste + `.md` (+ suppression des orphelins)

**Files:**
- Modify: `src/renderer/stores/projectStore.ts` (`saveProject`, l.1004-1137)

- [ ] **Step 1 : Importer les helpers de manifeste/codec**

En tête de `projectStore.ts`, étendre l'import markdown :
```typescript
import { parseChapter, serializeChapter, planChapterFiles, orphanFiles, type ChapterRef } from '@shared/markdown'
import type { TipTapDoc } from '@shared/markdown'
```

- [ ] **Step 2 : Remplacer l'écriture du manuscrit dans `saveProject` (mode Electron)**

Dans `saveProject`, remplacer le bloc l.1068-1102 (écriture `structure.json` + boucle `documents/`) par :
```typescript
      // --- Manuscript: one .md per chapter + manifest order ---
      const items = project.manuscript.items
      const newRefs = planChapterFiles(
        items.map(i => ({ id: i.id, title: i.title })),
        get().chapterRefs
      )
      const refById = new Map(newRefs.map(r => [r.id, r.file]))
      const docContents = useEditorStore.getState().getAllDocumentContents()

      for (const item of items) {
        const file = refById.get(item.id)
        if (!file) continue
        const json = docContents.get(item.id)
        const doc: TipTapDoc = json
          ? (JSON.parse(json) as TipTapDoc)
          : { type: 'doc', content: [{ type: 'chapterTitle', content: [{ type: 'text', text: item.title }] }] }
        const md = serializeChapter({
          frontmatter: {
            id: item.id,
            title: item.title,
            status: item.status,
            synopsis: item.synopsis,
            pov: item.pov
          },
          doc
        })
        await ensureWriteFile(`${projectPath}/${file}`, md)
      }

      // Delete .md files for removed chapters (journal-aware).
      for (const orphan of orphanFiles(get().chapterRefs, newRefs)) {
        await window.electronAPI.deleteFile(`${projectPath}/${orphan}`)
      }

      // Manifest = meta + ordered chapter refs.
      await ensureWriteFile(
        `${projectPath}/project.json`,
        JSON.stringify({ ...updatedMeta, chapters: newRefs }, null, 2)
      )
```
Important : supprimer l'ancienne écriture de `project.json` à la l.1064-1067 (elle est remplacée par l'écriture du manifeste ci-dessus, qui inclut `chapters`). Garder les écritures `stats/*` et `sheets/*` et `reports/*` telles quelles.

- [ ] **Step 3 : Mettre à jour `chapterRefs` après commit**

Dans le `set({...})` final de `saveProject` (l.1131), ajouter `chapterRefs: newRefs,`.

- [ ] **Step 4 : Gérer aussi le mode navigateur (localStorage)**

Le mode navigateur (l.1029-1048) sérialise tout le `Project` en JSON dans localStorage — aucun fichier `.md`. Laisser ce chemin **inchangé** (les contenus restent dans `editorStore.documentContents` en mémoire, persistés via le project blob). Ajouter un commentaire :
```typescript
      // Browser mode keeps the in-memory TipTap JSON (no .md files on disk).
```

- [ ] **Step 5 : Vérifier compilation + tests**

Run :
```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
cd /Users/saidimu/DEV/PROJETS/palimpseste && npm run build && npm run test:main
```
Expected : build OK, tests verts.

- [ ] **Step 6 : Commit**
```bash
git add src/renderer/stores/projectStore.ts
git commit -m "feat(store): save manuscript as manifest + chapitres/*.md, prune orphans"
```

---

### Task 11 : Création de projet au nouveau format

**Files:**
- Modify: `src/renderer/stores/projectStore.ts` (`createNewProject`, l.763-879)

- [ ] **Step 1 : Remplacer la création de l'arborescence disque**

Dans `createNewProject` (mode Electron), remplacer la création des dossiers l.811 et les écritures l.826-829 :

Remplacer `await ensureCreateDirectory(`${projectPath}/manuscript/documents`)` par :
```typescript
      await ensureCreateDirectory(`${projectPath}/chapitres`)
```
Supprimer les lignes créant `sheets/characters|locations|plots|custom` (l.812-815) si inutilisées par ailleurs — garder seulement `sheets` plat :
```typescript
      await ensureCreateDirectory(`${projectPath}/sheets`)
```
(Conserver `stats`, `reports`, `snapshots`, `trash`.)

- [ ] **Step 2 : Écrire le manifeste + le chapitre initial en `.md`**

Remplacer l'écriture de `structure.json` (l.826-829) par :
```typescript
      // Initial chapter → one .md + manifest entry
      const firstItem = project.manuscript.items[0]
      const initialRefs = planChapterFiles(
        project.manuscript.items.map(i => ({ id: i.id, title: i.title })),
        []
      )
      for (const ref of initialRefs) {
        const item = project.manuscript.items.find(i => i.id === ref.id)!
        const md = serializeChapter({
          frontmatter: { id: item.id, title: item.title, status: item.status },
          doc: {
            type: 'doc',
            content: [
              { type: 'chapterTitle', content: [{ type: 'text', text: item.title }] },
              { type: 'firstParagraph', content: [] }
            ]
          }
        })
        await ensureWriteFile(`${projectPath}/${ref.file}`, md)
      }
```
Et remplacer l'écriture de `project.json` (l.822-825) par :
```typescript
      await ensureWriteFile(
        `${projectPath}/project.json`,
        JSON.stringify({ ...project.meta, chapters: initialRefs }, null, 2)
      )
```

- [ ] **Step 3 : Initialiser `chapterRefs` et les contenus éditeur en mémoire**

Dans le `set({...})` de `createNewProject` (l.852), ajouter `chapterRefs: initialRefs,`. Après `useEditorStore.getState().clearDocumentContents()` (l.863), pré-charger le contenu initial pour que l'éditeur n'ait pas à le régénérer :
```typescript
      const initialContents: Record<string, string> = {}
      for (const ref of initialRefs) {
        const item = project.manuscript.items.find(i => i.id === ref.id)!
        initialContents[item.id] = JSON.stringify({
          type: 'doc',
          content: [
            { type: 'chapterTitle', content: [{ type: 'text', text: item.title }] },
            { type: 'firstParagraph', content: [] }
          ]
        })
      }
      useEditorStore.getState().loadDocumentContents(initialContents)
```

- [ ] **Step 4 : Vérifier compilation**

Run : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build`
Expected : build OK.

- [ ] **Step 5 : Commit**
```bash
git add src/renderer/stores/projectStore.ts
git commit -m "feat(store): create new projects in markdown format (manifest + chapitres/)"
```

---

### Task 12 : Action `renameChapter` (source unique du titre)

**Files:**
- Modify: `src/renderer/stores/projectStore.ts` (interface + action)

- [ ] **Step 1 : Déclarer l'action dans l'interface**

Dans `ProjectState`, près de `updateManuscriptItem` (l.120), ajouter :
```typescript
  renameChapter: (id: string, title: string) => void
```

- [ ] **Step 2 : Implémenter l'action**

Après `updateManuscriptItem` (l.541), ajouter :
```typescript
  // Single setter for a chapter title (the source of truth).
  // The TDM and the on-page chapter-title block both go through here.
  renameChapter: (id, title) => {
    get().updateManuscriptItem(id, { title })
  },
```
(Garde-bas niveau : l'action ne touche pas l'éditeur ; la synchronisation vers le bloc-titre se fait dans `EditorArea` à la Task 13, avec anti-boucle.)

- [ ] **Step 3 : Vérifier compilation**

Run : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build`
Expected : build OK.

- [ ] **Step 4 : Commit**
```bash
git add src/renderer/stores/projectStore.ts
git commit -m "feat(store): renameChapter single-source title setter"
```

---

### Task 13 : Sync titre bidirectionnelle TDM ↔ bloc-titre

**Files:**
- Modify: `src/renderer/components/editor/EditorArea.tsx`
- Modify: `src/renderer/components/layout/Sidebar.tsx`

- [ ] **Step 1 : TDM → modèle (Sidebar)**

Dans `Sidebar.tsx`, le `handleRename` appelle aujourd'hui `onUpdate(item.id, { title })`. Pour un chapitre, router vers `renameChapter`. Dans `ManuscriptPanel`, récupérer l'action :
```typescript
  const { renameChapter } = useProjectStore()
```
et passer une prop `onRename` à `ManuscriptTreeItem`, utilisée dans `handleRename` à la place de `onUpdate(id, { title })` :
```typescript
    onRename(item.id, renameValue.trim())
```
Câbler `onRename={renameChapter}` depuis `ManuscriptPanel`.

- [ ] **Step 2 : modèle → bloc-titre (EditorArea), avec anti-boucle**

Dans `EditorArea.tsx`, ajouter un ref garde près des autres refs (l.56-59) :
```typescript
  const programmaticTitleRef = useRef(false)
```
Ajouter un effet qui pousse le titre du modèle dans le nœud `chapterTitle` quand il change (après les effets existants) :
```typescript
  // Model → on-page chapter title (guarded against feedback loop)
  const activeItem = project ? findManuscriptItem(project.manuscript.items, activeDocumentId ?? '') : null
  const activeTitle = activeItem?.title
  useEffect(() => {
    if (!editor || !activeDocumentId || activeTitle === undefined) return
    const first = editor.state.doc.firstChild
    if (!first || first.type.name !== 'chapterTitle') return
    if (first.textContent === activeTitle) return
    programmaticTitleRef.current = true
    editor.chain()
      .command(({ tr }) => {
        const end = first.nodeSize - 1
        tr.insertText(activeTitle, 1, end)
        return true
      })
      .run()
    programmaticTitleRef.current = false
  }, [editor, activeDocumentId, activeTitle])
```

- [ ] **Step 3 : bloc-titre → modèle (EditorArea onUpdate)**

Dans le `onUpdate` de `useEditor` (l.123-135), après le `setDocumentContent`, propager le titre édité vers le modèle (sauf écriture programmatique) :
```typescript
    onUpdate: ({ editor }) => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
      saveDebounceRef.current = setTimeout(() => {
        const docId = activeDocumentIdRef.current
        if (!docId) return
        setDocumentContent(docId, JSON.stringify(editor.getJSON()))
        setDirty(true)
        // On-page title → model (skip when we just wrote it programmatically)
        if (!programmaticTitleRef.current) {
          const first = editor.state.doc.firstChild
          if (first && first.type.name === 'chapterTitle') {
            const current = useProjectStore.getState().project
            const item = current ? findManuscriptItem(current.manuscript.items, docId) : null
            if (item && item.title !== first.textContent) {
              useProjectStore.getState().renameChapter(docId, first.textContent)
            }
          }
        }
      }, 300)
    }
```

- [ ] **Step 4 : Vérification visuelle (manuelle)**

Run : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run launch:dev`
Vérifier : (a) renommer dans la TDM met à jour le bloc-titre sur la page ; (b) éditer le bloc-titre met à jour la TDM ; (c) pas de boucle/scintillement ; (d) le titre n'apparaît qu'une fois (pas dupliqué dans le corps).

- [ ] **Step 5 : Commit**
```bash
git add src/renderer/components/editor/EditorArea.tsx src/renderer/components/layout/Sidebar.tsx
git commit -m "feat(editor): bidirectional chapter-title sync (TDM ↔ page) with loop guard"
```

---

### Task 14 : Note privée de chapitre (sidecar `.note.md`)

**Files:**
- Modify: `src/renderer/stores/projectStore.ts` (helpers note + état)
- Modify: `src/renderer/components/layout/Sidebar.tsx` (menu « Ajouter/Éditer une note »)
- Modify: `src/renderer/components/editor/EditorArea.tsx` (affichage de l'éditeur de note, optionnel ce cycle)

> Périmètre : persistance + accès. Le `.note.md` n'est jamais intercalé dans le manuscrit ni exporté.

- [ ] **Step 1 : Helpers de lecture/écriture de note**

Dans `projectStore.ts`, ajouter (le chemin du sidecar dérive du `file` du manifeste) :
```typescript
  // Path of the private note sidecar for a chapter id (or null if unknown).
  getChapterNotePath: (id: string): string | null => {
    const { projectPath, chapterRefs } = get()
    const ref = chapterRefs.find(r => r.id === id)
    if (!projectPath || !ref) return null
    return `${projectPath}/${ref.file.replace(/\.md$/, '.note.md')}`
  },
  loadChapterNote: async (id: string): Promise<string> => {
    const path = get().getChapterNotePath(id)
    if (!path) return ''
    const result = await window.electronAPI.readFile(path)
    return result.success && result.content ? result.content : ''
  },
  saveChapterNote: async (id: string, note: string): Promise<void> => {
    const path = get().getChapterNotePath(id)
    if (!path) return
    if (note.trim() === '') {
      await window.electronAPI.deleteFile(path)   // empty note → remove sidecar
    } else {
      await window.electronAPI.writeFile(path, note)
    }
  },
```
Déclarer ces trois signatures dans `ProjectState`.

- [ ] **Step 2 : Entrée de menu dans la TDM**

Dans `Sidebar.tsx`, ajouter au menu contextuel d'un chapitre une entrée « Note du chapitre » qui ouvre un éditeur de note (composant simple `textarea` dans une modale/panneau), branché sur `loadChapterNote`/`saveChapterNote`. Suivre le style des entrées existantes (Renommer/Dupliquer).

- [ ] **Step 3 : Vérification visuelle (manuelle)**

Run : `npm run launch:dev`
Vérifier : créer une note, fermer/rouvrir le projet, la note persiste dans `chapitres/<…>.note.md` ; une note vidée supprime le sidecar ; la note n'apparaît jamais dans le corps du chapitre ni dans l'export.

- [ ] **Step 4 : Commit**
```bash
git add src/renderer/stores/projectStore.ts src/renderer/components/layout/Sidebar.tsx src/renderer/components/editor/EditorArea.tsx
git commit -m "feat: private per-chapter note sidecar (.note.md)"
```

---

### Task 15 : Retrait du soulignement de l'UI

**Files:**
- Modify: `src/renderer/components/layout/Toolbar.tsx:90-95`
- Modify: `src/renderer/components/editor/FormattingPanel.tsx` (l.143-154, 263-268)

> L'extension `Underline` reste enregistrée (parse `<u>`), seules les commandes UI partent.

- [ ] **Step 1 : Retirer le bouton de la Toolbar**

Dans `Toolbar.tsx`, supprimer le bloc bouton souligné (l.~91-95) et l'import `Underline` (l.9) s'il devient inutilisé.

- [ ] **Step 2 : Retirer le bouton du FormattingPanel**

Dans `FormattingPanel.tsx`, supprimer `toggleUnderline` (l.143-145), `isUnderline` (l.154), le bouton (l.263-268), et l'import `Underline` (l.9) si inutilisé. Retirer « Underline » du commentaire l.64.

- [ ] **Step 3 : Vérifier compilation**

Run : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build`
Expected : build OK (pas d'import/variable inutilisé en `strict`).

- [ ] **Step 4 : Commit**
```bash
git add src/renderer/components/layout/Toolbar.tsx src/renderer/components/editor/FormattingPanel.tsx
git commit -m "refactor(editor): remove underline from toolbar (italic is the fiction norm)"
```

---

### Task 16 : « Ajouter une scène » → « Insérer un saut de scène »

**Files:**
- Modify: `src/renderer/components/layout/Sidebar.tsx` (menu contextuel l.309-317)

> Les scènes ne sont plus des entités ; l'auteur insère un `* * *` dans le chapitre courant.

- [ ] **Step 1 : Remplacer l'action de menu**

Dans `Sidebar.tsx`, remplacer l'entrée « Ajouter une scène » (qui appelait `onAddChild`) par « Insérer un saut de scène », qui agit sur l'éditeur courant si le chapitre est actif :
```typescript
            <ContextMenuItem onClick={() => {
              const ed = useEditorStore.getState().editor
              if (ed) ed.chain().focus().insertSceneBreak().run()
            }}>
              Insérer un saut de scène
            </ContextMenuItem>
```
(Importer `useEditorStore` si nécessaire.) Retirer la prop/handler `onAddChild` liée aux scènes si elle devient inutilisée.

- [ ] **Step 2 : Vérification visuelle (manuelle)**

Run : `npm run launch:dev`
Vérifier : l'entrée insère `* * *` ; après sauvegarde/relecture, le saut est présent dans le `.md` (`* * *`) et re-rendu comme séparateur.

- [ ] **Step 3 : Commit**
```bash
git add src/renderer/components/layout/Sidebar.tsx
git commit -m "feat(tdm): replace add-scene with insert scene break (* * *)"
```

---

### Task 17 : Vérification de bout en bout (export + cycle complet)

**Files:** aucun (vérification)

- [ ] **Step 1 : Cycle complet manuel**

Run : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run launch:dev`
Scénario :
1. Créer un nouveau projet → vérifier sur disque : `project.json` contient `chapters: [{id, file}]`, `chapitres/001-*.md` existe avec frontmatter `id`/`title`, **pas** de `manuscript/structure.json` ni `documents/`.
2. Écrire deux paragraphes + un saut de scène + du gras/italique ; renommer le chapitre ; ajouter un 2e chapitre ; réordonner ; sauvegarder.
3. Fermer puis rouvrir le projet → contenu, ordre, titres, sauts de scène, gras/italique **intacts**.
4. Supprimer un chapitre, sauvegarder → son `.md` disparaît de `chapitres/` (vérifier aussi que `.recovery/` permettrait la restauration).
5. Exporter en DOCX et PDF → le titre du chapitre apparaît **une seule fois** (régénéré depuis le frontmatter/`item.title`).

- [ ] **Step 2 : Suite de tests + build complet**

Run :
```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
cd /Users/saidimu/DEV/PROJETS/palimpseste && npm run build && npm run test:main
```
Expected : build OK, **tous** les tests verts.

- [ ] **Step 3 : Vérifier l'export titre-unique (si écart constaté)**

Dans `src/renderer/lib/export/docxExporter.ts` (l.109-115), le titre vient de `node.textContent` du nœud `chapterTitle` — qui reflète `item.title` (Task 13). Si l'export affichait un titre dupliqué ou manquant, corriger pour lire `item.title` du chapitre actif. Sinon, ne rien changer (déjà single-source). Documenter le constat dans le message de commit.

- [ ] **Step 4 : Commit final (si correctifs)**
```bash
git add -A
git commit -m "test: end-to-end markdown storage verification + export title fix"
```

---

## Auto-revue (couverture du spec)

- Décision 1 (MD source unique) → Tasks 5-7, 9-11. ✅
- Décision 2 (1 .md/chapitre) → Tasks 9-11. ✅
- Décision 3 (scènes = `* * *`) → Tasks 5-7 (codec), 16 (UI). ✅
- Décisions 4-5 (titre = frontmatter, sync bidirectionnelle) → Tasks 7, 12, 13. ✅
- Décision 6 (ordre = manifeste, fichiers stables) → Task 4, 9, 10. ✅
- Décision 7 (souligné retiré) → Task 15. ✅
- Décision 8 (surlignages non persistés) → inchangé (recalcul à l'ouverture, déjà le cas). ✅
- Décision 9 (note sidecar `.note.md`) → Task 14. ✅
- Gestion d'erreurs (frontmatter corrompu → titre de repli ; YAML illisible non bloquant) → Task 2 + Task 7 (`fallbackTitle`, `parseFrontmatter` ne jette jamais). ✅
- Tests round-trip / frontmatter / manifeste → Tasks 2, 4, 5, 6, 7. ✅
- Migration → **supprimée** (aucun projet réel ; arbitrage utilisateur). Documenté en tête.
- Hors périmètre confirmé : wiki, pagination, métadonnées par scène, migration sheets→wiki.

## Cohérence des types/signatures

- `ChapterRef { id, file }` : défini Task 1, utilisé identiquement Tasks 4, 9, 10, 11.
- `ParsedChapter { frontmatter, doc }` : Task 1, produit/consommé Task 7, utilisé Tasks 9, 10, 11.
- `parseChapter(md, fallbackTitle)` / `serializeChapter(parsed)` : signatures fixes Task 7, appelées Tasks 9, 10, 11.
- `planChapterFiles(items, existing)` / `orphanFiles(old, new)` : Task 4, appelées Tasks 10, 11.
- `renameChapter(id, title)` : Task 12, appelée Task 13.
- `electronAPI.deleteFile` : Task 8, appelée Tasks 10, 14.
- État store `chapterRefs: ChapterRef[]` : Task 9, lu/écrit Tasks 10, 11, 14.
