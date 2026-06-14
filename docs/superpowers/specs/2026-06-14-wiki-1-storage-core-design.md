# Wiki — Sous-projet W1 : cœur stockage + modèle (PROPOSITION, à valider)

**Date :** 2026-06-14
**Statut :** ⚠️ PROPOSITION (rédigée en autonomie). À valider après le design directeur
`2026-06-14-wiki-master-design.md`. Décision-léger : mirroir fidèle du cœur Qt éprouvé →
faible risque, indépendant de la décision « sheets ↔ wiki ».
**Réf. de portage :** `palimpseste-qt/src/palimpseste/core/wiki.py` (classes `Fiche`,
`Suggestion`, `Alert`, `WikiStore`, `parse_suggestions_block`).

## Objectif

Poser le **cœur TypeScript pur** du wiki : modèle de données, codecs frontmatter↔objets,
parsing des blocs de suggestion LLM, format du log. Entièrement testable `node:test`, sans
DOM ni IPC. C'est la fondation des sous-projets suivants (ingest, liens, recherche, UI).

> La couche d'**E/S disque** (lecture/écriture des dossiers `wiki/*` via `window.electronAPI`
> + journal de sauvegarde) est une fine couche renderer ajoutée en fin de W1 (étape « store »),
> bâtie sur ces fonctions pures ; sa vérification est manuelle (pas de harnais renderer).

## Format disque (rappel, miroir Qt/Savana)

```
<projet>.palim/wiki/
  personnages/<slug>.md  lieux/  intrigues/  structure/  ecriture/  notes/
  _suggestions/<uuid>.md   _alertes/<uuid>.md   log.md   integrations.json
```

## Unités (toutes sous `src/shared/wiki/`, imports relatifs `.js`)

### `types.ts`
```typescript
export type WikiCategory =
  | 'personnages' | 'lieux' | 'intrigues' | 'structure' | 'ecriture' | 'notes'

export interface Fiche {
  slug: string
  category: WikiCategory
  title: string
  created: string          // YYYY-MM-DD
  body: string
  lastUpdated?: string     // YYYY-MM-DD
  sources?: string[]       // chapter ids/files ingested into this fiche
  type?: string            // template subtype (mystere, chronologie, pov, …)
}

export type SuggestionType = 'nouvelle_fiche' | 'ajout' | 'incoherence'
export interface Suggestion {
  id: string               // uuid (assigned at write time; '' when parsed from LLM)
  type: SuggestionType
  cible: string            // category (nouvelle_fiche) | category/slug (ajout) | ''
  title: string
  resume: string
  body: string
  sourceChapitre?: string  // set by the ingest layer, not the LLM
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

### `fiche.ts` — codec fiche (réutilise `../markdown/frontmatter` + `../markdown/filename`)
```typescript
parseFiche(md: string, fallbackSlug: string, fallbackCategory: WikiCategory): Fiche
serializeFiche(fiche: Fiche): string        // frontmatter (titre/categorie/cree/last_updated/sources/type?) + body
addSourceToFiche(fiche: Fiche, chapterId: string): Fiche   // idempotent (no dup), refreshes lastUpdated via injected date
```
- Frontmatter clés FR (miroir Qt) : `titre, categorie, cree, last_updated, sources, type`.
- `slugify` réutilisé de `../markdown/filename`.
- Tolérant : frontmatter corrompu → fiche de repli (slug/catégorie fallback, body conservé),
  jamais d'exception.
- **Dates injectées** (pas de `Date.now()` dans le pur ; l'appelant passe la date) pour la
  testabilité — signature ex. `addSourceToFiche(fiche, chapterId, today: string)`.

### `suggestion.ts` — parsing LLM + codec
```typescript
parseSuggestionsBlock(text: string): Suggestion[]   // split sur '=== SUGGESTION ===', en-têtes TYPE/CIBLE/TITRE/RESUME + CORPS:, tolérant ('AUCUNE SUGGESTION' → [])
serializeSuggestion(s: Suggestion): string          // frontmatter (type/cible/titre/resume/source_chapitre) + body
parseSuggestion(md: string): Suggestion             // depuis _suggestions/<uuid>.md
```
- `parseSuggestionsBlock` : blocs malformés ignorés (jamais d'exception) ; `TYPE` invalide → bloc sauté.

### `alert.ts` — codec alerte + conversion
```typescript
parseAlert(md: string): Alert
serializeAlert(a: Alert): string                    // frontmatter (type/titre/resume/cree/statut) + body
suggestionToAlert(s: Suggestion, today: string): Omit<Alert,'id'>  // incoherence → contradiction ouverte
```

### `log.ts` — journal append-only
```typescript
formatLogEntry(action: string, subject: string, detail: string, today: string): string  // "## <date> - <ACTION> <subject>\n\n<detail>\n\n---\n"
prependLogEntry(existingLog: string, entry: string): string   // newest first
```

### `index.ts` — baril `export * from` des modules ci-dessus.

## Tests (`src/main/__tests__/wiki.*.test.ts`, `node:test`)
- **fiche** : round-trip serialize→parse (titre/cree/sources/type) ; frontmatter manquant →
  fallback ; `addSourceToFiche` idempotent (pas de doublon) + maj lastUpdated.
- **suggestion** : `parseSuggestionsBlock` sur un exemple multi-blocs (nouvelle_fiche/ajout/
  incoherence) → 3 suggestions correctes ; 'AUCUNE SUGGESTION' → [] ; bloc sans TYPE ignoré ;
  round-trip serialize→parse.
- **alert** : round-trip ; `suggestionToAlert` (incoherence → contradiction/ouverte).
- **log** : `formatLogEntry` format exact ; `prependLogEntry` met le plus récent en tête.

## Étape « store » (fin de W1, renderer, vérif manuelle)
`src/renderer/stores/wikiStore.ts` (ou intégré à projectStore) : lit/écrit `wiki/*` via
`window.electronAPI` (+ `ensureCreateDirectory`, journal de sauvegarde), expose :
`loadWiki(projectPath)`, `listFiches/saveFiche/deleteFiche`, `listSuggestions/addSuggestions/
acceptSuggestion/rejectSuggestion`, `listAlerts/addAlert/resolveAlert`, `appendLog`,
`integratedChapters/markChapterIntegrated/pendingChapterIds`. Utilise les fonctions pures
ci-dessus. (Le détail exact = plan W1.)

## Hors périmètre W1
- Ingest LLM (W3), liens/recherche (W2), ask_bible (W4), structure/templates (W5), UI (W6).
- Réconciliation sheets (W0, selon décision directeur).

## Dépendances
- Réutilise `src/shared/markdown/frontmatter` (parse/stringify YAML) et
  `src/shared/markdown/filename` (slugify). Aucune nouvelle dépendance npm.
- `tsconfig.node.json` inclut déjà `src/shared` (tests OK).
