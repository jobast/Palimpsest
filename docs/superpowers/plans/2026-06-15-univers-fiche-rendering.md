# Univers v2 #2 — Rendu riche des fiches (markdown + wikilinks cliquables) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher le corps d'une fiche en **markdown rendu** (titres, sections, listes, gras, citations) avec les **`[[wikilinks]]` cliquables** (navigation vers la fiche cible), via une **bascule Aperçu / Éditer** (Aperçu par défaut). Les liens cassés sont stylés mais non cliquables.

**Architecture:** Une fonction pure `wikilinksToMarkdown` convertit `[[cible|affichage]]` en lien markdown `[affichage](wiki:cible)` ; un composant `FicheBody` rend le corps via **react-markdown** (déjà installé) avec un handler sur les liens `wiki:` (résolus par `resolveWikilink`, navigation par `onNavigate`) ; `FicheEditor` gagne une bascule Aperçu/Éditer.

**Tech Stack:** react-markdown 10.1.0, React/Zustand, `node:test`. Branche `feat/wiki`. Préfixer node : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`. Tests `npm run test:main` (baseline **121 verts**). Build `npm run build`.

**Décisions (validées) :** bascule Aperçu/Éditer, **Aperçu par défaut** ; lien cassé = stylé (rouge/pointillé) **non cliquable**.

**Briques réutilisées :** `extractWikilinks(body)`, `resolveWikilink(target, fiches)`, `ficheKey` (`@shared/wiki`/`links.ts`) ; `react-markdown`. Pas de nouveau paquet (GFM/tableaux = hors périmètre v1).

---

### Task 1 : Pur — `wikilinksToMarkdown`

**Files:**
- Modify: `src/shared/wiki/links.ts`
- Test: `src/main/__tests__/wiki.render.test.ts`

- [ ] **Step 1 : test qui échoue** — Créer `src/main/__tests__/wiki.render.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { wikilinksToMarkdown } from '../../shared/wiki/links.js'

test('converts [[target]] to a wiki: markdown link', () => {
  assert.equal(wikilinksToMarkdown('Voir [[kiran]] ici.'), 'Voir [kiran](wiki:kiran) ici.')
})

test('converts [[target|display]] keeping the display text', () => {
  assert.equal(wikilinksToMarkdown('Voir [[personnages/kiran|Kiran]].'), 'Voir [Kiran](wiki:personnages%2Fkiran).')
})

test('converts several links in one body', () => {
  assert.equal(wikilinksToMarkdown('[[a]] et [[b]]'), '[a](wiki:a) et [b](wiki:b)')
})

test('leaves text without wikilinks unchanged', () => {
  assert.equal(wikilinksToMarkdown('# Titre\nPas de lien.'), '# Titre\nPas de lien.')
})
```

- [ ] **Step 2 : run (fail)** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run test:main`. Expected: FAIL (`wikilinksToMarkdown` absent).

- [ ] **Step 3 : implémenter** — Dans `src/shared/wiki/links.ts`, ajouter (réutilise `extractWikilinks` déjà dans ce fichier) :
```typescript
/** Convert [[target|display]] wikilinks into markdown links `[display](wiki:target)`
 *  (target percent-encoded), so a markdown renderer can show them as clickable links. */
export function wikilinksToMarkdown(body: string): string {
  const links = extractWikilinks(body)
  let out = body
  for (let i = links.length - 1; i >= 0; i--) {
    const l = links[i]
    out = out.slice(0, l.start) + `[${l.display}](wiki:${encodeURIComponent(l.target)})` + out.slice(l.end)
  }
  return out
}
```

- [ ] **Step 4 : run (pass)** — `npm run test:main`. Expected: baseline+4 (≈125).

- [ ] **Step 5 : commit**
```bash
git add src/shared/wiki/links.ts src/main/__tests__/wiki.render.test.ts
git commit -m "feat(univers): wikilinksToMarkdown (pure) for rendered fiche bodies"
```

---

### Task 2 : Composant `FicheBody` (rendu markdown + liens wiki)

**Files:**
- Create: `src/renderer/components/univers/FicheBody.tsx`

Build-vérifiée.

- [ ] **Step 1 : créer le composant** — `src/renderer/components/univers/FicheBody.tsx` :
```tsx
import ReactMarkdown, { type Components } from 'react-markdown'
import { wikilinksToMarkdown, resolveWikilink, ficheKey, type Fiche } from '@shared/wiki'

/** Renders a fiche body as markdown, with [[wikilinks]] as clickable navigation.
 *  Broken wikilinks (no target fiche) are styled but not clickable. */
export function FicheBody({ body, fiches, onNavigate }: { body: string; fiches: Fiche[]; onNavigate: (key: string) => void }) {
  const md = wikilinksToMarkdown(body)

  const components: Components = {
    h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-1">{children}</h1>,
    h2: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-1">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1">{children}</h3>,
    p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
    ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-0.5">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-0.5">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    blockquote: ({ children }) => <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground italic">{children}</blockquote>,
    code: ({ children }) => <code className="bg-accent px-1 rounded text-[0.85em]">{children}</code>,
    hr: () => <hr className="my-3 border-border" />,
    a: ({ href, children }) => {
      if (href && href.startsWith('wiki:')) {
        const target = decodeURIComponent(href.slice('wiki:'.length))
        const hit = resolveWikilink(target, fiches)
        if (hit) {
          return (
            <button onClick={() => onNavigate(ficheKey(hit))} className="text-primary hover:underline">
              {children}
            </button>
          )
        }
        return <span className="text-red-500 border-b border-dashed border-red-400" title="Fiche introuvable">{children}</span>
      }
      // Non-wiki link: render as plain text (no external navigation in v1).
      return <span className="underline decoration-dotted">{children}</span>
    }
  }

  return (
    <div className="text-sm text-foreground font-serif">
      <ReactMarkdown components={components}>{md}</ReactMarkdown>
    </div>
  )
}
```
(Vérifier au build l'import du type `Components` depuis `react-markdown` v10 ; si le nom diffère, typer `components` en `Record<string, React.FC<{ href?: string; children?: React.ReactNode }>>` ou retirer l'annotation et laisser l'inférence. `wikilinksToMarkdown`/`resolveWikilink`/`ficheKey`/`Fiche` viennent de `@shared/wiki`.)

- [ ] **Step 2 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (pas d'import inutilisé ; react-markdown se compile), ≈125 verts.

- [ ] **Step 3 : commit**
```bash
git add src/renderer/components/univers/FicheBody.tsx
git commit -m "feat(univers): FicheBody markdown renderer with clickable wikilinks"
```

---

### Task 3 : Bascule Aperçu / Éditer dans `FicheEditor`

**Files:**
- Modify: `src/renderer/components/univers/FicheEditor.tsx`

Build-vérifiée + vérif runtime.

- [ ] **Step 1 : intégrer** — Dans `src/renderer/components/univers/FicheEditor.tsx` :
  - Imports : ajouter `import { FicheBody } from './FicheBody'` et, depuis `lucide-react`, `Eye` et `Pencil`. (Le composant importe déjà `useState`.)
  - Ajouter un état de mode après les autres états : `const [editing, setEditing] = useState(false)` (Aperçu par défaut).
  - Dans la barre d'en-tête (le `<div className="px-4 py-2 border-b border-border flex items-center gap-2">` qui contient l'input du titre et le `<span>` de catégorie), ajouter à la fin (après le span de catégorie) un bouton bascule :
```tsx
        <button
          onClick={() => setEditing(e => !e)}
          className="p-1 rounded hover:bg-accent text-muted-foreground"
          title={editing ? 'Aperçu' : 'Éditer'}
        >
          {editing ? <Eye size={15} /> : <Pencil size={15} />}
        </button>
```
  - Remplacer le `<textarea>` du corps par un rendu conditionnel : en mode `editing`, le `<textarea>` actuel ; sinon, le rendu `FicheBody` (cliquer un wikilink navigue) :
```tsx
      {editing ? (
        <textarea
          className="flex-1 w-full resize-none bg-background text-foreground p-4 focus:outline-none font-serif leading-relaxed min-h-[12rem]"
          placeholder="Contenu de la fiche (markdown)…"
          value={draft.body}
          onChange={e => scheduleSave({ ...draft, body: e.target.value })}
        />
      ) : (
        <div className="flex-1 overflow-auto p-4 min-h-[12rem]">
          {draft.body.trim()
            ? <FicheBody body={draft.body} fiches={fiches} onNavigate={setActiveFiche} />
            : <div className="text-muted-foreground text-sm">Fiche vide. Clique sur ✎ pour éditer.</div>}
        </div>
      )}
```
  (`fiches` et `setActiveFiche` sont déjà destructurés depuis `useWikiStore` en haut de `FicheEditor`. `draft` est l'état courant.)

- [ ] **Step 2 : build + tests** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (pas d'import/var inutilisé ; hooks au top-level), ≈125 verts.

- [ ] **Step 3 : commit**
```bash
git add src/renderer/components/univers/FicheEditor.tsx
git commit -m "feat(univers): preview/edit toggle for fiche body (rendered by default)"
```

---

### Task 4 : Vérification

- [ ] **Step 1** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, ≈125 verts.
- [ ] **Step 2 (manuel, sur `~/Desktop/Savana.palim`)** — `npm run launch:dev` : ouvrir une fiche riche (idéalement une produite par l'agent, avec des `## sections` et des `[[liens]]`). Attendu : par défaut, **rendu** (titres, listes, gras, citations) ; les `[[liens]]` apparaissent en **liens cliquables** qui naviguent vers la fiche cible ; un lien vers une fiche inexistante est **rouge/pointillé non cliquable** ; le bouton ✎ bascule en **édition** (textarea markdown), l'œil revient en aperçu. L'autosave fonctionne toujours en édition.
- [ ] **Step 3 (si correctifs)** — `git add -A && git commit -m "fix(univers): fiche rendering adjustments from manual test"`

## Auto-revue (couverture vs design)
- `wikilinksToMarkdown` (pur, testé) → Task 1. ✅
- Rendu markdown riche (titres/sections/listes/gras/citations) → Task 2 (`FicheBody` + components). ✅
- Wikilinks cliquables (résolus, navigation) + liens cassés stylés non cliquables → Task 2. ✅
- Bascule Aperçu/Éditer, Aperçu par défaut → Task 3. ✅
- HORS périmètre v1 : tableaux GFM (pas de remark-gfm), liens externes cliquables, clic-pour-créer une fiche manquante.

## Cohérence des signatures
- `wikilinksToMarkdown(body): string` — Task 1 ; utilisé Task 2.
- `FicheBody({ body, fiches, onNavigate })` — Task 2 ; utilisé Task 3.
- `resolveWikilink(target, fiches)`, `ficheKey(fiche)`, `extractWikilinks(body)` — existants, réutilisés.
