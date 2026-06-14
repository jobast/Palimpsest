# Wiki W5 (templates + structure) + prompts W3/W4 (purs) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Porter (purs, testés) : les 6 templates de fiche, le tableau de bord mystères + détection d'entités par scène (W5), et les **constructeurs de prompts** d'ingest (W3) et d'interrogation (W4) — charte + grille de lecture 8 points + format de sortie. (Le branchement `ai:chat` live et l'UI viennent après, avec l'utilisateur.)

**Architecture:** Modules purs `src/shared/wiki/{templates,structure,ingestPrompt,askContext}.ts`, portés de `palimpseste-qt/core/wiki_templates.py`, `wiki_structure.py`, `wiki_maintenance.py`, `wiki_query.py`. Testés `node:test`.

**Tech Stack:** TS, `node:test`. Branche `feat/wiki`. Préfixer node par `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`. Tests `npm run test:main` (74 verts). Imports `src/shared/` en `.js`.

---

### Task 1 : Templates de fiche (pur)

**Files:** Create `src/shared/wiki/templates.ts` ; Test `src/main/__tests__/wiki.templates.test.ts`

- [ ] **Step 1 : test qui échoue**
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { WIKI_TEMPLATES, getTemplate } from '../../shared/wiki/templates.js'

test('there are six templates with the expected ids', () => {
  assert.deepEqual(
    WIKI_TEMPLATES.map(t => t.id).sort(),
    ['chronologie', 'etat_connaissance', 'libre', 'mystere', 'pov', 'voix_personnage']
  )
})

test('each template has category + label + body; mystere targets structure', () => {
  for (const t of WIKI_TEMPLATES) {
    assert.ok(t.label && t.category && typeof t.body === 'string')
  }
  const m = getTemplate('mystere')
  assert.equal(m?.category, 'structure')
  assert.equal(m?.type, 'mystere')
  assert.match(m!.body, /Statut/)
})

test('getTemplate returns undefined for unknown id', () => {
  assert.equal(getTemplate('nope'), undefined)
})
```

- [ ] **Step 2 : run (fail)** — `npm run test:main`.

- [ ] **Step 3 : implémenter** — `src/shared/wiki/templates.ts` :
```typescript
import type { WikiCategory } from './types.js'

export interface WikiTemplate {
  id: string
  label: string
  category: WikiCategory
  type?: string
  body: string
}

export const WIKI_TEMPLATES: WikiTemplate[] = [
  {
    id: 'mystere', label: 'Mystère / énigme', category: 'structure', type: 'mystere',
    body: [
      '## Question', '', '## Indices semés', '', '## Fausses pistes', '',
      '## Révélation prévue', '', '## Statut', '', '(ouvert / en cours / révélé)', ''
    ].join('\n')
  },
  {
    id: 'chronologie', label: 'Chronologie', category: 'structure', type: 'chronologie',
    body: ['## Repères datés', '', '## Ellipses', '', '## Ordre des événements', ''].join('\n')
  },
  {
    id: 'etat_connaissance', label: 'État de connaissance', category: 'structure', type: 'etat_connaissance',
    body: ['## Qui sait quoi', '', '| Personnage | Information | Sait ? | Depuis | Note |', '|---|---|---|---|---|', ''].join('\n')
  },
  {
    id: 'pov', label: 'Point de vue narratif', category: 'ecriture', type: 'pov',
    body: ['## Distance', '', '## Temporalité', '', '## Registre sensoriel', '', '## Ce qu\'il/elle ignore', ''].join('\n')
  },
  {
    id: 'voix_personnage', label: 'Voix d\'un personnage', category: 'ecriture', type: 'voix_personnage',
    body: ['## Registre', '', '## Tics de langage', '', '## Exemple de dialogue', '', '> '].join('\n')
  },
  {
    id: 'libre', label: 'Note libre', category: 'notes',
    body: ''
  }
]

export function getTemplate(id: string): WikiTemplate | undefined {
  return WIKI_TEMPLATES.find(t => t.id === id)
}
```

- [ ] **Step 4 : run (pass)** — `npm run test:main` (→ 77).
- [ ] **Step 5 : commit** — `git add src/shared/wiki/templates.ts src/main/__tests__/wiki.templates.test.ts && git commit -m "feat(wiki): six fiche templates (pure)"`

---

### Task 2 : Structure — mystères + entités par scène (pur)

**Files:** Create `src/shared/wiki/structure.ts` ; Test `src/main/__tests__/wiki.structure.test.ts`

- [ ] **Step 1 : test qui échoue**
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { mysteriesOverview, sceneEntities } from '../../shared/wiki/structure.js'
import type { Fiche } from '../../shared/wiki/types.js'

const fiche = (slug: string, title: string, type: string | undefined, body: string): Fiche =>
  ({ slug, category: 'structure', title, created: '2026-06-14', body, type })

test('mysteriesOverview extracts status/revelation/false-trail count from type=mystere fiches', () => {
  const f = fiche('m1', 'Qui a tué Henry ?', 'mystere', [
    '## Question', 'Qui est le commanditaire ?', '## Fausses pistes', '- les Maasaï', '- le voisin',
    '## Révélation prévue', 'Acte 6', '## Statut', 'ouvert'
  ].join('\n'))
  const other = fiche('x', 'Pas un mystère', undefined, 'rien')
  const rows = mysteriesOverview([f, other])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].title, 'Qui a tué Henry ?')
  assert.equal(rows[0].statut, 'ouvert')
  assert.equal(rows[0].revelation, 'Acte 6')
  assert.equal(rows[0].fauxPistes, 2)
  assert.match(rows[0].question, /commanditaire/)
})

test('sceneEntities detects fiche titles present in a text (accent/case-insensitive, word-boundary)', () => {
  const fiches: Fiche[] = [
    { slug: 'kiran', category: 'personnages', title: 'Kiran', created: '', body: '' },
    { slug: 'laikipia', category: 'lieux', title: 'Laïkipia', created: '', body: '' },
    { slug: 'nairobi', category: 'lieux', title: 'Nairobi', created: '', body: '' }
  ]
  const hits = sceneEntities('Kiran arrive à laikipia au petit matin.', fiches).map(f => f.slug).sort()
  assert.deepEqual(hits, ['kiran', 'laikipia'])
})
```

- [ ] **Step 2 : run (fail)**.

- [ ] **Step 3 : implémenter** — `src/shared/wiki/structure.ts` :
```typescript
import type { Fiche } from './types.js'

export interface MysteryRow {
  slug: string
  title: string
  statut: string
  revelation: string
  fauxPistes: number
  question: string
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Extract the first non-empty line of a "## <heading>" section (accent/case-insensitive). */
function section(body: string, heading: string): string {
  const lines = body.split('\n')
  const target = normalize(heading)
  let inSection = false
  const collected: string[] = []
  for (const line of lines) {
    const h = line.match(/^##\s+(.*)$/)
    if (h) {
      if (inSection) break
      inSection = normalize(h[1].trim()).startsWith(target)
      continue
    }
    if (inSection) collected.push(line)
  }
  return collected.join('\n').trim()
}

function firstLine(text: string): string {
  return text.split('\n').map(s => s.trim()).find(s => s.length > 0) ?? ''
}

function countBullets(text: string): number {
  return text.split('\n').filter(l => /^\s*[-*+]\s+\S/.test(l)).length
}

/** Dashboard rows from fiches whose type is "mystere". */
export function mysteriesOverview(fiches: Fiche[]): MysteryRow[] {
  return fiches.filter(f => f.type === 'mystere').map(f => ({
    slug: f.slug,
    title: f.title,
    statut: firstLine(section(f.body, 'Statut')),
    revelation: firstLine(section(f.body, 'Révélation')),
    fauxPistes: countBullets(section(f.body, 'Fausses pistes')),
    question: firstLine(section(f.body, 'Question')).slice(0, 100)
  }))
}

/** Fiches whose title appears as a whole word in `text` (accent/case-insensitive). */
export function sceneEntities(text: string, fiches: Fiche[]): Fiche[] {
  const norm = normalize(text)
  return fiches.filter(f => {
    const t = normalize(f.title.trim())
    if (!t) return false
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    return re.test(norm)
  })
}
```

- [ ] **Step 4 : run (pass)** (→ 79).
- [ ] **Step 5 : commit** — `git add src/shared/wiki/structure.ts src/main/__tests__/wiki.structure.test.ts && git commit -m "feat(wiki): mysteries dashboard + scene entity detection (pure)"`

---

### Task 3 : Prompt d'ingest LLM (W3, pur)

**Files:** Create `src/shared/wiki/ingestPrompt.ts` ; Test `src/main/__tests__/wiki.ingestPrompt.test.ts`

- [ ] **Step 1 : test qui échoue**
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { WIKI_SYSTEM_PROMPT, buildWikiUpdatePrompt } from '../../shared/wiki/ingestPrompt.js'

test('system prompt carries the strict charter (no prose)', () => {
  assert.match(WIKI_SYSTEM_PROMPT, /jamais/i)
  assert.match(WIKI_SYSTEM_PROMPT, /prose/i)
  assert.match(WIKI_SYSTEM_PROMPT, /AUCUNE SUGGESTION/)
})

test('update prompt embeds chapter, grille (8 points), fiches summary, output format', () => {
  const p = buildWikiUpdatePrompt({
    chapterTitle: 'Chapitre 1',
    chapterText: 'Marie partit à l\'aube.',
    fichesSummary: 'personnages/marie : Marie',
    pendingSummary: '(rien)',
    mysteriesSummary: ''
  })
  assert.match(p, /Chapitre 1/)
  assert.match(p, /Marie partit/)
  assert.match(p, /personnages\/marie/)
  // grille 8 points present
  for (const kw of ['PERSONNAGES', 'LIEUX', 'INTRIGUES', 'CONTRADICTIONS', 'NOMS MANQUANTS', 'INCERTITUDES', 'CHRONOLOGIE', 'ETATS DE CONNAISSANCE']) {
    assert.match(p, new RegExp(kw))
  }
  // output format
  assert.match(p, /=== SUGGESTION ===/)
  assert.match(p, /TYPE:/)
  assert.match(p, /AUCUNE SUGGESTION/)
})
```

- [ ] **Step 2 : run (fail)**.

- [ ] **Step 3 : implémenter** — `src/shared/wiki/ingestPrompt.ts` (port fidèle du Qt `wiki_maintenance.py`) :
```typescript
export const WIKI_SYSTEM_PROMPT = `Tu es l'archiviste de la « bible du roman » (le wiki) d'un auteur. Le wiki est du matériel de RÉFÉRENCE (personnages, lieux, intrigues, notes), distinct de la prose du manuscrit. Ton rôle : à partir d'un extrait de chapitre, proposer des mises à jour de la bible sous forme de SUGGESTIONS, jamais de modifications directes. Tu réponds TOUJOURS en français.

Charte : Palimpseste est un outil d'aide à l'écriture ; tu ne produis JAMAIS de prose de manuscrit, pas une phrase destinée à être insérée dans le livre. Tu ne fais qu'archiver des faits de référence proposés à l'auteur.

Tu bases chaque fait STRICTEMENT sur le texte fourni : tu n'inventes rien. Si tu n'as rien à proposer, tu écris exactement « AUCUNE SUGGESTION ».`

const GRILLE = `GRILLE DE LECTURE (suis-la systématiquement, dans cet ordre) :

1. PERSONNAGES — Nouveaux personnages ? Pour chacun : traits PHYSIQUES, traits de CARACTÈRE, RELATIONS, ÉVOLUTION par rapport à ce qui est déjà consigné.
2. LIEUX — Nouveaux lieux ? Descriptions sensorielles, rôle narratif.
3. INTRIGUES — Intrigues qui avancent, nouveaux mystères/questions, révélations.
4. CONTRADICTIONS — Le chapitre contredit-il une fiche existante ? Émets une suggestion TYPE incoherence en citant « le chapitre dit… mais la fiche dit… ». Ne tranche pas : signale.
5. NOMS MANQUANTS / PLACEHOLDERS — Repère les noms provisoires (XXX, TROUVER NOM…). Signale-les en incoherence. N'invente JAMAIS un nom.
6. INCERTITUDES — Marque « (non vérifié) » tout fait suggéré/ambigu. Ne résous JAMAIS une ambiguïté laissée ouverte par l'auteur.
7. CHRONOLOGIE — Dates, époques, durées, ellipses. Ajout à structure/chronologie ou nouvelle fiche structure. « (non vérifié) » si inféré.
8. ETATS DE CONNAISSANCE — Qui apprend/ignore quoi ? Pour chaque transfert d'information : émetteur, récepteur, fait. Ajout à structure/etat-de-connaissance ou nouvelle fiche structure.`

const CONVENTIONS = `CONVENTIONS DE RÉDACTION :
- Rédige TOUT en français.
- Marque chaque fait incertain par « (non vérifié) ».
- PRÉSERVE les ambiguïtés.
- Les placeholders sont SIGNALÉS, jamais inventés.
- N'emploie PAS de tirets cadratins : des tirets simples (-) uniquement.`

const FORMAT = `FORMAT DE SORTIE — exactement ces blocs, séparés par une ligne « === SUGGESTION === » :

=== SUGGESTION ===
TYPE: <nouvelle_fiche | ajout | incoherence>
CIBLE: <categorie pour une nouvelle fiche, ou categorie/slug pour un ajout, ou vide>
TITRE: <titre de la fiche concernée>
RESUME: <une ligne>
CORPS:
<contenu proposé, fondé sur le texte>

Émets autant de blocs que nécessaire. Si tu n'as STRICTEMENT rien à proposer, écris exactement « AUCUNE SUGGESTION » et rien d'autre.`

export interface WikiUpdatePromptInput {
  chapterTitle: string
  chapterText: string
  fichesSummary: string
  pendingSummary: string
  mysteriesSummary?: string
}

export function buildWikiUpdatePrompt(input: WikiUpdatePromptInput): string {
  const mysteries = input.mysteriesSummary && input.mysteriesSummary.trim()
    ? `\nMystères ouverts (titre et statut) :\n<<<\n${input.mysteriesSummary}\n>>>\n`
    : ''
  return `Tu maintiens la « bible du roman » (wiki) : du matériel de RÉFÉRENCE, distinct de la prose.

Étape 1 — Lis l'extrait du chapitre en appliquant la grille de lecture.
Chapitre : « ${input.chapterTitle} ».
<<<
${input.chapterText}
>>>

${GRILLE}

Étape 2 — Compare-le à la bible existante (toutes catégories) :
<<<
${input.fichesSummary}
>>>
${mysteries}
Déjà en attente / déjà signalé (NE les redonne PAS, évite les doublons) :
<<<
${input.pendingSummary}
>>>

Étape 3 — Émets des suggestions. RÈGLES STRICTES :
- Base CHAQUE fait STRICTEMENT sur le texte fourni. N'invente RIEN.
- Ne propose AUCUNE modification du manuscrit : le wiki est de la référence, pas de la prose.
- Ne duplique pas une fiche/suggestion/alerte existante.

${CONVENTIONS}

${FORMAT}`
}
```

- [ ] **Step 4 : run (pass)** (→ 81).
- [ ] **Step 5 : commit** — `git add src/shared/wiki/ingestPrompt.ts src/main/__tests__/wiki.ingestPrompt.test.ts && git commit -m "feat(wiki): ingest prompt builder + charter + 8-point grille (pure)"`

---

### Task 4 : Sélection de contexte + prompt d'interrogation (W4, pur)

**Files:** Create `src/shared/wiki/askContext.ts` ; Test `src/main/__tests__/wiki.askContext.test.ts`

- [ ] **Step 1 : test qui échoue**
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { selectContext, buildQueryPrompt, QUERY_SYSTEM_PROMPT } from '../../shared/wiki/askContext.js'

const docs = [
  { label: 'fiche kiran', text: 'Kiran cherche le commanditaire du meurtre.' },
  { label: 'fiche henry', text: 'Henry possède un ranch.' },
  { label: 'chapitre 03', text: 'Le meurtre a lieu la nuit.' }
]

test('selectContext ranks by relevance and respects the file cap', () => {
  const sel = selectContext('Qui est le commanditaire du meurtre ?', docs, { charBudget: 100000, maxFiles: 2 })
  assert.equal(sel.length, 2)
  assert.equal(sel[0].label, 'fiche kiran')          // most relevant first
})

test('selectContext falls back to all docs when nothing matches', () => {
  const sel = selectContext('xyzzy', docs, { charBudget: 100000, maxFiles: 30 })
  assert.equal(sel.length, 3)
})

test('query system prompt is strict (cite sources, no prose, mark uncertainty)', () => {
  assert.match(QUERY_SYSTEM_PROMPT, /cite/i)
  assert.match(QUERY_SYSTEM_PROMPT, /non vérifié/i)
  assert.match(QUERY_SYSTEM_PROMPT, /prose/i)
})

test('buildQueryPrompt embeds the question and labelled context', () => {
  const { user } = buildQueryPrompt('Qui a tué Henry ?', [{ label: 'fiche kiran', text: 'Kiran enquête.' }])
  assert.match(user, /Qui a tué Henry/)
  assert.match(user, /\[fiche kiran\]/)
  assert.match(user, /Kiran enquête/)
})
```

- [ ] **Step 2 : run (fail)**.

- [ ] **Step 3 : implémenter** — `src/shared/wiki/askContext.ts` (port du Qt `wiki_query.py`) :
```typescript
export interface ContextDoc { label: string; text: string }

const STOPWORDS = new Set(['le','la','les','un','une','des','de','du','et','ou','que','qui','dans','pour','par','sur','avec','qui','est','the','and','for'])

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
function terms(q: string): string[] {
  return Array.from(new Set(normalize(q).split(/\W+/).filter(t => t.length >= 3 && !STOPWORDS.has(t))))
}
function scoreText(text: string, qterms: string[]): number {
  const norm = normalize(text)
  let score = 0
  for (const t of qterms) {
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
    score += (norm.match(re) ?? []).length
  }
  return score
}

export interface SelectOptions { charBudget?: number; maxFiles?: number }

/** Pick the most relevant docs within a char budget + file cap. Falls back to all docs (smallest first) when nothing matches. */
export function selectContext(question: string, docs: ContextDoc[], opts: SelectOptions = {}): ContextDoc[] {
  const charBudget = opts.charBudget ?? 140000
  const maxFiles = opts.maxFiles ?? 30
  const qterms = terms(question)
  let ranked: ContextDoc[]
  if (qterms.length) {
    const scored = docs.map(d => ({ d, s: scoreText(`${d.label}\n${d.text}`, qterms) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s || a.d.label.localeCompare(b.d.label))
    ranked = scored.map(x => x.d)
  } else {
    ranked = []
  }
  if (!ranked.length) {
    // fallback: all docs, smallest first
    ranked = [...docs].sort((a, b) => a.text.length - b.text.length)
  }
  const out: ContextDoc[] = []
  let used = 0
  for (const d of ranked) {
    if (out.length >= maxFiles) break
    if (out.length > 0 && used + d.text.length > charBudget) continue
    out.push(d)
    used += d.text.length
  }
  return out
}

export const QUERY_SYSTEM_PROMPT = `Tu es l'archiviste de la « bible du roman » (le wiki) d'un auteur : du matériel de RÉFÉRENCE et le texte des chapitres. Tu réponds TOUJOURS en français.

On te pose une question sur cet univers. Tu réponds STRICTEMENT à partir du contexte fourni, et de rien d'autre :
- Cite tes sources EN LIGNE, entre parenthèses, en reprenant le label du document : « (fiche kiran) », « (chapitre 03) ».
- Quand le contexte NE répond PAS, dis-le clairement plutôt que de combler les trous.
- Marque tout fait incertain par « (non vérifié) ».
- N'INVENTE jamais un fait, un nom ou un détail absent du contexte.

Charte : ta réponse est du matériel de RÉFÉRENCE, pas de la prose de manuscrit : tu ne produis JAMAIS de prose destinée au livre ni de suggestion de réécriture.

N'emploie pas de tirets cadratins : des tirets simples (-) uniquement.`

export function buildQueryPrompt(question: string, contextDocs: ContextDoc[]): { system: string; user: string } {
  const ctx = contextDocs.map(d => `[${d.label}]\n<<<\n${d.text}\n>>>`).join('\n\n')
  const user = `Contexte (extraits de la bible et des chapitres ; cite chaque information en reprenant le label entre crochets) :

${ctx}

Question de l'auteur :
<<<
${question}
>>>

Réponds en t'appuyant UNIQUEMENT sur le contexte ci-dessus. Cite tes sources en ligne. Si le contexte ne permet pas de répondre, dis-le. Marque les incertitudes « (non vérifié) ». N'invente rien et ne propose aucune réécriture du manuscrit.`
  return { system: QUERY_SYSTEM_PROMPT, user }
}
```

- [ ] **Step 4 : run (pass)** (→ 85).
- [ ] **Step 5 : étendre le baril** — Dans `src/shared/wiki/index.ts` ajouter :
```typescript
export * from './templates.js'
export * from './structure.js'
export * from './ingestPrompt.js'
export * from './askContext.js'
```
- [ ] **Step 6 : build + commit** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main` puis `git add src/shared/wiki/askContext.ts src/shared/wiki/index.ts src/main/__tests__/wiki.askContext.test.ts && git commit -m "feat(wiki): ask-bible context selection + query prompt (pure) + barrel"`

---

### Task 5 : Vérification
- [ ] `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main` → build OK, ~85 tests verts.

## Auto-revue
- Templates 6 → T1. Structure (mystères + entités scène) → T2. Prompt ingest (charte+grille 8+format) → T3. Ask context+prompt → T4. Baril → T4. ✅
- Tout pur, dates non requises. ai:chat live + UI = hors périmètre (post-retour utilisateur). ✅
