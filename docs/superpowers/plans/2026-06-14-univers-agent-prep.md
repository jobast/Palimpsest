# Univers — Préparation agent externe (génération `wiki/CLAUDE.md`) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Bouton « Préparer l'analyse approfondie (agent externe) » qui génère `<projet>.palim/wiki/CLAUDE.md` (mode d'emploi pour un agent type Claude Code) + crée les dossiers de catégories.

**Architecture:** Générateur pur `buildWikiAgentDoc` (testé) réutilisant la grille de lecture ; action IO `writeAgentDoc` (crée dossiers + écrit le fichier) ; bouton dans le navigateur de l'Univers + notification.

**Tech Stack:** TS, `node:test`, React. Branche `feat/wiki`. Préfixer node par `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`. Tests `npm run test:main` (92 verts). Imports `src/shared/` en `.js`.

---

### Task 1 : Exporter la grille + générateur `buildWikiAgentDoc` (pur)

**Files:**
- Modify: `src/shared/wiki/ingestPrompt.ts` (exporter la grille)
- Create: `src/shared/wiki/agentDoc.ts`
- Modify: `src/shared/wiki/index.ts` (baril)
- Test: `src/main/__tests__/wiki.agentDoc.test.ts`

- [ ] **Step 1 : exporter la grille** — Dans `src/shared/wiki/ingestPrompt.ts`, ligne 7, remplacer `const GRILLE = \`GRILLE DE LECTURE…\`` par `export const GRILLE = \`GRILLE DE LECTURE…\`` (ajouter juste `export` ; le corps et l'usage `${GRILLE}` ligne ~57 restent inchangés).

- [ ] **Step 2 : test qui échoue** — Créer `src/main/__tests__/wiki.agentDoc.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWikiAgentDoc } from '../../shared/wiki/agentDoc.js'

test('agent doc embeds project, categories, frontmatter contract, grille, conventions', () => {
  const doc = buildWikiAgentDoc('Prophéties', 'Jean Bastide')
  assert.match(doc, /Prophéties/)
  // categories
  for (const c of ['personnages', 'lieux', 'intrigues', 'structure', 'ecriture', 'notes']) {
    assert.match(doc, new RegExp(c))
  }
  // read-only chapters reference
  assert.match(doc, /\.\.\/chapitres\//)
  // frontmatter contract keys
  assert.match(doc, /titre:/)
  assert.match(doc, /categorie:/)
  assert.match(doc, /sources:/)
  // grille 8 points
  for (const kw of ['PERSONNAGES', 'CONTRADICTIONS', 'NOMS MANQUANTS', 'ETATS DE CONNAISSANCE']) {
    assert.match(doc, new RegExp(kw))
  }
  // conventions
  assert.match(doc, /non vérifié/)
  assert.match(doc, /jamais.*supprimer|ne jamais supprimer/i)
  assert.match(doc, /cadratin/)
  // wikilinks + sources mechanism
  assert.match(doc, /\[\[/)
  assert.match(doc, /integrations\.json/)
})
```

- [ ] **Step 3 : run (fail)** — `npm run test:main`.

- [ ] **Step 4 : implémenter** — Créer `src/shared/wiki/agentDoc.ts` :
```typescript
import { GRILLE } from './ingestPrompt.js'

/** Operating manual written to wiki/CLAUDE.md for an external agent (e.g. Claude Code). */
export function buildWikiAgentDoc(projectName: string, author: string): string {
  return `# Univers — bible du roman « ${projectName} »${author ? ` (${author})` : ''}

Tu es l'archiviste de l'« Univers » de ce roman : du matériel de RÉFÉRENCE (personnages,
lieux, intrigues, structure, écriture, notes), distinct de la prose du manuscrit.

## Charte (non négociable)
- Tu n'écris JAMAIS de prose de manuscrit : pas une phrase destinée au livre.
- Tu n'inventes RIEN : chaque fait repose strictement sur le texte des chapitres.
- Tu écris l'Univers ; l'auteur écrit le roman.

## Sources (LECTURE SEULE)
Les chapitres du manuscrit sont sous \`../chapitres/*.md\` (frontmatter \`id\`/\`title\` +
corps ; les scènes sont séparées par \`* * *\`). Ne les MODIFIE JAMAIS : ce sont tes sources.

## Structure de l'Univers (ce que tu écris, ici dans \`wiki/\`)
\`\`\`
wiki/
  personnages/  lieux/  intrigues/  structure/  ecriture/  notes/   (une fiche = un .md)
  _alertes/<uuid>.md      log.md      index.md      integrations.json
\`\`\`
Le nom de fichier = le slug (sans accents, minuscules, tirets).

## Format d'une fiche (CONTRAT — respecte-le pour que l'app relise tes fiches)
\`\`\`
---
titre: <Titre lisible>
categorie: <personnages|lieux|intrigues|structure|ecriture|notes>
cree: AAAA-MM-JJ
last_updated: AAAA-MM-JJ
sources: [chapitres/001-....md, chapitres/004-....md]
type: <optionnel : mystere|chronologie|etat_connaissance|pov|voix_personnage>
tags: [optionnel]
---
# <Titre>

## Résumé
… avec des [[liens]] vers d'autres fiches ([[henry|Henry]], [[lieux/laikipia|Laikipia]]).

## <sections riches : traits physiques, traits de caractère, scènes datées par chapitre,
##  citations exactes entre guillemets, évolutions…>
\`\`\`
Les liens \`[[cible]]\` / \`[[cible|affichage]]\` relient les fiches (résolus par chemin
\`categorie/slug\`, slug unique, ou titre).

## Le mécanisme \`sources:\` (cœur de l'update incrémental)
- Avant d'ingérer un chapitre dans une fiche, vérifie s'il est déjà dans \`sources:\`.
- Sinon : ajoute le contenu À LA FICHE **et** le chapitre à \`sources:\`, et mets à jour
  \`last_updated\`.
- Backlog (chapitres non lus) = \`ls ../chapitres/*.md\` moins l'union des \`sources:\` de
  toutes les fiches.

## ${GRILLE}

## Conventions de rédaction
- Tout en français.
- Marque chaque fait incertain « (non vérifié) ».
- PRÉSERVE les ambiguïtés voulues par l'auteur : ne les résous pas.
- Placeholders (XXX, TROUVER NOM…) : SIGNALÉS, jamais inventés.
- **Ne supprime JAMAIS** une contradiction : documente les DEUX versions avec leur source
  (« ch. X dit… mais ch. Y dit… ») et crée une ALERTE dans \`_alertes/<uuid>.md\`
  (frontmatter : \`type: contradiction\`, \`titre\`, \`resume\`, \`cree\`, \`statut: ouverte\`).
- N'emploie PAS de tirets cadratins (—) : des tirets simples (-) uniquement.

## Opérations
- **Ingest d'un chapitre** : lis le chapitre, applique la grille, crée/maj les fiches
  affectées (+ \`sources:\`), crée des alertes en cas de contradiction, appends à \`log.md\`,
  mets à jour \`index.md\`, et note le chapitre dans \`integrations.json\` (\`{ "<id>": "<ISO>" }\`).
- **Audit par lots** (import / rattrapage) : calcule le backlog, regroupe par thème, lance
  des agents Explore en parallèle (un par lot de 6-8 chapitres), puis consolide.
- **Répondre à une question** : synthétise depuis les fiches + chapitres, CITE les sources,
  n'invente rien, marque les incertitudes.

## index.md
Catalogue par catégorie : pour chaque fiche, \`- [[categorie/slug|Titre]] — résumé d'une ligne\`.
Mets-le à jour à chaque ingest.

## log.md (append-only, plus récent en tête)
Format d'entrée : \`## AAAA-MM-JJ - <ACTION> <sujet>\` puis un court détail, puis \`---\`.
`
}
```

- [ ] **Step 5 : baril** — Dans `src/shared/wiki/index.ts`, ajouter `export * from './agentDoc.js'`.

- [ ] **Step 6 : run (pass)** — `npm run test:main` (→ 95). Vérifier que les tests d'`ingestPrompt` restent verts (l'export de GRILLE ne change pas son contenu).

- [ ] **Step 7 : commit**
```bash
git add src/shared/wiki/ingestPrompt.ts src/shared/wiki/agentDoc.ts src/shared/wiki/index.ts src/main/__tests__/wiki.agentDoc.test.ts
git commit -m "feat(univers): wiki/CLAUDE.md generator for external-agent analysis (pure)"
```

---

### Task 2 : Action IO `writeAgentDoc`

**Files:** Modify `src/renderer/lib/wiki/wikiIO.ts`

- [ ] **Step 1 : implémenter** — Dans `src/renderer/lib/wiki/wikiIO.ts`, ajouter l'import `buildWikiAgentDoc` (depuis `@shared/wiki`) et la fonction (réutilise `ensureDir` + `WIKI_CATEGORIES` déjà importés/disponibles dans le fichier ; sinon importer `WIKI_CATEGORIES` depuis `@shared/wiki`) :
```typescript
import { buildWikiAgentDoc } from '@shared/wiki'

/**
 * Prepare the wiki for an external agent (Claude Code): create the category folders
 * and write wiki/CLAUDE.md (the operating manual). Returns the doc's path.
 */
export async function writeAgentDoc(projectPath: string, projectName: string, author: string): Promise<string> {
  await ensureDir(`${projectPath}/wiki`)
  for (const category of WIKI_CATEGORIES) {
    await ensureDir(`${projectPath}/wiki/${category}`)
  }
  const path = `${projectPath}/wiki/CLAUDE.md`
  await window.electronAPI.writeFile(path, buildWikiAgentDoc(projectName, author))
  return path
}
```
(Vérifier que `WIKI_CATEGORIES` est importé dans wikiIO.ts ; il l'est déjà — utilisé par `loadFiches`. Réutiliser le même import.)

- [ ] **Step 2 : build** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, 95 verts.

- [ ] **Step 3 : commit**
```bash
git add src/renderer/lib/wiki/wikiIO.ts
git commit -m "feat(univers): writeAgentDoc IO (create folders + wiki/CLAUDE.md)"
```

---

### Task 3 : Bouton dans la section Univers

**Files:** Modify `src/renderer/components/univers/FicheNavigator.tsx`

- [ ] **Step 1 : implémenter** — Dans `FicheNavigator.tsx` :
  - Importer : `import { writeAgentDoc } from '@/lib/wiki/wikiIO'`, `import { useProjectStore } from '@/stores/projectStore'`, `import { useStatsStore } from '@/stores/statsStore'`, et l'icône `Sparkles` de `lucide-react`.
  - Dans le composant, récupérer `const project = useProjectStore(s => s.project)` et `const projectPath = useProjectStore(s => s.projectPath)` et `const showNotification = useStatsStore(s => s.showNotification)`.
  - Ajouter un handler :
```tsx
  const handlePrepareAgent = async () => {
    if (!project || !projectPath) return
    try {
      const path = await writeAgentDoc(projectPath, project.meta.name, project.meta.author || '')
      showNotification('success', `Analyse préparée : ${path}. Lancez « claude » dans ce dossier.`)
    } catch {
      showNotification('error', "Impossible de préparer l'analyse")
    }
  }
```
  - Ajouter, en bas du rendu du navigateur (après la liste des catégories, dans le conteneur racine), un bouton discret :
```tsx
      <button
        onClick={handlePrepareAgent}
        className="mt-3 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
        title="Génère wiki/CLAUDE.md pour une analyse approfondie par un agent externe"
      >
        <Sparkles size={13} />
        Préparer l'analyse approfondie
      </button>
```
  (Placer ce bouton à l'intérieur du `<div className="p-2 space-y-3 overflow-auto h-full">` racine, après le `.map` des catégories.)

- [ ] **Step 2 : build** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (pas d'import inutilisé), 95 verts.

- [ ] **Step 3 : commit**
```bash
git add src/renderer/components/univers/FicheNavigator.tsx
git commit -m "feat(univers): 'prepare deep analysis' button (writes wiki/CLAUDE.md)"
```

---

### Task 4 : Vérification
- [ ] **Step 1** — `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, 95 verts.
- [ ] **Step 2 (manuel)** — `npm run launch:dev`, section Univers → cliquer « Préparer l'analyse approfondie » → notification du chemin ; vérifier que `<projet>.palim/wiki/CLAUDE.md` existe et que les 6 dossiers de catégories sont créés. Ouvrir `CLAUDE.md` : il contient la charte, le format de fiche, la grille, les conventions, les opérations. (Optionnel : lancer `claude` dans `<projet>.palim/` et vérifier qu'il comprend la mission.)
- [ ] **Step 3 (si correctifs)** — `git add -A && git commit -m "fix(univers): adjustments from manual verification"`

## Auto-revue (couverture du spec)
- Générateur `buildWikiAgentDoc` (charte, sources read-only, structure, contrat frontmatter, mécanisme sources, grille 8 points, conventions, opérations, index/log) → Task 1. ✅
- Écriture (dossiers + CLAUDE.md) → Task 2. ✅
- Bouton + notification du chemin → Task 3. ✅
- Test pur du générateur ; reste manuel → Tasks 1 & 4. ✅
- Pas de reveal-in-Finder (pas d'IPC dispo) → notification du chemin à la place. ✅

## Cohérence des types/signatures
- `buildWikiAgentDoc(projectName: string, author: string): string` — Task 1, utilisé Task 2.
- `GRILLE` exporté depuis `ingestPrompt.ts` — Task 1, réutilisé par `agentDoc.ts`.
- `writeAgentDoc(projectPath, projectName, author): Promise<string>` — Task 2, utilisé Task 3.
- Réutilise `ensureDir` + `WIKI_CATEGORIES` (déjà dans wikiIO) et `showNotification(type,message)`.
