# Codec Markdown v2 sans perte (0a) - Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plus aucune perte de texte ni de structure entre l'éditeur TipTap et le disque : un sidecar JSON exact par chapitre, une projection Markdown lisible et étendue, un parseur tolérant qui ouvre correctement les projets existants (Savana), et un état « illisible » qui n'efface jamais rien.

**Architecture:** Le cœur reste pur dans `src/shared/markdown/` (aucun import Node/Electron, testé en `node --test`). Le sidecar `chapitres/.palim/<id>.json` fait foi quand son hash SHA-256 correspond au `.md` ; sinon on parse le `.md`. `projectStore` (renderer) orchestre lecture et écriture via l'IPC `fs:*` existant. L'éditeur porte une garde de parité schéma/codec.

**Tech Stack:** TypeScript strict, Node 22 (`node --test`, `crypto.subtle`), Electron 28, React 18, Zustand 4, TipTap 2.

**Spec:** `docs/superpowers/specs/2026-09-13-codec-markdown-v2-design.md`

## Global Constraints

- Modules sous `src/shared/markdown/` : **aucun import** de `node:*`, `fs`, `path`, `electron`, `window`. Imports relatifs avec suffixe `.js` (`from './types.js'`), convention du dossier.
- Tests : `src/main/__tests__/markdown.<sujet>.test.ts`, `import test from 'node:test'`, `import assert from 'node:assert/strict'`, imports `../../shared/markdown/<module>.js`.
- Lancer les tests : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:/opt/homebrew/bin:$PATH" && npm run test:main` (compile via `tsc -p tsconfig.node.json` puis `node --test dist/main/src/main/__tests__/*.test.js`). Un seul fichier : remplacer `*.test.js` par le nom compilé, ex. `markdown.hash.test.js`.
- Typecheck renderer : `npx tsc --noEmit -p tsconfig.json`. Le build (`npm run build`) ne doit pas être lancé si une instance dev tourne.
- Interface en français, sans accents manquants. Commits en anglais. Jamais de tiret cadratin (`—`) dans le code, les docs ou les messages : tiret simple `-`.
- Chaque commit se termine par :
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011eKCjX7m5d9AxSz88cZyUs
  ```
- Dialecte Markdown (spec §4) : `- ` en début de ligne = paragraphe (dialogue), **jamais** une liste ; puces écrites `+ `, lues `+ ` ou `* ` ; `* * *` = `sceneBreak`, `---` = `horizontalRule` ; `\` en fin de ligne = `hardBreak` (deux espaces acceptés en lecture) ; `\n` simple = nouveau paragraphe.
- Ne jamais ouvrir `~/Desktop/Savana.palim` avec l'app pendant ce chantier. Pour la vérification finale, travailler sur une **copie** (`cp -R ~/Desktop/Savana.palim /tmp/Savana-test.palim`).

---

## Structure de fichiers

| Fichier | Rôle |
|---|---|
| `src/shared/markdown/hash.ts` (créer) | `sha256Hex(text)` via `crypto.subtle` |
| `src/shared/markdown/sidecar.ts` (créer) | type `ChapterSidecar`, `SIDECAR_DIR`, `sidecarPath`, `stringifySidecar`, `parseSidecar` |
| `src/shared/markdown/body.ts` (réécrire) | sérialiseur doc → Markdown étendu, parseur ligne à ligne, `SUPPORTED_BLOCK_TYPES`, `SUPPORTED_MARK_TYPES`, `MARK_ORDER`, `parseInline`, `serializeInline` |
| `src/shared/markdown/projection.ts` (créer) | `projectMarkdown(doc)` : ce que le `.md` conserve (oracle des tests) |
| `src/shared/markdown/schemaNames.ts` (créer) | `EDITOR_NODE_AND_MARK_NAMES`, `NON_CONTENT_SCHEMA_NAMES`, `CODEC_SUPPORTED_NAMES` |
| `src/shared/markdown/__fixtures__/codecCorpus.ts` (créer) | corpus de documents couvrant chaque nœud/mark ; fixtures au format Savana |
| `src/shared/markdown/chapter.ts` (modifier) | `parseChapter(md, fallbackTitle, refId?)` |
| `src/shared/markdown/load.ts` (créer) | `resolveChapterDoc(input)` : décision sidecar / Markdown / illisible |
| `src/shared/markdown/index.ts` (modifier) | exporter les nouveaux modules |
| `src/shared/types/project.ts` (modifier) | `ManuscriptItem.loadState?` |
| `src/renderer/stores/projectStore.ts` (modifier) | `loadManuscriptFromDisk`, `saveProject`, `createProject`, suppression des orphelins |
| `src/renderer/components/editor/EditorArea.tsx` (modifier) | garde de parité, `setEditable`, bandeau illisible |
| `src/renderer/components/layout/Sidebar.tsx` (modifier) | marqueur illisible dans la TDM |
| `CLAUDE.md` (modifier) | section « Format projet `.palim` » |

---

### Task 1: Hachage SHA-256 pur

**Files:**
- Create: `src/shared/markdown/hash.ts`
- Test: `src/main/__tests__/markdown.hash.test.ts`

**Interfaces:**
- Produces: `sha256Hex(text: string): Promise<string>` (64 caractères hexadécimaux minuscules).

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/main/__tests__/markdown.hash.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { sha256Hex } from '../../shared/markdown/hash.js'

test('sha256Hex matches the known digest of "abc"', async () => {
  assert.equal(
    await sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  )
})

test('sha256Hex is stable and sensitive to a single character', async () => {
  const a = await sha256Hex('Il faisait nuit.')
  const b = await sha256Hex('Il faisait nuit.')
  const c = await sha256Hex('Il faisait nuit!')
  assert.equal(a, b)
  assert.notEqual(a, c)
  assert.match(a, /^[0-9a-f]{64}$/)
})

test('sha256Hex handles UTF-8 (accents, nbsp)', async () => {
  const h = await sha256Hex('« Été » !')
  assert.match(h, /^[0-9a-f]{64}$/)
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:/opt/homebrew/bin:$PATH" && npm run test:main`
Expected: échec de compilation `Cannot find module '../../shared/markdown/hash.js'`.

- [ ] **Step 3: Implémenter**

```ts
// src/shared/markdown/hash.ts
/**
 * SHA-256 hex digest of a UTF-8 string. Uses the Web Crypto API, available as
 * `crypto.subtle` in both the Electron renderer and Node 22, so this module
 * stays free of node:crypto and works on both sides.
 */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npm run test:main`
Expected: tous les tests passent, dont les 3 nouveaux (133 au total).

- [ ] **Step 5: Commit**

```bash
git add src/shared/markdown/hash.ts src/main/__tests__/markdown.hash.test.ts
git commit -m "feat(markdown): pure sha256Hex helper (Web Crypto, renderer + node)"
```

---

### Task 2: Sidecar JSON par chapitre

**Files:**
- Create: `src/shared/markdown/sidecar.ts`
- Modify: `src/shared/markdown/index.ts`
- Test: `src/main/__tests__/markdown.sidecar.test.ts`

**Interfaces:**
- Consumes: `TipTapDoc` de `./types.js`.
- Produces:
  ```ts
  export const SIDECAR_VERSION = 1
  export const SIDECAR_DIR = 'chapitres/.palim'
  export interface ChapterSidecar { version: 1; mdHash: string; savedAt: string; doc: TipTapDoc }
  export function sidecarPath(chapterId: string): string          // 'chapitres/.palim/<id>.json'
  export function stringifySidecar(s: ChapterSidecar): string
  export type SidecarParseResult =
    | { ok: true; sidecar: ChapterSidecar }
    | { ok: false; reason: 'corrupt' | 'unknown-version' | 'invalid-doc' }
  export function parseSidecar(text: string): SidecarParseResult
  ```

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// src/main/__tests__/markdown.sidecar.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SIDECAR_DIR, sidecarPath, stringifySidecar, parseSidecar, type ChapterSidecar
} from '../../shared/markdown/sidecar.js'

const doc = { type: 'doc' as const, content: [
  { type: 'chapterTitle', content: [{ type: 'text', text: 'Un' }] },
  { type: 'paragraph', attrs: { textAlign: 'center' }, content: [
    { type: 'text', text: 'Centré ', marks: [{ type: 'highlight', attrs: { color: '#fde047' } }] },
    { type: 'text', text: 'exact.' }
  ] },
  { type: 'mysteryNode', attrs: { x: 1 }, content: [{ type: 'text', text: 'inconnu' }] }
] }

test('sidecarPath is id-based under the hidden .palim dir', () => {
  assert.equal(SIDECAR_DIR, 'chapitres/.palim')
  assert.equal(sidecarPath('abc-123'), 'chapitres/.palim/abc-123.json')
})

test('stringify/parse round-trips every node, attr and mark exactly', () => {
  const s: ChapterSidecar = { version: 1, mdHash: 'ff'.repeat(32), savedAt: '2026-09-13T10:00:00.000Z', doc }
  const text = stringifySidecar(s)
  assert.ok(text.endsWith('\n'))
  const r = parseSidecar(text)
  assert.ok(r.ok)
  if (r.ok) assert.deepEqual(r.sidecar, s)
})

test('parseSidecar rejects corrupt JSON', () => {
  assert.deepEqual(parseSidecar('{ "version": 1, '), { ok: false, reason: 'corrupt' })
  assert.deepEqual(parseSidecar(''), { ok: false, reason: 'corrupt' })
})

test('parseSidecar rejects unknown versions', () => {
  const r = parseSidecar(JSON.stringify({ version: 2, mdHash: 'a', savedAt: 's', doc }))
  assert.deepEqual(r, { ok: false, reason: 'unknown-version' })
})

test('parseSidecar rejects an invalid doc or missing hash', () => {
  assert.deepEqual(parseSidecar(JSON.stringify({ version: 1, mdHash: 'a', savedAt: 's', doc: { type: 'paragraph' } })), { ok: false, reason: 'invalid-doc' })
  assert.deepEqual(parseSidecar(JSON.stringify({ version: 1, mdHash: 'a', savedAt: 's', doc: { type: 'doc', content: 'x' } })), { ok: false, reason: 'invalid-doc' })
  assert.deepEqual(parseSidecar(JSON.stringify({ version: 1, savedAt: 's', doc })), { ok: false, reason: 'invalid-doc' })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm run test:main`
Expected: échec de compilation, module `sidecar.js` introuvable.

- [ ] **Step 3: Implémenter**

```ts
// src/shared/markdown/sidecar.ts
import type { TipTapDoc } from './types.js'

/**
 * Per-chapter sidecar: the exact TipTap document, source of truth when its
 * mdHash matches the .md on disk. Named by chapter id (stable across renames).
 */
export const SIDECAR_VERSION = 1 as const
export const SIDECAR_DIR = 'chapitres/.palim'

export interface ChapterSidecar {
  version: typeof SIDECAR_VERSION
  mdHash: string    // sha256Hex of the full .md text as written
  savedAt: string   // ISO date
  doc: TipTapDoc
}

export type SidecarParseResult =
  | { ok: true; sidecar: ChapterSidecar }
  | { ok: false; reason: 'corrupt' | 'unknown-version' | 'invalid-doc' }

export function sidecarPath(chapterId: string): string {
  return `${SIDECAR_DIR}/${chapterId}.json`
}

export function stringifySidecar(sidecar: ChapterSidecar): string {
  return JSON.stringify(sidecar, null, 2) + '\n'
}

export function parseSidecar(text: string): SidecarParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'corrupt' }
  }
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'corrupt' }
  const obj = raw as Record<string, unknown>
  if (obj.version !== SIDECAR_VERSION) return { ok: false, reason: 'unknown-version' }
  const doc = obj.doc as Record<string, unknown> | undefined
  if (typeof obj.mdHash !== 'string' || !doc || doc.type !== 'doc' || !Array.isArray(doc.content)) {
    return { ok: false, reason: 'invalid-doc' }
  }
  return {
    ok: true,
    sidecar: {
      version: SIDECAR_VERSION,
      mdHash: obj.mdHash,
      savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : '',
      doc: doc as unknown as TipTapDoc
    }
  }
}
```

Ajouter à `src/shared/markdown/index.ts` :
```ts
export * from './hash.js'
export * from './sidecar.js'
```

- [ ] **Step 4: Vérifier le succès**

Run: `npm run test:main`
Expected: tout passe (138 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/markdown/sidecar.ts src/shared/markdown/index.ts src/main/__tests__/markdown.sidecar.test.ts
git commit -m "feat(markdown): chapter sidecar codec (chapitres/.palim/<id>.json, versioned, validated)"
```

---

### Task 3: Marks étendus et échappement (inline)

**Files:**
- Modify: `src/shared/markdown/body.ts` (remplacer `escapeInline`, `serializeInline`, `unescapeInline`, `parseInline` ; le reste du fichier est inchangé pour l'instant)
- Test: `src/main/__tests__/markdown.inline.test.ts`

**Interfaces:**
- Produces (exportés depuis `body.ts`, utilisés par les tâches 5 et 6) :
  ```ts
  export const SUPPORTED_MARK_TYPES: ReadonlySet<string>   // bold, italic, strike, code, underline, highlight
  export const MARK_ORDER: readonly string[]               // ['highlight','underline','strike','italic','bold','code'] outer → inner
  export function serializeInline(nodes: TipTapNode[] | undefined): string
  export function parseInline(line: string): TipTapNode[]
  ```

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// src/main/__tests__/markdown.inline.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { serializeInline, parseInline, MARK_ORDER } from '../../shared/markdown/body.js'
import type { TipTapNode } from '../../shared/markdown/types.js'

const t = (text: string, ...marks: string[]): TipTapNode =>
  marks.length ? { type: 'text', text, marks: marks.map(type => ({ type })) } : { type: 'text', text }

test('each supported mark serializes to its delimiter', () => {
  assert.equal(serializeInline([t('g', 'bold')]), '**g**')
  assert.equal(serializeInline([t('i', 'italic')]), '*i*')
  assert.equal(serializeInline([t('b', 'strike')]), '~~b~~')
  assert.equal(serializeInline([t('c', 'code')]), '`c`')
  assert.equal(serializeInline([t('s', 'underline')]), '<u>s</u>')
  assert.equal(serializeInline([t('h', 'highlight')]), '==h==')
})

test('nested marks use a fixed outer-to-inner order regardless of input order', () => {
  const a = serializeInline([t('x', 'bold', 'highlight', 'italic')])
  const b = serializeInline([t('x', 'italic', 'bold', 'highlight')])
  assert.equal(a, '==***x***==')
  assert.equal(a, b)
  assert.deepEqual([...MARK_ORDER], ['highlight', 'underline', 'strike', 'italic', 'bold', 'code'])
})

test('code content is never escaped, other text escapes mark openers only', () => {
  assert.equal(serializeInline([t('a*b `c` ~~d', 'code')]), '`a*b `c` ~~d`')
  assert.equal(serializeInline([t('2 * 3 ~ 4 = 5 <b>')]), '2 \\* 3 ~ 4 = 5 <b>')
  assert.equal(serializeInline([t('a~~b==c`d<u>e</u>')]), 'a\\~~b\\==c\\`d\\<u>e\\</u>')
})

test('hardBreak serializes as a trailing backslash line break', () => {
  assert.equal(serializeInline([t('un'), { type: 'hardBreak' }, t('deux')]), 'un\\\ndeux')
})

test('parseInline reads every mark and sorts marks canonically', () => {
  assert.deepEqual(parseInline('**g** *i* ~~b~~ `c` <u>s</u> ==h=='), [
    t('g', 'bold'), t(' '), t('i', 'italic'), t(' '), t('b', 'strike'), t(' '),
    t('c', 'code'), t(' '), t('s', 'underline'), t(' '), t('h', 'highlight')
  ])
  assert.deepEqual(parseInline('==***x***=='), [t('x', 'highlight', 'italic', 'bold')])
})

test('parseInline: an opener without a closer is plain text', () => {
  assert.deepEqual(parseInline('2 * 3 = 6 et a == b'), [t('2 * 3 = 6 et a == b')])
  assert.deepEqual(parseInline('<u>ouvert sans fin'), [t('<u>ouvert sans fin')])
})

test('parseInline honours escapes, including legacy \\- and \\.', () => {
  assert.deepEqual(parseInline('a\\~~b\\==c\\`d\\<u>e\\</u> \\- \\.'), [t('a~~b==c`d<u>e</u> - .')])
  assert.deepEqual(parseInline('\\*pas italique\\*'), [t('*pas italique*')])
})

test('inline round-trip for marks and escapable characters', () => {
  // marks are given in canonical order (MARK_ORDER) so deepEqual can hold
  const nodes = [t('« '), t('Été', 'italic', 'bold'), t(' » 2*3 ~~x ==y `z` <u>w</u> \\ fin')]
  assert.deepEqual(parseInline(serializeInline(nodes)), nodes)
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm run test:main`
Expected: erreurs TypeScript (`MARK_ORDER`, `serializeInline`, `parseInline` non exportés).

- [ ] **Step 3: Implémenter la partie inline de `body.ts`**

Remplacer, dans `src/shared/markdown/body.ts`, les fonctions `escapeInline`, `serializeInline`, `unescapeInline` et `parseInline` par le bloc suivant (garder `escapeLeading`, `serializeBlock`, `docToMarkdownBody`, `parseBlock`, `markdownBodyToContent` tels quels pour cette tâche ; `parseBlock` appelle déjà `parseInline`) :

```ts
import type { TipTapDoc, TipTapNode } from './types.js'

// --- Supported schema ---------------------------------------------------------

export const SUPPORTED_MARK_TYPES: ReadonlySet<string> = new Set([
  'bold', 'italic', 'strike', 'code', 'underline', 'highlight'
])

/** Nesting order when writing, outermost first. `code` is always innermost. */
export const MARK_ORDER: readonly string[] = ['highlight', 'underline', 'strike', 'italic', 'bold', 'code']

const MARK_DELIMS: Record<string, [open: string, close: string]> = {
  highlight: ['==', '=='],
  underline: ['<u>', '</u>'],
  strike: ['~~', '~~'],
  italic: ['*', '*'],
  bold: ['**', '**'],
  code: ['`', '`']
}

// Delimiters tried by the reader, longest first so ** wins over *.
const INLINE_DELIMS: Array<[type: string, open: string, close: string]> = [
  ['bold', '**', '**'],
  ['italic', '*', '*'],
  ['strike', '~~', '~~'],
  ['highlight', '==', '=='],
  ['underline', '<u>', '</u>']
]

const ESCAPABLE = new Set(['*', '_', '\\', '`', '~', '=', '<', '>', '#', '+', '-', '.'])

// --- Inline serialization -----------------------------------------------------

/** Escape characters/sequences that would open a mark when read back. */
function escapeInline(text: string): string {
  return text
    .replace(/([*_\\`])/g, '\\$1')
    .replace(/~~/g, '\\~~')
    .replace(/==/g, '\\==')
    .replace(/<(\/?u)>/g, '\\<$1>')
}

function sortMarks(types: string[]): string[] {
  return [...new Set(types)]
    .filter(t => SUPPORTED_MARK_TYPES.has(t))
    .sort((a, b) => MARK_ORDER.indexOf(a) - MARK_ORDER.indexOf(b))
}

function wrapMarks(text: string, types: string[]): string {
  let out = text
  // innermost first: walk MARK_ORDER from the end
  for (let i = MARK_ORDER.length - 1; i >= 0; i--) {
    const t = MARK_ORDER[i]
    if (types.includes(t)) out = MARK_DELIMS[t][0] + out + MARK_DELIMS[t][1]
  }
  return out
}

export function serializeInline(nodes: TipTapNode[] | undefined): string {
  if (!nodes) return ''
  let out = ''
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      out += '\\\n'
      continue
    }
    if (node.type !== 'text' || typeof node.text !== 'string') continue
    const types = sortMarks((node.marks ?? []).map(m => m.type))
    const raw = types.includes('code') ? node.text : escapeInline(node.text)
    out += wrapMarks(raw, types)
  }
  return out
}

// --- Inline parsing -----------------------------------------------------------

/** Index of the next unescaped `delim` at or after `from`, or -1. */
function findClose(line: string, from: number, delim: string): number {
  let i = from
  while (i < line.length) {
    if (line[i] === '\\') { i += 2; continue }
    if (line.startsWith(delim, i)) return i
    i++
  }
  return -1
}

/**
 * Tokenize one physical line into text nodes carrying marks. Delimiters toggle
 * marks; an opener with no matching closer on the line is literal text; `\x`
 * yields a literal x for every escapable x (legacy \- and \. included).
 */
export function parseInline(line: string): TipTapNode[] {
  const out: TipTapNode[] = []
  const open: string[] = []
  let buf = ''
  const flush = () => {
    if (!buf) return
    const node: TipTapNode = { type: 'text', text: buf }
    if (open.length) node.marks = sortMarks(open).map(type => ({ type }))
    out.push(node)
    buf = ''
  }
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (ch === '\\' && i + 1 < line.length && ESCAPABLE.has(line[i + 1])) {
      buf += line[i + 1]
      i += 2
      continue
    }
    if (ch === '`') {
      const close = line.indexOf('`', i + 1)
      if (close > i) {
        flush()
        open.push('code')
        buf = line.slice(i + 1, close)
        flush()
        open.pop()
        i = close + 1
        continue
      }
    }
    let matched = false
    for (const [type, openD, closeD] of INLINE_DELIMS) {
      if (open.includes(type)) {
        if (line.startsWith(closeD, i)) {
          flush()
          open.splice(open.indexOf(type), 1)
          i += closeD.length
          matched = true
          break
        }
      } else if (line.startsWith(openD, i) && findClose(line, i + openD.length, closeD) !== -1) {
        flush()
        open.push(type)
        i += openD.length
        matched = true
        break
      }
    }
    if (matched) continue
    buf += ch
    i++
  }
  flush()
  return out
}
```

Attention : l'ancienne fonction `unescapeInline` disparaît ; l'échappement est traité dans le scanner. Si `parseBlock` (encore présent) référence `unescapeInline`, ce n'est pas le cas dans le code actuel : il n'appelle que `parseInline`.

- [ ] **Step 4: Vérifier le succès**

Run: `npm run test:main`
Expected: tout passe (les anciens tests `markdown.chapter.test.ts` continuent de passer, les 8 nouveaux aussi).

- [ ] **Step 5: Commit**

```bash
git add src/shared/markdown/body.ts src/main/__tests__/markdown.inline.test.ts
git commit -m "feat(markdown): inline codec for strike/code/underline/highlight with canonical mark order and escaping"
```

---

### Task 4: Parseur ligne à ligne et blocs simples

**Files:**
- Modify: `src/shared/markdown/body.ts` (remplacer `escapeLeading`, `serializeBlock`, `docToMarkdownBody`, `parseBlock`, `markdownBodyToContent`)
- Test: `src/main/__tests__/markdown.blocks.test.ts`

**Interfaces:**
- Consumes: `serializeInline`, `parseInline` (Task 3).
- Produces: `SUPPORTED_BLOCK_TYPES: ReadonlySet<string>` ; `docToMarkdownBody(doc: TipTapDoc): string` ; `markdownBodyToContent(body: string): TipTapNode[]`. Le parseur de conteneurs (Task 5) branchera `parseList` et la citation/fence dans `parseBlocks` défini ici.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// src/main/__tests__/markdown.blocks.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { docToMarkdownBody, markdownBodyToContent } from '../../shared/markdown/body.js'
import type { TipTapNode } from '../../shared/markdown/types.js'

const p = (text: string): TipTapNode => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const fp = (text: string): TipTapNode => ({ type: 'firstParagraph', content: [{ type: 'text', text }] })

test('a single newline separates two paragraphs (Savana format)', () => {
  const nodes = markdownBodyToContent('Première ligne.\nDeuxième ligne.\n\nTroisième.')
  assert.deepEqual(nodes, [fp('Première ligne.'), p('Deuxième ligne.'), p('Troisième.')])
})

test('a dash-opened line is dialogue prose, never a list', () => {
  const nodes = markdownBodyToContent('- Bonjour, dit-il.\n- Bonsoir, répondit-elle.')
  assert.deepEqual(nodes, [fp('- Bonjour, dit-il.'), p('- Bonsoir, répondit-elle.')])
  const md = docToMarkdownBody({ type: 'doc', content: [fp('- Bonjour, dit-il.')] })
  assert.equal(md, '- Bonjour, dit-il.\n')
})

test('trailing backslash or two spaces = hardBreak inside the same paragraph', () => {
  const expected: TipTapNode[] = [{ type: 'firstParagraph', content: [
    { type: 'text', text: 'un' }, { type: 'hardBreak' }, { type: 'text', text: 'deux' }
  ] }]
  assert.deepEqual(markdownBodyToContent('un\\\ndeux'), expected)
  assert.deepEqual(markdownBodyToContent('un  \ndeux'), expected)
  assert.equal(docToMarkdownBody({ type: 'doc', content: expected }), 'un\\\ndeux\n')
})

test('scene break and horizontal rule are distinct', () => {
  assert.deepEqual(markdownBodyToContent('a\n\n* * *\n\n---\n\nb'), [
    fp('a'), { type: 'sceneBreak' }, { type: 'horizontalRule' }, p('b')
  ])
  assert.equal(docToMarkdownBody({ type: 'doc', content: [{ type: 'sceneBreak' }, { type: 'horizontalRule' }] }), '* * *\n\n---\n')
})

test('headings read up to ###### and are capped at level 3', () => {
  assert.deepEqual(markdownBodyToContent('## Deux\n##### Cinq'), [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Deux' }] },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Cinq' }] }
  ])
  assert.equal(docToMarkdownBody({ type: 'doc', content: [{ type: 'heading', attrs: { level: 5, textAlign: 'left' }, content: [{ type: 'text', text: 'x' }] }] }), '### x\n')
})

test('paragraphs that look like block openers are escaped and read back', () => {
  const texts = ['# pas un titre', '> pas une citation', '+ pas une puce', '* pas une puce', '3. pas une liste', '```pas un code', '---']
  for (const text of texts) {
    const md = docToMarkdownBody({ type: 'doc', content: [fp(text)] })
    assert.deepEqual(markdownBodyToContent(md), [fp(text)], `round-trip failed for ${JSON.stringify(text)} via ${JSON.stringify(md)}`)
  }
})

test('chapterTitle is never written to the body; empty paragraphs are dropped', () => {
  const md = docToMarkdownBody({ type: 'doc', content: [
    { type: 'chapterTitle', content: [{ type: 'text', text: 'Titre' }] },
    { type: 'firstParagraph', content: [] },
    p('texte')
  ] })
  assert.equal(md, 'texte\n')
  assert.equal(docToMarkdownBody({ type: 'doc', content: [] }), '')
})

test('unknown block nodes fall back to their inline text', () => {
  const md = docToMarkdownBody({ type: 'doc', content: [
    { type: 'callout', attrs: { kind: 'note' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'survit' }] }] }
  ] })
  assert.equal(md, 'survit\n')
})

test('CRLF input is accepted', () => {
  assert.deepEqual(markdownBodyToContent('a\r\nb\r\n'), [fp('a'), p('b')])
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm run test:main`
Expected: plusieurs échecs (`- ` devient `\- `, `\n` simple joint les lignes, `#####` non reconnu, `---` inconnu…).

- [ ] **Step 3: Remplacer la partie blocs de `body.ts`**

Remplacer tout ce qui suit la section inline (c'est-à-dire `escapeLeading`, `serializeBlock`, `docToMarkdownBody`, `parseBlock`, `markdownBodyToContent`) par :

```ts
// --- Supported blocks ---------------------------------------------------------

export const SUPPORTED_BLOCK_TYPES: ReadonlySet<string> = new Set([
  'paragraph', 'firstParagraph', 'heading', 'sceneBreak', 'chapterTitle', 'horizontalRule',
  'bulletList', 'orderedList', 'listItem', 'blockquote', 'codeBlock', 'hardBreak', 'text'
])

// --- Block serialization ------------------------------------------------------

/**
 * Escape block openers at the very start of a paragraph. `-` is deliberately
 * NOT escaped: a leading dash is French dialogue, and the reader never treats
 * `- ` as a list (see parseBlocks).
 */
function escapeLeading(line: string): string {
  return line
    .replace(/^(\s*)([#>+])/, '$1\\$2')
    .replace(/^(\s*)(\* )/, '$1\\* ')
    .replace(/^(\s*)(\d+)\. /, '$1$2\\. ')
    .replace(/^(\s*)(```)/, '$1\\```')
    .replace(/^(\s*)(---+)$/, '$1\\$2')
}

function inlineTextOf(node: TipTapNode): string {
  if (node.type === 'text') return node.text ?? ''
  return (node.content ?? []).map(inlineTextOf).join('')
}

function quoteLines(text: string): string {
  return text.split('\n').map(l => (l ? `> ${l}` : '>')).join('\n')
}

function serializeListItem(item: TipTapNode, marker: string): string {
  const body = serializeBlocks(item.content)
  const pad = ' '.repeat(marker.length)
  return body.split('\n').map((l, i) => (i === 0 ? marker + l : l ? pad + l : '')).join('\n')
}

function serializeBlocks(nodes: TipTapNode[] | undefined): string {
  const blocks: string[] = []
  for (const node of nodes ?? []) {
    const block = serializeBlock(node)
    if (block !== null && block !== '') blocks.push(block)
  }
  return blocks.join('\n\n')
}

function serializeBlock(node: TipTapNode): string | null {
  switch (node.type) {
    case 'chapterTitle':
      return null // title lives in frontmatter, never in the body
    case 'sceneBreak':
      return '* * *'
    case 'horizontalRule':
      return '---'
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 2)))
      return `${'#'.repeat(level)} ${serializeInline(node.content)}`
    }
    case 'paragraph':
    case 'firstParagraph':
      return escapeLeading(serializeInline(node.content))
    case 'codeBlock': {
      const lang = typeof node.attrs?.language === 'string' ? node.attrs.language : ''
      return '```' + lang + '\n' + inlineTextOf(node) + '\n```'
    }
    case 'blockquote':
      return quoteLines(serializeBlocks(node.content))
    case 'bulletList':
      return (node.content ?? []).map(li => serializeListItem(li, '+ ')).join('\n')
    case 'orderedList': {
      const start = Number(node.attrs?.start ?? 1)
      return (node.content ?? []).map((li, i) => serializeListItem(li, `${start + i}. `)).join('\n')
    }
    default:
      // Anti-loss fallback for unknown nodes: keep their text readable.
      return escapeLeading(inlineTextOf(node))
  }
}

/** doc JSON → markdown body (no frontmatter, no chapter title). */
export function docToMarkdownBody(doc: TipTapDoc): string {
  const body = serializeBlocks(doc.content)
  return body ? body + '\n' : ''
}

// --- Block parsing (line based) ----------------------------------------------

const RE_SCENE = /^\* \* \*$/
const RE_HR = /^---+$/
const RE_HEADING = /^(#{1,6}) (.*)$/
const RE_FENCE_OPEN = /^```([\w+-]*)\s*$/
const RE_FENCE_CLOSE = /^```\s*$/
const RE_QUOTE = /^>( |$)/
const RE_BULLET = /^([+*]) (.*)$/
const RE_ORDERED = /^(\d+)\. (.*)$/

function isBlockStart(line: string): boolean {
  const t = line.trim()
  return RE_SCENE.test(t) || RE_HR.test(t) || RE_HEADING.test(line) || RE_FENCE_OPEN.test(line)
    || RE_QUOTE.test(line) || RE_BULLET.test(line) || RE_ORDERED.test(line)
}

function leadingSpaces(line: string): number {
  return (line.match(/^ */) as RegExpMatchArray)[0].length
}

function parseList(lines: string[], start: number): { node: TipTapNode; next: number } {
  const ordered = RE_ORDERED.test(lines[start])
  const re = ordered ? RE_ORDERED : RE_BULLET
  const items: TipTapNode[] = []
  let startNum = 1
  let i = start
  while (i < lines.length) {
    const m = lines[i].match(re)
    if (!m) break
    if (items.length === 0 && ordered) startNum = Number(m[1])
    const markerLen = lines[i].length - m[2].length
    const body: string[] = [m[2]]
    i++
    while (i < lines.length) {
      const l = lines[i]
      if (l.trim() === '') {
        const n = lines[i + 1]
        if (n !== undefined && n.trim() !== '' && leadingSpaces(n) >= markerLen) { body.push(''); i++; continue }
        if (n !== undefined && re.test(n)) { i++ } // blank between items: same list
        break
      }
      if (leadingSpaces(l) >= markerLen) { body.push(l.slice(markerLen)); i++; continue }
      break
    }
    items.push({ type: 'listItem', content: parseBlocks(body) })
  }
  const node: TipTapNode = ordered
    ? { type: 'orderedList', attrs: { start: startNum }, content: items }
    : { type: 'bulletList', content: items }
  return { node, next: i }
}

function parseBlocks(lines: string[]): TipTapNode[] {
  const out: TipTapNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const t = line.trim()
    if (t === '') { i++; continue }
    if (RE_SCENE.test(t)) { out.push({ type: 'sceneBreak' }); i++; continue }
    if (RE_HR.test(t)) { out.push({ type: 'horizontalRule' }); i++; continue }
    const h = line.match(RE_HEADING)
    if (h) {
      out.push({ type: 'heading', attrs: { level: Math.min(3, h[1].length) }, content: parseInline(h[2]) })
      i++
      continue
    }
    const f = line.match(RE_FENCE_OPEN)
    if (f) {
      const code: string[] = []
      i++
      while (i < lines.length && !RE_FENCE_CLOSE.test(lines[i])) code.push(lines[i++])
      i++ // closing fence, or past the end if unterminated
      const node: TipTapNode = { type: 'codeBlock', attrs: { language: f[1] || null } }
      if (code.length) node.content = [{ type: 'text', text: code.join('\n') }]
      out.push(node)
      continue
    }
    if (RE_QUOTE.test(line)) {
      const inner: string[] = []
      while (i < lines.length && RE_QUOTE.test(lines[i])) inner.push(lines[i++].replace(/^> ?/, ''))
      out.push({ type: 'blockquote', content: parseBlocks(inner) })
      continue
    }
    if (RE_BULLET.test(line) || RE_ORDERED.test(line)) {
      const r = parseList(lines, i)
      out.push(r.node)
      i = r.next
      continue
    }
    // Paragraph: one physical line, unless it ends with `\` or two spaces (hard break).
    const parts: TipTapNode[] = []
    let cur = line
    for (;;) {
      const hard = /(\\|  )$/.test(cur)
      let text = cur.replace(/\s+$/, '')
      if (hard && text.endsWith('\\')) text = text.slice(0, -1)
      parts.push(...parseInline(text))
      const next = lines[i + 1]
      if (hard && next !== undefined && next.trim() !== '' && !isBlockStart(next)) {
        parts.push({ type: 'hardBreak' })
        cur = next
        i++
        continue
      }
      break
    }
    out.push({ type: 'paragraph', content: parts })
    i++
  }
  return out
}

/**
 * markdown body → content nodes. Every non-blank line is a paragraph unless it
 * opens a block; the first top-level paragraph becomes `firstParagraph`.
 */
export function markdownBodyToContent(body: string): TipTapNode[] {
  const lines = body.replace(/\r\n?/g, '\n').split('\n')
  const nodes = parseBlocks(lines)
  const first = nodes.find(n => n.type === 'paragraph')
  if (first) first.type = 'firstParagraph'
  return nodes
}
```

Note : cette tâche livre déjà le code des conteneurs (listes, citation, fence) parce que `parseBlocks` et `serializeBlock` forment un tout ; la Task 5 les **teste** exhaustivement. Les tests de la Task 4 ne couvrent que les blocs simples.

- [ ] **Step 4: Vérifier le succès**

Run: `npm run test:main`
Expected: tout passe. Le test existant `round-trip preserves paragraphs, marks, scene breaks and French typography` (`markdown.chapter.test.ts`) doit toujours passer : il attend des blocs séparés par une ligne blanche, ce que le sérialiseur produit encore.

- [ ] **Step 5: Commit**

```bash
git add src/shared/markdown/body.ts src/main/__tests__/markdown.blocks.test.ts
git commit -m "feat(markdown): line-based tolerant parser (single newline = paragraph, dash = dialogue) and extended block serializer"
```

---

### Task 5: Conteneurs : listes, citations, blocs de code

**Files:**
- Test: `src/main/__tests__/markdown.containers.test.ts`
- Modify (si un test révèle un écart) : `src/shared/markdown/body.ts`

**Interfaces:**
- Consumes: `docToMarkdownBody`, `markdownBodyToContent` (Task 4).

- [ ] **Step 1: Écrire les tests**

```ts
// src/main/__tests__/markdown.containers.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { docToMarkdownBody, markdownBodyToContent } from '../../shared/markdown/body.js'
import type { TipTapNode, TipTapDoc } from '../../shared/markdown/types.js'

const p = (text: string): TipTapNode => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const fp = (text: string): TipTapNode => ({ type: 'firstParagraph', content: [{ type: 'text', text }] })
const li = (...blocks: TipTapNode[]): TipTapNode => ({ type: 'listItem', content: blocks })
const doc = (...content: TipTapNode[]): TipTapDoc => ({ type: 'doc', content })

test('bullet list writes with + and reads back; * is accepted on read', () => {
  const list: TipTapNode = { type: 'bulletList', content: [li(p('un')), li(p('deux'))] }
  assert.equal(docToMarkdownBody(doc(list)), '+ un\n+ deux\n')
  assert.deepEqual(markdownBodyToContent('+ un\n+ deux'), [list])
  assert.deepEqual(markdownBodyToContent('* un\n* deux'), [list])
})

test('ordered list keeps its start number', () => {
  const list: TipTapNode = { type: 'orderedList', attrs: { start: 3 }, content: [li(p('trois')), li(p('quatre'))] }
  assert.equal(docToMarkdownBody(doc(list)), '3. trois\n4. quatre\n')
  assert.deepEqual(markdownBodyToContent('3. trois\n4. quatre'), [list])
  assert.deepEqual(markdownBodyToContent('1. a'), [{ type: 'orderedList', attrs: { start: 1 }, content: [li(p('a'))] }])
})

test('nested lists and multi-paragraph items round-trip', () => {
  const list: TipTapNode = { type: 'bulletList', content: [
    li(p('parent'), { type: 'bulletList', content: [li(p('enfant'))] }),
    li(p('premier paragraphe'), p('second paragraphe'))
  ] }
  const md = docToMarkdownBody(doc(list))
  assert.equal(md, '+ parent\n\n  + enfant\n+ premier paragraphe\n\n  second paragraphe\n')
  assert.deepEqual(markdownBodyToContent(md), [list])
})

test('a blank line between items keeps a single list', () => {
  assert.deepEqual(markdownBodyToContent('+ a\n\n+ b'), [{ type: 'bulletList', content: [li(p('a')), li(p('b'))] }])
})

test('blockquote with nested blocks round-trips', () => {
  const quote: TipTapNode = { type: 'blockquote', content: [
    p('Citation.'),
    { type: 'bulletList', content: [li(p('point'))] },
    { type: 'blockquote', content: [p('imbriquée')] }
  ] }
  const md = docToMarkdownBody(doc(quote))
  assert.equal(md, '> Citation.\n>\n> + point\n>\n> > imbriquée\n')
  assert.deepEqual(markdownBodyToContent(md), [quote])
})

test('code block keeps language, raw content and blank lines', () => {
  const code: TipTapNode = { type: 'codeBlock', attrs: { language: 'ts' }, content: [{ type: 'text', text: 'const a = 1\n\n*pas italique* - tiret' }] }
  const md = docToMarkdownBody(doc(code))
  assert.equal(md, '```ts\nconst a = 1\n\n*pas italique* - tiret\n```\n')
  assert.deepEqual(markdownBodyToContent(md), [code])
  assert.deepEqual(markdownBodyToContent('```\n```'), [{ type: 'codeBlock', attrs: { language: null } }])
})

test('an unterminated fence swallows the rest of the body without throwing', () => {
  assert.deepEqual(markdownBodyToContent('```\nreste'), [{ type: 'codeBlock', attrs: { language: null }, content: [{ type: 'text', text: 'reste' }] }])
})

test('a list ends when a normal paragraph follows, dialogue dash included', () => {
  assert.deepEqual(markdownBodyToContent('+ a\n- Dialogue.\ntexte'), [
    { type: 'bulletList', content: [li(p('a'))] }, fp('- Dialogue.'), p('texte')
  ])
})
```

- [ ] **Step 2: Lancer les tests**

Run: `npm run test:main`
Expected: tout passe. Si un test échoue, corriger `parseList`/`serializeListItem`/`quoteLines` dans `body.ts` jusqu'à ce que la sortie attendue ci-dessus soit exactement produite (les chaînes attendues sont normatives).

- [ ] **Step 3: Commit**

```bash
git add src/main/__tests__/markdown.containers.test.ts src/shared/markdown/body.ts
git commit -m "test(markdown): lists, blockquotes and code blocks round-trip"
```

---

### Task 6: Corpus, projection et parité schéma/codec

**Files:**
- Create: `src/shared/markdown/__fixtures__/codecCorpus.ts`
- Create: `src/shared/markdown/projection.ts`
- Create: `src/shared/markdown/schemaNames.ts`
- Modify: `src/shared/markdown/index.ts`
- Test: `src/main/__tests__/markdown.corpus.test.ts`

**Interfaces:**
- Consumes: `docToMarkdownBody`, `markdownBodyToContent`, `SUPPORTED_BLOCK_TYPES`, `SUPPORTED_MARK_TYPES`, `MARK_ORDER` (Tasks 3-4) ; `stringifySidecar`, `parseSidecar` (Task 2).
- Produces:
  ```ts
  // codecCorpus.ts
  export interface CorpusEntry { name: string; doc: TipTapDoc; markdownExact: boolean }
  export const CODEC_CORPUS: CorpusEntry[]
  export const SAVANA_FORMAT_SAMPLES: Array<{ name: string; md: string; paragraphs: number }>
  // projection.ts
  export function projectMarkdown(doc: TipTapDoc): TipTapDoc
  // schemaNames.ts
  export const EDITOR_NODE_AND_MARK_NAMES: readonly string[]
  export const NON_CONTENT_SCHEMA_NAMES: ReadonlySet<string>
  export const CODEC_SUPPORTED_NAMES: ReadonlySet<string>
  ```

- [ ] **Step 1: Écrire le corpus**

```ts
// src/shared/markdown/__fixtures__/codecCorpus.ts
import type { TipTapDoc, TipTapNode } from '../types.js'

const t = (text: string, marks?: Array<{ type: string; attrs?: Record<string, unknown> }>): TipTapNode =>
  marks ? { type: 'text', text, marks } : { type: 'text', text }
const para = (align: string, ...content: TipTapNode[]): TipTapNode => ({ type: 'paragraph', attrs: { textAlign: align }, content })
const title = (text: string): TipTapNode => ({ type: 'chapterTitle', attrs: { textAlign: 'left' }, content: [t(text)] })
const doc = (...content: TipTapNode[]): TipTapDoc => ({ type: 'doc', content })

export interface CorpusEntry {
  name: string
  doc: TipTapDoc
  /** true when the .md projection loses nothing (projectMarkdown(doc) is doc minus chapterTitle/textAlign:left). */
  markdownExact: boolean
}

/** One document per node and mark the editor registers, with realistic TipTap attrs. */
export const CODEC_CORPUS: CorpusEntry[] = [
  { name: 'paragraphs and firstParagraph', markdownExact: true, doc: doc(title('Un'),
    { type: 'firstParagraph', attrs: { textAlign: 'left' }, content: [t('Il faisait nuit.')] },
    para('left', t('Deuxième paragraphe.'))) },
  // Marks are listed in canonical MARK_ORDER and separated by plain spaces (no leading space inside a mark).
  { name: 'all marks, nested', markdownExact: true, doc: doc(title('Marks'),
    para('left', t('g', [{ type: 'bold' }]), t(' '), t('i', [{ type: 'italic' }]), t(' '), t('b', [{ type: 'strike' }]), t(' '),
      t('c', [{ type: 'code' }]), t(' '), t('s', [{ type: 'underline' }]), t(' '),
      t('gi', [{ type: 'italic' }, { type: 'bold' }]), t(' '),
      t('tout', [{ type: 'highlight' }, { type: 'underline' }, { type: 'strike' }, { type: 'italic' }, { type: 'bold' }]))) },
  { name: 'highlight color is sidecar-only', markdownExact: false, doc: doc(title('Couleur'),
    para('left', t('jaune', [{ type: 'highlight', attrs: { color: '#fde047' } }]))) },
  { name: 'textAlign is sidecar-only', markdownExact: false, doc: doc(title('Align'),
    para('center', t('Épigraphe centrée.')), para('right', t('Signature.')),
    { type: 'heading', attrs: { level: 2, textAlign: 'center' }, content: [t('Titre centré')] }) },
  { name: 'headings 1-3', markdownExact: true, doc: doc(title('H'),
    { type: 'heading', attrs: { level: 1, textAlign: 'left' }, content: [t('Un')] },
    { type: 'heading', attrs: { level: 2, textAlign: 'left' }, content: [t('Deux ', [{ type: 'italic' }]), t('trois')] },
    { type: 'heading', attrs: { level: 3, textAlign: 'left' }, content: [t('Trois')] }) },
  { name: 'scene break and horizontal rule', markdownExact: true, doc: doc(title('S'),
    para('left', t('avant')), { type: 'sceneBreak' }, para('left', t('après')), { type: 'horizontalRule' }, para('left', t('fin'))) },
  { name: 'hard breaks', markdownExact: true, doc: doc(title('HB'),
    para('left', t('vers un'), { type: 'hardBreak' }, t('vers deux'), { type: 'hardBreak' }, t('vers trois'))) },
  { name: 'bullet list nested with multi-paragraph item', markdownExact: true, doc: doc(title('L'),
    { type: 'bulletList', content: [
      { type: 'listItem', content: [para('left', t('parent')), { type: 'bulletList', content: [{ type: 'listItem', content: [para('left', t('enfant'))] }] }] },
      { type: 'listItem', content: [para('left', t('premier')), para('left', t('second'))] }
    ] }) },
  { name: 'ordered list with start and type attrs', markdownExact: false, doc: doc(title('O'),
    { type: 'orderedList', attrs: { start: 4, type: null }, content: [
      { type: 'listItem', content: [para('left', t('quatre'))] },
      { type: 'listItem', content: [para('left', t('cinq'))] }
    ] }) },
  { name: 'blockquote with nested blocks', markdownExact: true, doc: doc(title('Q'),
    { type: 'blockquote', content: [para('left', t('Citation.')), { type: 'bulletList', content: [{ type: 'listItem', content: [para('left', t('point'))] }] }] }) },
  { name: 'code block with language and markdown-looking content', markdownExact: true, doc: doc(title('C'),
    { type: 'codeBlock', attrs: { language: 'ts' }, content: [t('const a = 1\n\n*x* - y')] },
    { type: 'codeBlock', attrs: { language: null }, content: [t('brut')] }) },
  { name: 'escapable characters in prose', markdownExact: true, doc: doc(title('E'),
    para('left', t('2 * 3 = 6, a_b, c\\d, `tick`, ~~non~~, ==non==, <u>non</u>, # pas titre')),
    para('left', t('+ pas puce')), para('left', t('* pas puce')), para('left', t('7. pas liste')), para('left', t('> pas citation')), para('left', t('---'))) },
  { name: 'french dialogue dashes', markdownExact: true, doc: doc(title('D'),
    para('left', t('- Bonjour, dit-il.')), para('left', t('- Bonsoir.')), para('left', t('\u2014 Cadratin aussi.'))) },
  { name: 'unknown node and unknown mark', markdownExact: false, doc: doc(title('U'),
    { type: 'callout', attrs: { kind: 'note' }, content: [para('left', t('texte du callout'))] },
    para('left', t('mot', [{ type: 'subscript' }]), t(' normal'))) },
  { name: 'empty paragraph in the middle', markdownExact: false, doc: doc(title('V'),
    para('left', t('a')), para('left'), para('left', t('b'))) },
  { name: 'heading beyond level 3', markdownExact: false, doc: doc(title('H5'),
    { type: 'heading', attrs: { level: 5, textAlign: 'left' }, content: [t('Cinq')] }) }
]

/** Synthetic samples reproducing the patterns found in Savana.palim (never the real prose). */
export const SAVANA_FORMAT_SAMPLES: Array<{ name: string; md: string; paragraphs: number }> = [
  { name: 'single newlines and dialogue dashes', paragraphs: 5, md: [
    'Au club, régnait une ambiance de ville assiégée.',
    "L'arrivée du visiteur avait ravivé la douleur.",
    '- Si la rivière t\'a oublié, c\'est qu\'elle ne t\'a jamais vu, murmura-t-elle.',
    '- Je reviendrai, répondit-il en baissant les yeux.',
    'Dehors, les hommes fumaient.'
  ].join('\n') + '\n' },
  { name: 'pasted notes with deep headings and numbered items', paragraphs: 2, md: [
    'Texte du chapitre.',
    '##### 4. Sa contribution',
    '2. Ce qui est à nuancer',
    '3. Ce que tu peux en tirer',
    'Suite du chapitre.'
  ].join('\n') + '\n' },
  { name: 'two trailing spaces glue lines', paragraphs: 1, md: 'Première ligne  \nsuite de la même strophe.\n' }
]
```

- [ ] **Step 2: Écrire la projection**

```ts
// src/shared/markdown/projection.ts
import type { TipTapDoc, TipTapNode } from './types.js'
import { MARK_ORDER, SUPPORTED_BLOCK_TYPES, SUPPORTED_MARK_TYPES } from './body.js'

/**
 * What the Markdown projection keeps of a document. This is the oracle of the
 * codec property test: markdownBodyToContent(docToMarkdownBody(doc)) must equal
 * projectMarkdown(doc).content. Every deliberate loss of the .md is encoded here
 * (the sidecar keeps the exact document).
 */
export function projectMarkdown(doc: TipTapDoc): TipTapDoc {
  const content = projectBlocks(doc.content ?? [], true)
  const first = content.find(n => n.type === 'paragraph')
  if (first) first.type = 'firstParagraph'
  return { type: 'doc', content }
}

function inlineTextOf(node: TipTapNode): string {
  if (node.type === 'text') return node.text ?? ''
  return (node.content ?? []).map(inlineTextOf).join('')
}

function projectInline(nodes: TipTapNode[] | undefined): TipTapNode[] {
  const out: TipTapNode[] = []
  for (const n of nodes ?? []) {
    if (n.type === 'hardBreak') { out.push({ type: 'hardBreak' }); continue }
    if (n.type !== 'text' || !n.text) continue
    const marks = [...new Set((n.marks ?? []).map(m => m.type))]
      .filter(t => SUPPORTED_MARK_TYPES.has(t))
      .sort((a, b) => MARK_ORDER.indexOf(a) - MARK_ORDER.indexOf(b))
    const node: TipTapNode = { type: 'text', text: n.text }
    if (marks.length) node.marks = marks.map(type => ({ type }))
    const prev = out[out.length - 1]
    if (prev && prev.type === 'text' && sameMarks(prev, node)) prev.text = (prev.text ?? '') + n.text
    else out.push(node)
  }
  return out
}

function sameMarks(a: TipTapNode, b: TipTapNode): boolean {
  return JSON.stringify(a.marks ?? []) === JSON.stringify(b.marks ?? [])
}

function projectBlocks(nodes: TipTapNode[], topLevel: boolean): TipTapNode[] {
  const out: TipTapNode[] = []
  for (const n of nodes) {
    switch (n.type) {
      case 'chapterTitle':
        break
      case 'paragraph':
      case 'firstParagraph': {
        const content = projectInline(n.content)
        if (content.length) out.push({ type: 'paragraph', content })
        break
      }
      case 'heading': {
        const level = Math.min(3, Math.max(1, Number(n.attrs?.level ?? 2)))
        out.push({ type: 'heading', attrs: { level }, content: projectInline(n.content) })
        break
      }
      case 'sceneBreak':
      case 'horizontalRule':
        out.push({ type: n.type })
        break
      case 'codeBlock': {
        const language = typeof n.attrs?.language === 'string' && n.attrs.language ? n.attrs.language : null
        const text = inlineTextOf(n)
        const node: TipTapNode = { type: 'codeBlock', attrs: { language } }
        if (text) node.content = [{ type: 'text', text }]
        out.push(node)
        break
      }
      case 'blockquote':
        out.push({ type: 'blockquote', content: projectBlocks(n.content ?? [], false) })
        break
      case 'bulletList':
        out.push({ type: 'bulletList', content: (n.content ?? []).map(li => ({ type: 'listItem', content: projectBlocks(li.content ?? [], false) })) })
        break
      case 'orderedList':
        out.push({ type: 'orderedList', attrs: { start: Number(n.attrs?.start ?? 1) }, content: (n.content ?? []).map(li => ({ type: 'listItem', content: projectBlocks(li.content ?? [], false) })) })
        break
      default: {
        // Unknown block → its text as one paragraph (serializer fallback)
        const text = inlineTextOf(n)
        if (text) out.push({ type: 'paragraph', content: [{ type: 'text', text }] })
      }
    }
  }
  void topLevel
  void SUPPORTED_BLOCK_TYPES
  return out
}
```

- [ ] **Step 3: Écrire les noms de schéma**

```ts
// src/shared/markdown/schemaNames.ts
import { SUPPORTED_BLOCK_TYPES, SUPPORTED_MARK_TYPES } from './body.js'

/**
 * Every content-bearing node and mark the editor registers (EditorArea.tsx:
 * StarterKit + Underline + Highlight + SceneBreak + ChapterTitle + FirstParagraph).
 * Adding an extension there without extending the codec must fail the parity test.
 */
export const EDITOR_NODE_AND_MARK_NAMES: readonly string[] = [
  // StarterKit nodes
  'paragraph', 'text', 'heading', 'hardBreak', 'horizontalRule', 'blockquote', 'codeBlock',
  'bulletList', 'orderedList', 'listItem',
  // StarterKit marks
  'bold', 'italic', 'strike', 'code',
  // project extensions
  'underline', 'highlight', 'sceneBreak', 'chapterTitle', 'firstParagraph'
]

/** Schema entries that carry no content and are legitimately outside the codec. */
export const NON_CONTENT_SCHEMA_NAMES: ReadonlySet<string> = new Set(['doc'])

export const CODEC_SUPPORTED_NAMES: ReadonlySet<string> = new Set([
  ...SUPPORTED_BLOCK_TYPES, ...SUPPORTED_MARK_TYPES
])
```

Ajouter à `src/shared/markdown/index.ts` :
```ts
export * from './projection.js'
export * from './schemaNames.js'
```

- [ ] **Step 4: Écrire les tests de propriété**

```ts
// src/main/__tests__/markdown.corpus.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { docToMarkdownBody, markdownBodyToContent } from '../../shared/markdown/body.js'
import { projectMarkdown } from '../../shared/markdown/projection.js'
import { stringifySidecar, parseSidecar } from '../../shared/markdown/sidecar.js'
import { EDITOR_NODE_AND_MARK_NAMES, CODEC_SUPPORTED_NAMES } from '../../shared/markdown/schemaNames.js'
import { CODEC_CORPUS, SAVANA_FORMAT_SAMPLES } from '../../shared/markdown/__fixtures__/codecCorpus.js'
import type { TipTapDoc } from '../../shared/markdown/types.js'

for (const entry of CODEC_CORPUS) {
  test(`sidecar round-trip is exact: ${entry.name}`, () => {
    const text = stringifySidecar({ version: 1, mdHash: 'h', savedAt: 's', doc: entry.doc })
    const r = parseSidecar(text)
    assert.ok(r.ok)
    if (r.ok) assert.deepEqual(r.sidecar.doc, entry.doc)
  })

  test(`markdown round-trip equals the documented projection: ${entry.name}`, () => {
    const md = docToMarkdownBody(entry.doc)
    const reparsed = markdownBodyToContent(md)
    assert.deepEqual(reparsed, projectMarkdown(entry.doc).content, `via:\n${md}`)
  })

  test(`markdown is stable after one round-trip: ${entry.name}`, () => {
    const md1 = docToMarkdownBody(entry.doc)
    const md2 = docToMarkdownBody({ type: 'doc', content: markdownBodyToContent(md1) })
    assert.equal(md2, md1)
  })

  if (entry.markdownExact) {
    test(`markdown loses nothing but chapterTitle/textAlign:left: ${entry.name}`, () => {
      const stripped = stripDefaults(entry.doc)
      assert.deepEqual(projectMarkdown(entry.doc), stripped)
    })
  }
}

/** Removes chapterTitle and textAlign:'left' (the two lossless normalisations). */
function stripDefaults(doc: TipTapDoc): TipTapDoc {
  const walk = (nodes: TipTapDoc['content']): TipTapDoc['content'] => nodes
    .filter(n => n.type !== 'chapterTitle')
    .map(n => {
      const copy = { ...n }
      if (copy.attrs && 'textAlign' in copy.attrs) {
        const { textAlign, ...rest } = copy.attrs
        void textAlign
        if (Object.keys(rest).length) copy.attrs = rest
        else delete copy.attrs
      }
      if (copy.type === 'firstParagraph') copy.type = 'paragraph'
      if (copy.content) copy.content = walk(copy.content)
      return copy
    })
  const content = walk(doc.content)
  const first = content.find(n => n.type === 'paragraph')
  if (first) first.type = 'firstParagraph'
  return { type: 'doc', content }
}

test('every editor node and mark is known to the codec (schema parity)', () => {
  const missing = EDITOR_NODE_AND_MARK_NAMES.filter(n => !CODEC_SUPPORTED_NAMES.has(n))
  assert.deepEqual(missing, [], `extend body.ts for: ${missing.join(', ')}`)
})

for (const sample of SAVANA_FORMAT_SAMPLES) {
  test(`Savana format: ${sample.name}`, () => {
    const once = markdownBodyToContent(sample.md)
    const paragraphs = once.filter(n => n.type === 'paragraph' || n.type === 'firstParagraph')
    assert.equal(paragraphs.length, sample.paragraphs)
    assert.ok(!once.some(n => n.type === 'bulletList'), 'no dialogue became a bullet list')
    const twice = markdownBodyToContent(docToMarkdownBody({ type: 'doc', content: once }))
    assert.deepEqual(twice, once)
  })
}
```

- [ ] **Step 5: Lancer et corriger**

Run: `npm run test:main`
Expected: tout passe. Points d'attention si un cas échoue :
- `markdownExact` mal évalué pour une entrée : c'est la fixture qu'il faut corriger, pas la projection, sauf si la projection contredit la spec §4.
- Le test « stable après un round-trip » échoue si le sérialiseur n'est pas idempotent sur sa propre sortie (par exemple un échappement oublié) : corriger `body.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/shared/markdown/__fixtures__/codecCorpus.ts src/shared/markdown/projection.ts src/shared/markdown/schemaNames.ts src/shared/markdown/index.ts src/main/__tests__/markdown.corpus.test.ts
git commit -m "test(markdown): full node/mark corpus, documented projection oracle, schema parity and Savana-format samples"
```

---

### Task 7: `parseChapter(refId)` et décision de chargement

**Files:**
- Modify: `src/shared/markdown/chapter.ts`
- Create: `src/shared/markdown/load.ts`
- Modify: `src/shared/markdown/index.ts`
- Test: `src/main/__tests__/markdown.load.test.ts`, `src/main/__tests__/markdown.chapter.test.ts` (ajout)

**Interfaces:**
- Consumes: `parseSidecar` (Task 2), `sha256Hex` (Task 1), `parseChapter`.
- Produces:
  ```ts
  // chapter.ts
  export function parseChapter(md: string, fallbackTitle: string, refId?: string): ParsedChapter
  // load.ts
  export type ChapterLoadState = 'exact' | 'fromMarkdown' | 'unreadable'
  export type FallbackReason = 'no-sidecar' | 'hash-mismatch' | 'corrupt' | 'unknown-version' | 'invalid-doc'
  export interface ResolveInput { md: string | null; sidecarText: string | null; refId: string; fallbackTitle: string }
  export interface ResolvedChapter { loadState: ChapterLoadState; frontmatter: ChapterFrontmatter | null; doc: TipTapDoc | null; reason?: FallbackReason }
  export function resolveChapterDoc(input: ResolveInput): Promise<ResolvedChapter>
  ```

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `src/main/__tests__/markdown.chapter.test.ts` :
```ts
test('parseChapter: the manifest id wins over a divergent or missing frontmatter id', () => {
  const a = parseChapter('---\nid: ancien\ntitle: T\n---\nTexte.\n', 'f', 'ref-1')
  assert.equal(a.frontmatter.id, 'ref-1')
  const b = parseChapter('Texte sans frontmatter.', 'f', 'ref-2')
  assert.equal(b.frontmatter.id, 'ref-2')
  const c = parseChapter('---\nid: garde\ntitle: T\n---\nx\n', 'f')
  assert.equal(c.frontmatter.id, 'garde')
})
```

Nouveau fichier :
```ts
// src/main/__tests__/markdown.load.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveChapterDoc } from '../../shared/markdown/load.js'
import { stringifySidecar } from '../../shared/markdown/sidecar.js'
import { sha256Hex } from '../../shared/markdown/hash.js'

const md = '---\nid: ref\ntitle: Le Départ\nstatus: revision\n---\nIl faisait nuit.\n'
const exactDoc = { type: 'doc' as const, content: [
  { type: 'chapterTitle', attrs: { textAlign: 'left' }, content: [{ type: 'text', text: 'Le Départ' }] },
  { type: 'firstParagraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Il faisait nuit.' }] }
] }

async function sidecarFor(text: string, doc = exactDoc, version = 1) {
  return stringifySidecar({ version: version as 1, mdHash: await sha256Hex(text), savedAt: 's', doc })
}

test('unreadable when the .md cannot be read, whatever the sidecar says', async () => {
  const r = await resolveChapterDoc({ md: null, sidecarText: await sidecarFor(md), refId: 'ref', fallbackTitle: '001-le-depart' })
  assert.equal(r.loadState, 'unreadable')
  assert.equal(r.doc, null)
  assert.equal(r.frontmatter, null)
})

test('exact when the sidecar hash matches: doc from sidecar, frontmatter from md', async () => {
  const r = await resolveChapterDoc({ md, sidecarText: await sidecarFor(md), refId: 'ref', fallbackTitle: 'f' })
  assert.equal(r.loadState, 'exact')
  assert.deepEqual(r.doc, exactDoc)
  assert.equal(r.frontmatter?.title, 'Le Départ')
  assert.equal(r.frontmatter?.status, 'revision')
})

test('fromMarkdown with reason when the sidecar is absent, stale, corrupt or of unknown version', async () => {
  const none = await resolveChapterDoc({ md, sidecarText: null, refId: 'ref', fallbackTitle: 'f' })
  assert.equal(none.loadState, 'fromMarkdown'); assert.equal(none.reason, 'no-sidecar')
  assert.equal(none.doc?.content[1].type, 'firstParagraph')
  assert.equal(none.doc?.content[1].attrs, undefined)  // textAlign not expressible in md

  const stale = await resolveChapterDoc({ md: md + 'Ajout externe.\n', sidecarText: await sidecarFor(md), refId: 'ref', fallbackTitle: 'f' })
  assert.equal(stale.loadState, 'fromMarkdown'); assert.equal(stale.reason, 'hash-mismatch')
  assert.equal(stale.doc?.content.length, 3)

  const corrupt = await resolveChapterDoc({ md, sidecarText: '{ nope', refId: 'ref', fallbackTitle: 'f' })
  assert.equal(corrupt.reason, 'corrupt')

  const future = await resolveChapterDoc({ md, sidecarText: await sidecarFor(md, exactDoc, 2), refId: 'ref', fallbackTitle: 'f' })
  assert.equal(future.reason, 'unknown-version')
})

test('the manifest id always wins', async () => {
  const r = await resolveChapterDoc({ md: '---\nid: autre\ntitle: T\n---\nx\n', sidecarText: null, refId: 'ref', fallbackTitle: 'f' })
  assert.equal(r.frontmatter?.id, 'ref')
})

test('an empty .md is a readable, empty chapter', async () => {
  const r = await resolveChapterDoc({ md: '', sidecarText: null, refId: 'ref', fallbackTitle: '003-le-seuil' })
  assert.equal(r.loadState, 'fromMarkdown')
  assert.equal(r.frontmatter?.title, '003-le-seuil')
  assert.equal(r.doc?.content.length, 2) // chapterTitle + empty firstParagraph
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm run test:main`
Expected: `load.js` introuvable ; le test `refId` de `chapter.test.ts` échoue (`ancien` au lieu de `ref-1`).

- [ ] **Step 3: Implémenter**

Dans `src/shared/markdown/chapter.ts`, remplacer la signature et la ligne `id:` :
```ts
/** chapter .md text → { frontmatter, doc }. When `refId` (manifest id) is given it always wins. */
export function parseChapter(md: string, fallbackTitle: string, refId?: string): ParsedChapter {
  const { data, body } = parseFrontmatter(md)
  const title = typeof data.title === 'string' && data.title.trim() ? data.title : fallbackTitle
  const frontmatter: ChapterFrontmatter = {
    id: refId ?? (typeof data.id === 'string' && data.id ? data.id : genId()),
    title
  }
  // ... reste inchangé
```

Nouveau `src/shared/markdown/load.ts` :
```ts
import type { ChapterFrontmatter, TipTapDoc } from './types.js'
import { parseChapter } from './chapter.js'
import { parseSidecar } from './sidecar.js'
import { sha256Hex } from './hash.js'

export type ChapterLoadState = 'exact' | 'fromMarkdown' | 'unreadable'
export type FallbackReason = 'no-sidecar' | 'hash-mismatch' | 'corrupt' | 'unknown-version' | 'invalid-doc'

export interface ResolveInput {
  md: string | null          // null = the .md could not be read
  sidecarText: string | null // null = no sidecar file
  refId: string              // manifest id, always wins
  fallbackTitle: string
}

export interface ResolvedChapter {
  loadState: ChapterLoadState
  frontmatter: ChapterFrontmatter | null
  doc: TipTapDoc | null
  reason?: FallbackReason
}

/**
 * Decide where a chapter's document comes from. Pure: the caller does the I/O.
 * - md unreadable → 'unreadable' (never drop, never rewrite)
 * - sidecar valid and hash matches the .md → 'exact' (doc from sidecar)
 * - otherwise → 'fromMarkdown' (extended codec), with the reason
 */
export async function resolveChapterDoc(input: ResolveInput): Promise<ResolvedChapter> {
  if (input.md === null) return { loadState: 'unreadable', frontmatter: null, doc: null }
  const parsed = parseChapter(input.md, input.fallbackTitle, input.refId)
  if (input.sidecarText === null) return { loadState: 'fromMarkdown', ...parsed, reason: 'no-sidecar' }
  const sc = parseSidecar(input.sidecarText)
  if (!sc.ok) return { loadState: 'fromMarkdown', ...parsed, reason: sc.reason }
  if (sc.sidecar.mdHash !== await sha256Hex(input.md)) {
    return { loadState: 'fromMarkdown', ...parsed, reason: 'hash-mismatch' }
  }
  return { loadState: 'exact', frontmatter: parsed.frontmatter, doc: sc.sidecar.doc }
}
```

Ajouter à `index.ts` : `export * from './load.js'`.

- [ ] **Step 4: Vérifier le succès**

Run: `npm run test:main`
Expected: tout passe.

- [ ] **Step 5: Commit**

```bash
git add src/shared/markdown/chapter.ts src/shared/markdown/load.ts src/shared/markdown/index.ts src/main/__tests__/markdown.load.test.ts src/main/__tests__/markdown.chapter.test.ts
git commit -m "feat(markdown): resolveChapterDoc (sidecar vs markdown vs unreadable) and manifest-id precedence"
```

---

### Task 8: Chargement dans `projectStore` avec état `loadState`

**Files:**
- Modify: `src/shared/types/project.ts:27-37` (`ManuscriptItem`)
- Modify: `src/renderer/stores/projectStore.ts:16` (imports), `:332-372` (`loadManuscriptFromDisk`)

**Interfaces:**
- Consumes: `resolveChapterDoc`, `sidecarPath` de `@shared/markdown` ; `useStatsStore.getState().showNotification(type, message)`.
- Produces: `ManuscriptItem.loadState?: 'exact' | 'fromMarkdown' | 'unreadable'` ; `LoadedManuscript` inchangé pour les appelants (les 3 sites d'appel `:483`, `:1059`, `:1337` n'ont pas à changer).

- [ ] **Step 1: Étendre le type**

Dans `src/shared/types/project.ts`, dans `ManuscriptItem` après `wordCount: number` :
```ts
  /** Where the document came from at load time (not persisted). 'unreadable' = never rewrite, never delete. */
  loadState?: 'exact' | 'fromMarkdown' | 'unreadable'
```

- [ ] **Step 2: Réécrire `loadManuscriptFromDisk`**

Mettre à jour l'import ligne 16 :
```ts
import {
  parseChapter, serializeChapter, planChapterFiles, orphanFiles, resolveChapterDoc, sidecarPath,
  stringifySidecar, sha256Hex, SIDECAR_DIR, type ChapterRef
} from '@shared/markdown'
```
(`parseChapter` reste importé tant que d'autres usages existent ; retirer l'import s'il devient inutilisé, `noUnusedLocals` est actif.)

Remplacer la fonction :
```ts
// Read the manifest's chapter list + each chapitres/*.md (and its sidecar) into the in-memory model.
// Never drops a chapter: an unreadable file yields an 'unreadable' item that is never rewritten.
const loadManuscriptFromDisk = async (
  projectPath: string,
  chapterRefs: ChapterRef[]
): Promise<LoadedManuscript> => {
  const items: ManuscriptItem[] = []
  const documentContents: Record<string, string> = {}
  let recoveredFromMarkdown = 0
  let unreadable = 0

  for (const ref of chapterRefs) {
    const fallbackTitle = ref.file.replace(/^chapitres\//, '').replace(/\.md$/, '')
    const fileResult = await window.electronAPI.readFile(`${projectPath}/${ref.file}`)
    const sidecarResult = await window.electronAPI.readFile(`${projectPath}/${sidecarPath(ref.id)}`)
    const resolved = await resolveChapterDoc({
      md: fileResult.success && typeof fileResult.content === 'string' ? fileResult.content : null,
      sidecarText: sidecarResult.success && typeof sidecarResult.content === 'string' ? sidecarResult.content : null,
      refId: ref.id,
      fallbackTitle
    })

    if (resolved.loadState === 'unreadable' || !resolved.frontmatter || !resolved.doc) {
      console.error(`[projet] chapitre illisible: ${ref.file}`, fileResult.error)
      items.push({ id: ref.id, type: 'chapter', title: fallbackTitle, status: 'draft', wordCount: 0, children: [], loadState: 'unreadable' })
      unreadable += 1
      continue
    }

    if (resolved.loadState === 'fromMarkdown') {
      console.info(`[projet] ${ref.file} chargé depuis le Markdown (${resolved.reason})`)
      if (resolved.reason !== 'no-sidecar') recoveredFromMarkdown += 1
    }

    const { frontmatter, doc } = resolved
    items.push({
      id: ref.id,
      type: 'chapter',
      title: frontmatter.title,
      status: frontmatter.status ?? 'draft',
      synopsis: frontmatter.synopsis,
      pov: frontmatter.pov,
      wordCount: 0,            // recomputed by the editor/stats, never persisted
      children: [],
      loadState: resolved.loadState
    })
    documentContents[ref.id] = JSON.stringify(doc)
  }

  const notify = useStatsStore.getState().showNotification
  if (unreadable > 0) notify('error', `${unreadable} chapitre(s) illisible(s) : voir la table des matières`)
  if (recoveredFromMarkdown > 0) notify('info', `${recoveredFromMarkdown} chapitre(s) rechargé(s) depuis le Markdown`)

  return { items, documentContents, chapterRefs }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 0 erreur. Si `parseChapter` n'est plus utilisé nulle part dans le store, retirer son import.

- [ ] **Step 4: Vérifier manuellement (projet jetable)**

Créer un projet de test dans l'app (`npm run launch:dev`, Nouveau projet → `/tmp/Test-0a.palim`), taper deux paragraphes, quitter. Puis :
```bash
cp -R ~/Desktop/Savana.palim /tmp/Savana-test.palim
```
Ouvrir `/tmp/Savana-test.palim` dans l'app (jamais l'original) : les chapitres montrent leurs paragraphes séparés (20 pour le 5e chapitre, pas 1), les dialogues `- ` restent des paragraphes, aucune notification « rechargé » (pas de sidecar = normal). **Ne pas taper dans Savana-test avant la Task 9** (la sauvegarde n'écrit pas encore les sidecars ; le `.md` serait canonisé mais sans perte, ce qui est acceptable sur la copie).

- [ ] **Step 5: Commit**

```bash
git add src/shared/types/project.ts src/renderer/stores/projectStore.ts
git commit -m "feat(project): load chapters via sidecar-or-markdown resolution, keep unreadable chapters instead of dropping them"
```

---

### Task 9: Sauvegarde avec sidecar, chapitres illisibles protégés

**Files:**
- Modify: `src/renderer/stores/projectStore.ts` : boucle chapitres de `saveProject` (`:1180-1212` environ), création de projet (`:900-930`), suppression des orphelins.

**Interfaces:**
- Consumes: `stringifySidecar`, `sha256Hex`, `sidecarPath`, `SIDECAR_DIR` (Tasks 1-2), `ensureCreateDirectory`, `ensureWriteFile`.

- [ ] **Step 1: Sauvegarde des chapitres**

Dans `saveProject`, remplacer le bloc `for (const item of items) { … }` et la boucle des orphelins par :
```ts
      await ensureCreateDirectory(`${projectPath}/${SIDECAR_DIR}`)
      for (const item of items) {
        const file = refById.get(item.id)
        if (!file) continue
        // An unreadable chapter is never serialized: we do not hold its content.
        if (item.loadState === 'unreadable') continue
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
        // .md first, then the sidecar: an interruption in between leaves a stale hash,
        // so the next load falls back to the fresh .md rather than an old doc.
        await ensureWriteFile(`${projectPath}/${file}`, md)
        await ensureWriteFile(
          `${projectPath}/${sidecarPath(item.id)}`,
          stringifySidecar({ version: 1, mdHash: await sha256Hex(md), savedAt: new Date().toISOString(), doc })
        )
      }

      // Delete .md files and sidecars for removed chapters (journal-aware).
      const keptIds = new Set(newRefs.map(r => r.id))
      for (const orphan of orphanFiles(get().chapterRefs, newRefs)) {
        await window.electronAPI.deleteFile(`${projectPath}/${orphan}`)
      }
      for (const ref of get().chapterRefs) {
        if (!keptIds.has(ref.id)) await window.electronAPI.deleteFile(`${projectPath}/${sidecarPath(ref.id)}`)
      }
```

- [ ] **Step 2: Création de projet**

Dans `createProject` (bloc `// Initial chapter → one .md + manifest entry`), après `await ensureCreateDirectory(`${projectPath}/chapitres`)` ajouter :
```ts
      await ensureCreateDirectory(`${projectPath}/${SIDECAR_DIR}`)
```
et dans la boucle `for (const ref of initialRefs)`, après `await ensureWriteFile(`${projectPath}/${ref.file}`, md)` :
```ts
        await ensureWriteFile(
          `${projectPath}/${sidecarPath(ref.id)}`,
          stringifySidecar({ version: 1, mdHash: await sha256Hex(md), savedAt: new Date().toISOString(), doc: initialDoc })
        )
```
en extrayant le document initial dans une constante `initialDoc: TipTapDoc` déclarée juste avant l'appel à `serializeChapter` (c'est l'objet `{ type: 'doc', content: [...] }` déjà présent inline).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 0 erreur.

- [ ] **Step 4: Vérification manuelle**

`npm run launch:dev`, ouvrir `/tmp/Savana-test.palim` (la copie), taper un mot dans un chapitre, attendre l'autosave (ou ⌘S). Vérifier :
```bash
ls /tmp/Savana-test.palim/chapitres/.palim | wc -l          # 103
python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d['version'], len(d['mdHash']), d['doc']['type'])" /tmp/Savana-test.palim/chapitres/.palim/$(ls /tmp/Savana-test.palim/chapitres/.palim | head -1)   # 1 64 doc
awk 'BEGIN{fm=0} /^---$/{fm++; next} fm>=2 && NF' /tmp/Savana-test.palim/chapitres/005-*.md | wc -l   # 20 paragraphes conservés
grep -c '^- ' /tmp/Savana-test.palim/chapitres/*.md | awk -F: '{s+=$2} END{print s}'   # 324 : les tirets de dialogue sont intacts
```
Fermer et rouvrir : aucune notification « rechargé depuis le Markdown » (les hash correspondent). Modifier un `.md` à la main dans la copie, rouvrir : notification « 1 chapitre rechargé depuis le Markdown » et le texte modifié est visible.

Simuler un fichier illisible : `chmod 000 /tmp/Savana-test.palim/chapitres/010-*.md`, rouvrir : notification d'erreur, le chapitre 10 est listé, l'app ne plante pas. Taper dans un autre chapitre, sauvegarder : `chmod 644` puis vérifier que le fichier 10 est **intact** et toujours référencé dans `project.json`.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/stores/projectStore.ts
git commit -m "feat(project): write per-chapter sidecars on save, never rewrite unreadable chapters, delete sidecars with their chapter"
```

---

### Task 10: Garde de parité dans l'éditeur, lecture seule et marqueur « illisible »

**Files:**
- Modify: `src/renderer/components/editor/EditorArea.tsx` (imports, après `useEditor`, rendu final `:353-365`)
- Modify: `src/renderer/components/layout/Sidebar.tsx` (imports lucide `:7-28`, `TreeItem` `:227-231` et `:278-284`)

**Interfaces:**
- Consumes: `CODEC_SUPPORTED_NAMES`, `NON_CONTENT_SCHEMA_NAMES` de `@shared/markdown` ; `ManuscriptItem.loadState` (Task 8) ; `useProjectStore().chapterRefs`.

- [ ] **Step 1: Garde runtime et lecture seule dans `EditorArea.tsx`**

Ajouter l'import :
```ts
import { CODEC_SUPPORTED_NAMES, NON_CONTENT_SCHEMA_NAMES } from '@shared/markdown'
```
Après la déclaration de `editor` (`useEditor({...})`), ajouter :
```ts
  // Schema/codec parity guard: any node or mark the editor knows but the codec does not
  // would be lost in the .md projection. The sidecar keeps it, but we want to know.
  useEffect(() => {
    if (!editor) return
    const names = [...Object.keys(editor.schema.nodes), ...Object.keys(editor.schema.marks)]
    const unknown = names.filter(n => !CODEC_SUPPORTED_NAMES.has(n) && !NON_CONTENT_SCHEMA_NAMES.has(n))
    if (unknown.length > 0) {
      console.error(`[codec] nœuds/marks du schéma inconnus du codec Markdown : ${unknown.join(', ')}`)
      if (import.meta.env.DEV) {
        useStatsStore.getState().showNotification('error', `Codec incomplet : ${unknown.join(', ')}`)
      }
    }
  }, [editor])

  // An unreadable chapter is shown empty and read-only: we never overwrite a file we could not read.
  const isUnreadable = activeItem?.loadState === 'unreadable'
  useEffect(() => {
    if (!editor) return
    editor.setEditable(!isUnreadable)
  }, [editor, isUnreadable])
```
`activeItem` est déjà calculé plus bas (`:316`) : déplacer sa déclaration (`const activeItem = project ? findManuscriptItem(...) : null`) au-dessus de ces effets. Importer `useStatsStore` si ce n'est pas déjà fait (`import { useStatsStore } from '@/stores/statsStore'`).

Dans le rendu final, remplacer :
```tsx
  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <PagedEditor />
    </div>
  )
```
par :
```tsx
  const unreadableFile = isUnreadable
    ? useProjectStore.getState().chapterRefs.find(r => r.id === activeDocumentId)?.file
    : undefined

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {isUnreadable && (
        <div role="alert" className="px-4 py-2 text-sm bg-destructive/10 text-destructive border-b border-destructive/30">
          Fichier illisible : {unreadableFile ?? 'chapitre inconnu'}. Le chapitre est affiché vide et en lecture seule ; son fichier ne sera ni réécrit ni supprimé.
        </div>
      )}
      <PagedEditor />
    </div>
  )
```

- [ ] **Step 2: Marqueur dans la TDM (`Sidebar.tsx`)**

Ajouter `AlertTriangle` à l'import lucide. Dans `TreeItem`, remplacer :
```tsx
            {!isRenaming && (
              <>
                {statusIcons[item.status]}
                <span className="text-xs text-muted-foreground">{item.wordCount}</span>
              </>
            )}
```
par :
```tsx
            {!isRenaming && item.loadState === 'unreadable' && (
              <AlertTriangle size={12} className="text-destructive shrink-0" aria-label="Fichier illisible" />
            )}
            {!isRenaming && item.loadState !== 'unreadable' && (
              <>
                {statusIcons[item.status]}
                <span className="text-xs text-muted-foreground">{item.wordCount}</span>
              </>
            )}
```

- [ ] **Step 3: Typecheck et lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/renderer/components/editor/EditorArea.tsx src/renderer/components/layout/Sidebar.tsx`
Expected: 0 erreur, 0 nouveau warning (`exhaustive-deps` : les deux effets listent leurs dépendances).

- [ ] **Step 4: Vérification manuelle**

`npm run launch:dev`, ouvrir `/tmp/Test-0a.palim`. Console DevTools : **aucune** ligne `[codec]`. Si une ligne apparaît (par exemple un nœud enregistré par `tiptap-pagination-plus`) : si le nom porte du contenu d'auteur → l'ajouter à `EDITOR_NODE_AND_MARK_NAMES` et étendre le codec (le test de parité échouera, c'est voulu) ; sinon → l'ajouter à `NON_CONTENT_SCHEMA_NAMES` avec un commentaire disant d'où il vient.
Rejouer le scénario `chmod 000` de la Task 9 : triangle rouge dans la TDM, bandeau au-dessus de l'éditeur, frappe impossible.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/editor/EditorArea.tsx src/renderer/components/layout/Sidebar.tsx src/shared/markdown/schemaNames.ts
git commit -m "feat(editor): schema/codec parity guard, read-only banner and TOC marker for unreadable chapters"
```

---

### Task 11: Documentation et vérification finale

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/pagination-lessons.md` (aucune modification attendue : vérifier seulement qu'il n'est pas touché)

- [ ] **Step 1: Documenter le format dans `CLAUDE.md`**

Ajouter après la section `## Structure` :
```markdown
## Format projet `.palim`

- `project.json` : meta + `chapters: [{ id, file }]` (ordre et identité des chapitres ; l'`id` du manifeste fait foi sur celui du frontmatter).
- `chapitres/NNN-slug.md` : Markdown étendu, projection lisible (agents, grep, diffs). Personne ne l'édite à la main.
- `chapitres/.palim/<id>.json` : sidecar `{ version, mdHash, savedAt, doc }` = document TipTap exact, **fait foi** si `mdHash` = SHA-256 du `.md`. Sinon on parse le `.md` (projets anciens, fichier modifié par un tiers) et l'app le signale.
- Dialecte Markdown (`src/shared/markdown/body.ts`) : `\n` simple = nouveau paragraphe ; `- ` en début de ligne = dialogue (jamais une liste) ; puces `+ ` ; `* * *` = pause de scène ; `---` = règle ; `\` fin de ligne = retour forcé ; marks `**` `*` `~~` `` ` `` `<u>` `==`. `textAlign` et la couleur de surlignage ne vivent que dans le sidecar.
- Un chapitre dont le fichier est illisible reste listé (`loadState: 'unreadable'`), affiché vide et en lecture seule, jamais réécrit ni supprimé.
- Invariant testé : tout nœud/mark enregistré dans l'éditeur (`schemaNames.ts`) est connu du codec ; `parse(serialize(doc))` égale `projectMarkdown(doc)` sur le corpus `__fixtures__/codecCorpus.ts`.
```

- [ ] **Step 2: Suite complète**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:/opt/homebrew/bin:$PATH"
npm run test:main && npx tsc --noEmit -p tsconfig.json && npx eslint src --max-warnings=6
```
Expected: tous les tests passent (≥ 190 : 130 existants + nouveaux), 0 erreur TypeScript, pas de nouvelle erreur ESLint (les 4 erreurs et 2 warnings préexistants de l'audit sont hors périmètre ; `--max-warnings=6` tolère exactement l'existant, ajuster si le compte diffère mais ne jamais augmenter).

- [ ] **Step 3: Vérification de bout en bout sur la copie de Savana**

```bash
rm -rf /tmp/Savana-test.palim && cp -R ~/Desktop/Savana.palim /tmp/Savana-test.palim
```
Dans l'app : ouvrir la copie, ouvrir le chapitre 5, compter visuellement les paragraphes (20), taper un mot, ⌘S, fermer l'app, rouvrir la copie : même texte, même nombre de paragraphes, dialogues intacts, 103 sidecars présents, aucune notification. Comparer la copie et l'original :
```bash
diff <(cd ~/Desktop/Savana.palim/chapitres && grep -hc '' *.md | paste -sd+ | bc) <(cd /tmp/Savana-test.palim/chapitres && grep -hc '' *.md | paste -sd+ | bc) ; echo "(les comptes de lignes différent : la copie a des lignes blanches canoniques ; c'est attendu)"
diff <(cd ~/Desktop/Savana.palim/chapitres && cat *.md | tr -d '\n' | wc -c) <(cd /tmp/Savana-test.palim/chapitres && cat *.md | tr -d '\n' | wc -c) && echo "OK: même nombre de caractères hors sauts de ligne"
```
Le second `diff` doit être vide **si** le mot tapé a été retiré avant la sauvegarde finale ; sinon la différence doit être exactement la longueur du mot ajouté.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: describe the .palim v2 chapter format (extended markdown + exact sidecar)"
```

- [ ] **Step 5: Bilan**

Rapporter : nombre de tests, résultat du typecheck, résultat des vérifications manuelles (Task 9 §4, Task 10 §4, Task 11 §3) avec les chiffres observés. Ne rien déclarer « vérifié » sans l'avoir observé.

---

## Suites reportées (issues des revues, à reprendre en 0b)

Constats acceptés ou hors périmètre de 0a, consignés ici pour ne pas les perdre :

1. **Valider `ref.file` du manifeste** (même famille que la validation des ids) : n'accepter que `chapitres/<nom>.md` ; un manifeste artisanal pourrait sinon viser `project.json` à l'intérieur de la racine. Premier point de 0b.
2. `useExport.exportPdf` : `JSON.parse` non gardé sur le document en mémoire (le DOCX saute le chapitre, le PDF échoue en bloc). Avertir quand un chapitre illisible est exclu d'un export.
3. Codec, cas non modélisés par le corpus : `heading` contenant un `hardBreak` ; paragraphe se terminant par un `hardBreak` ; backslash littéral en fin de ligne dans un fichier externe ; une seule ligne blanche tolérée entre deux items de liste ; tabulations comme indentation de continuation.
4. `projection.ts` : les paragraphes vides à l'intérieur d'une citation ou d'un item sont retirés par l'oracle alors que le round-trip réel les conserve (sur-déclaration de perte, test seulement).
5. Test direct de `resolveChapterDoc` pour la raison `invalid-doc`.
6. Instantanés `getState()` dans `EditorArea` (bandeau, garde de parité) : style préexistant du fichier.
7. Vérification visuelle dans l'app (non réalisable par les agents) : ouvrir une **copie** de Savana, chapitre 5 = 20 paragraphes, taper, ⌘S, rouvrir sans notification, 103 sidecars ; `chmod 000` sur un chapitre → triangle dans la TDM, bandeau, lecture seule, fichier intact après sauvegarde.
