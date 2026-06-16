# Univers v2 #2b — Présentation « article » des fiches (infobox + sommaire + tags) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à la fiche l'allure d'un article type Wikipédia (comme le rendu Savana `query.py`) : **infobox** flottante à droite (Type / Mis à jour / Sources), **Sommaire** (table des matières cliquable depuis les titres `##`), et **tags** en chips sous le titre - par-dessus le corps markdown déjà rendu (#2).

**Architecture:** Une fonction pure `extractHeadings` (+ `headingSlug`) parse les titres du corps ; `FicheBody` pose un `id` slug sur ses titres ; deux composants `FicheInfobox` (carte flottante) et `FicheToc` (sommaire qui défile jusqu'à la section) ; `FicheEditor` assemble tags + infobox + sommaire + corps en mode Aperçu (les éditeurs de champs structurés restent en mode Édition seulement).

**Tech Stack:** React, react-markdown (en place), `node:test`. Branche `feat/wiki`. Préfixer node : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`. Tests `npm run test:main` (baseline **125 verts**). Build `npm run build`.

**Décisions (validées) :** les 3 (infobox + sommaire + tags) ; infobox **flottante à droite**.

**Champs sources (Fiche) :** `type` (frontmatter `type:` → `fiche.type`), `category`, `lastUpdated`, `sources[]`, `created`, et `meta.tags` (le `tags:` du frontmatter, non-known-key → `fiche.meta.tags`).

---

### Task 1 : Pur — `extractHeadings` + `headingSlug`

**Files:**
- Modify: `src/shared/wiki/links.ts`
- Test: `src/main/__tests__/wiki.toc.test.ts`

- [ ] **Step 1 : test qui échoue** — Créer `src/main/__tests__/wiki.toc.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { extractHeadings, headingSlug } from '../../shared/wiki/links.js'

test('headingSlug lowercases, strips accents and non-alnum', () => {
  assert.equal(headingSlug('Traits physiques'), 'traits-physiques')
  assert.equal(headingSlug('Résumé'), 'resume')
  assert.equal(headingSlug('Violence sexuelle (ch. 048)'), 'violence-sexuelle-ch-048')
})

test('extractHeadings captures ## and ### with level + slug, ignores # (h1)', () => {
  const body = '# Anton\n\n## Résumé\ntexte\n\n### Sous-section\n\n## Traits physiques'
  assert.deepEqual(extractHeadings(body), [
    { level: 2, text: 'Résumé', slug: 'resume' },
    { level: 3, text: 'Sous-section', slug: 'sous-section' },
    { level: 2, text: 'Traits physiques', slug: 'traits-physiques' }
  ])
})

test('extractHeadings strips inline markdown from the display text', () => {
  assert.deepEqual(extractHeadings('## **Arc** narratif'), [
    { level: 2, text: 'Arc narratif', slug: 'arc-narratif' }
  ])
})

test('extractHeadings on a body without headings returns []', () => {
  assert.deepEqual(extractHeadings('Juste du texte.'), [])
})
```

- [ ] **Step 2 : run (fail)** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run test:main`. Expected: FAIL (`extractHeadings`/`headingSlug` absents).

- [ ] **Step 3 : implémenter** — Dans `src/shared/wiki/links.ts`, ajouter :
```typescript
/** Anchor slug for a heading: lowercase, accent-stripped, non-alnum -> hyphen. */
export function headingSlug(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export interface Heading { level: number; text: string; slug: string }

/** Table-of-contents entries from a markdown body: ## and ### headings (not # / h1). */
export function extractHeadings(body: string): Heading[] {
  const out: Heading[] = []
  for (const line of body.split('\n')) {
    const m = line.match(/^(#{2,3})\s+(.*?)\s*#*$/)
    if (!m) continue
    const text = m[2].replace(/[*_`]/g, '').trim()
    if (!text) continue
    out.push({ level: m[1].length, text, slug: headingSlug(text) })
  }
  return out
}
```

- [ ] **Step 4 : run (pass)** — `npm run test:main`. Expected: baseline+4 (≈129).

- [ ] **Step 5 : commit**
```bash
git add src/shared/wiki/links.ts src/main/__tests__/wiki.toc.test.ts
git commit -m "feat(univers): extractHeadings + headingSlug (pure) for fiche TOC"
```

---

### Task 2 : `FicheBody` — poser des `id` slug sur les titres

**Files:**
- Modify: `src/renderer/components/univers/FicheBody.tsx`

Build-vérifiée. But : pour que les liens du sommaire défilent jusqu'à la bonne section.

- [ ] **Step 1 : modifier** — Dans `src/renderer/components/univers/FicheBody.tsx` :
  - Imports : ajouter `headingSlug` à l'import `@shared/wiki` ; ajouter `import { isValidElement, type ReactNode } from 'react'`.
  - Ajouter ce helper au-dessus du composant :
```typescript
/** Flatten react-markdown heading children to plain text (for the anchor id). */
function childText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(childText).join('')
  if (isValidElement(node)) return childText((node.props as { children?: ReactNode }).children)
  return ''
}
```
  - Mettre un `id` sur les trois titres (le slug doit matcher `headingSlug` côté sommaire) :
```tsx
    h1: ({ children }) => <h1 id={headingSlug(childText(children))} className="text-lg font-bold mt-4 mb-1">{children}</h1>,
    h2: ({ children }) => <h2 id={headingSlug(childText(children))} className="text-base font-semibold mt-4 mb-1">{children}</h2>,
    h3: ({ children }) => <h3 id={headingSlug(childText(children))} className="text-sm font-semibold mt-3 mb-1">{children}</h3>,
```
  (Le reste du composant est inchangé.)

- [ ] **Step 2 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (pas d'import inutilisé), ≈129 verts.

- [ ] **Step 3 : commit**
```bash
git add src/renderer/components/univers/FicheBody.tsx
git commit -m "feat(univers): anchor ids on rendered fiche headings (for TOC)"
```

---

### Task 3 : Composants `FicheInfobox` + `FicheToc`

**Files:**
- Create: `src/renderer/components/univers/FicheInfobox.tsx`
- Create: `src/renderer/components/univers/FicheToc.tsx`

Build-vérifiée.

- [ ] **Step 1 : `FicheInfobox.tsx`** :
```tsx
import type { Fiche } from '@shared/wiki'

/** Wikipedia-style infobox: floats right, body text wraps around it. */
export function FicheInfobox({ fiche }: { fiche: Fiche }) {
  const rows: Array<[string, string]> = []
  rows.push(['Type', fiche.type || fiche.category])
  if (fiche.lastUpdated) rows.push(['Mis à jour', fiche.lastUpdated])
  if (fiche.sources && fiche.sources.length) {
    rows.push(['Sources', fiche.sources.map(s => s.replace(/^chapitres\//, '').replace(/\.md$/, '')).join(', ')])
  }
  return (
    <aside className="float-right w-60 ml-4 mb-3 border border-border rounded overflow-hidden bg-card text-xs">
      <div className="px-3 py-2 bg-accent font-semibold text-center">{fiche.title}</div>
      <dl className="p-3 space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="font-semibold text-muted-foreground">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
```

- [ ] **Step 2 : `FicheToc.tsx`** :
```tsx
import { extractHeadings } from '@shared/wiki'

/** "Sommaire": a clickable table of contents that scrolls to the section. */
export function FicheToc({ body }: { body: string }) {
  const headings = extractHeadings(body)
  if (headings.length < 2) return null  // not worth a TOC for 0-1 sections
  const jump = (slug: string) => document.getElementById(slug)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  return (
    <nav className="inline-block border border-border rounded p-3 mb-3 mr-4 text-xs bg-card align-top">
      <div className="font-semibold mb-1">Sommaire</div>
      <ol className="list-decimal pl-4 space-y-0.5">
        {headings.map(h => (
          <li key={h.slug} className={h.level === 3 ? 'ml-3' : ''}>
            <button onClick={() => jump(h.slug)} className="text-primary hover:underline text-left">{h.text}</button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
```

- [ ] **Step 3 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, ≈129 verts.

- [ ] **Step 4 : commit**
```bash
git add src/renderer/components/univers/FicheInfobox.tsx src/renderer/components/univers/FicheToc.tsx
git commit -m "feat(univers): FicheInfobox + FicheToc components"
```

---

### Task 4 : Assembler en mode Aperçu dans `FicheEditor` + tags

**Files:**
- Modify: `src/renderer/components/univers/FicheEditor.tsx`

Build-vérifiée + vérif runtime.

- [ ] **Step 1 : imports** — Dans `src/renderer/components/univers/FicheEditor.tsx`, ajouter :
```typescript
import { FicheInfobox } from './FicheInfobox'
import { FicheToc } from './FicheToc'
```

- [ ] **Step 2 : champs structurés en Édition seulement** — Le composant rend actuellement `<FicheStructuredFields fiche={draft} onChange={meta => scheduleSave({ ...draft, meta })} />` sans condition. L'envelopper pour ne l'afficher qu'en édition : `{editing && <FicheStructuredFields fiche={draft} onChange={meta => scheduleSave({ ...draft, meta })} />}`.

- [ ] **Step 3 : tags + assemblage Aperçu** — Dans la branche Aperçu (le `else` de `{editing ? (textarea) : (...)}`), remplacer le contenu par tags + infobox + sommaire + corps :
```tsx
      ) : (
        <div className="flex-1 overflow-auto p-4 min-h-[12rem]">
          {Array.isArray(draft.meta?.tags) && (draft.meta.tags as string[]).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {(draft.meta.tags as string[]).map(t => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{t}</span>
              ))}
            </div>
          )}
          {draft.body.trim() ? (
            <>
              <FicheInfobox fiche={draft} />
              <FicheToc body={draft.body} />
              <FicheBody body={draft.body} fiches={fiches} onNavigate={setActiveFiche} />
            </>
          ) : (
            <div className="text-muted-foreground text-sm">Fiche vide. Clique sur ✎ pour éditer.</div>
          )}
        </div>
      )}
```
  (Le `<FicheInfobox>` flotte à droite ; le `<FicheToc>` est un bloc en ligne ; `<FicheBody>` coule autour. `draft.meta` peut être `undefined` d'où le `draft.meta?.tags`.)

- [ ] **Step 4 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (pas d'import/var inutilisé ; hooks au top-level), ≈129 verts.

- [ ] **Step 5 : commit**
```bash
git add src/renderer/components/univers/FicheEditor.tsx
git commit -m "feat(univers): article-style fiche preview (infobox + TOC + tags)"
```

---

### Task 5 : Vérification

- [ ] **Step 1** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, ≈129 verts.
- [ ] **Step 2 (manuel, sur `~/Desktop/Savana.palim`)** — `npm run launch:dev` : ouvrir une fiche personnage riche (idéalement produite par l'agent, avec `## sections`, `tags:`, `sources:`). Attendu en **Aperçu** : les **tags** en chips sous le titre ; une **infobox flottée à droite** (Type, Mis à jour, Sources) avec le texte qui coule autour ; un **Sommaire** listant les sections, dont un clic **défile** jusqu'à la section ; le corps rendu en sections. En **Édition** (✎) : les champs structurés (rôle/carte) + le textarea reviennent, pas d'infobox. → l'allure doit se rapprocher de la page Savana `query.py`.
- [ ] **Step 3 (si correctifs)** — `git add -A && git commit -m "fix(univers): article presentation adjustments from manual test"`

## Auto-revue (couverture vs la page Savana)
- Sections du corps (## ...) → déjà rendues (#2). ✅
- **Sommaire** (TDM cliquable depuis les titres) → Tasks 1+2+3 (`extractHeadings` + ids + `FicheToc`). ✅
- **Infobox** (Type / Mis à jour / Sources) flottée à droite → Task 3 (`FicheInfobox`) + Task 4. ✅
- **Tags** en chips → Task 4. ✅
- Aperçu vs Édition (infobox en lecture / éditeurs structurés en édition) → Task 4. ✅
- HORS périmètre : carte des lieux en aperçu, infobox spécifique par catégorie, ancres d'URL réelles, GFM.

## Cohérence des signatures
- `headingSlug(text): string` ; `extractHeadings(body): Heading[]` (`Heading = {level,text,slug}`) — Task 1 ; `headingSlug` réutilisé Task 2, `extractHeadings` Task 3.
- `FicheInfobox({ fiche })` ; `FicheToc({ body })` — Task 3 ; utilisés Task 4.
- L'`id` des titres (`headingSlug(childText(children))`) = la cible des liens du sommaire. — Tasks 2+3.
