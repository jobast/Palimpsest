# Wiki / bible du roman maintenu par LLM — Design directeur (PROPOSITION, à valider)

**Date :** 2026-06-14
**Projet :** Palimpseste (Electron) — `/Users/saidimu/DEV/PROJETS/palimpseste`
**Statut :** ⚠️ PROPOSITION — rédigée en autonomie pendant que l'utilisateur dort. **À relire et valider** avant tout plan/implémentation (brainstorming non terminé : les « Décisions à valider » ci-dessous attendent ton arbitrage).
**Voir aussi :** `docs/upgrade-plan-depuis-qt.md` §A (IA) et §B (wiki), mémoire [[palimpseste-ai-charter]], modèle Savana `/Users/saidimu/DEV/wiki/savana/`.

## Pourquoi (rappel)

Le wiki/bible LLM est **LE différenciateur** de Palimpseste et la justification même du
stockage Markdown. Concept : une base de **référence** de l'univers (personnages, lieux,
intrigues, structure, écriture, notes), distincte de la prose, que l'IA **maintient en
proposant** des mises à jour à partir des chapitres, l'auteur·e **acceptant/refusant**
chaque proposition. L'IA n'écrit jamais la prose (charte stricte).

## Base de départ (recherche faite)

Trois sources étudiées en profondeur :
1. **Savana** (`/Users/saidimu/DEV/wiki/savana/`) — bible réelle maintenue par agent LLM.
   Patterns clés : frontmatter `last_updated` + **`sources:`** (liste des chapitres ingérés
   = clé de l'update incrémental et de l'anti-doublon) ; dossiers par catégorie ;
   `log.md` append-only ; `grille-lecture.md` (checklist d'ingest) ; `alertes-joan.md`
   (décisions à trancher) ; conventions (incertitude « (non vérifié) », contradictions
   jamais supprimées, pas de tirets cadratins).
2. **Wiki Qt** (`palimpseste-qt/src/palimpseste/core/wiki*.py`) — **implémentation de
   référence, cœur pur portable en TS** : `WikiStore` (fiches/suggestions/alertes/log/
   integrations), `wiki_maintenance` (prompt d'ingest + grille 8 points + parsing des blocs
   `=== SUGGESTION ===`), `wiki_query` (ask_bible, sélection de contexte budgétée),
   `wiki_links` (wikilinks, backlinks, graphe, recherche plein-texte), `wiki_templates`
   (6 templates), `wiki_structure` (tableau mystères, index des scènes). Logique découplée
   de l'UI Qt → portage TS quasi 1:1.
3. **Electron existant** — déjà en place : infra markdown (`src/shared/markdown/`
   frontmatter js-yaml + codec), `flattenChapterIds`, IPC fichiers (`readFile/writeFile/
   deleteFile/createDirectory/readDirectory/exists` + journal de sauvegarde atomique),
   **AI** (`aiStore` + `lib/ai/client` + IPC `ai:chat` claude/openai/ollama, clés chiffrées
   via safeStorage), **sheets** (characters/locations/plots/notes JSON + éditeurs),
   **reports** (AIReport markdown).

## Architecture cible (proposée)

- **Cœur wiki en TS pur**, porté du Qt, sous `src/shared/wiki/` (testable `node:test`
  comme le codec markdown) : modèle (`Fiche`, `Suggestion`, `Alert`), parsing/sérialisation
  frontmatter (réutilise `src/shared/markdown/frontmatter`), `slugify` (réutilise
  `src/shared/markdown/filename`), parsing des blocs suggestion, wikilinks, recherche,
  templates, structure (mystères/scènes).
- **Persistance** sous `<projet>.palim/wiki/` (miroir Qt/Savana) :
  ```
  wiki/
    personnages/<slug>.md  lieux/… intrigues/… structure/… ecriture/… notes/…
    _suggestions/<uuid>.md   _alertes/<uuid>.md   log.md   integrations.json
  ```
  Frontmatter fiche : `titre, categorie, cree, last_updated, sources[], type?`.
  Écritures via le journal de sauvegarde existant (atomique).
- **Pipeline LLM** : réutilise l'IPC `ai:chat` existant (pas de nouvel IPC requis pour
  démarrer). `maintain_chapter` construit le prompt (texte chapitre + résumé fiches +
  déjà-connu anti-doublon + mystères + **grille de lecture 8 points**) → sortie en blocs
  `=== SUGGESTION ===` (TYPE/CIBLE/TITRE/RESUME/CORPS) → parsing tolérant → file de
  suggestions. `integrations.json` pilote le badge « À intégrer : N chapitres ».
- **Acceptation** : `nouvelle_fiche`→crée la fiche ; `ajout`→section datée ; `incoherence`→
  **Alerte** persistante (ne modifie jamais une fiche). Charte : aucune écriture IA dans le
  manuscrit, aucune prose.
- **UI** (`components/wiki/`) : panneau à onglets (Suggestions / Fiches / Alertes / Log /
  Recherche / Interroger / Graphe / Structure), éditeur de fiche (réutilise TipTap +
  templates), vue centrale fiche (comme NoteEditor/SheetEditor).

## ⚠️ DÉCISIONS À VALIDER (ton arbitrage requis)

1. **Sheets ↔ Wiki : remplacer, migrer ou cohabiter ?**
   Les `sheets` actuels (characters/locations/plots/notes en JSON) recouvrent en partie les
   fiches wiki (personnages/lieux/intrigues/notes). Le plan d'upgrade §B recommande : « la
   bible Markdown devient la source ; les sheets JSON deviennent une vue ou sont migrés ».
   **Ma recommandation :** le **wiki Markdown devient la source unique** des fiches ;
   migration ponctuelle `sheets/*.json → wiki/<cat>/<slug>.md` ; l'UI fiches actuelle est
   remplacée par l'éditeur de fiche wiki. (Garde la géoloc des lieux : `coordinates/mapZoom`
   → frontmatter de la fiche lieu.) **À confirmer** : remplacement+migration, ou cohabitation
   transitoire ?

2. **Providers IA : se contenter de l'existant (3) ou élargir d'abord (§A, 6 providers) ?**
   Le wiki peut fonctionner sur l'IPC `ai:chat` **existant** (claude au minimum). L'élargissement
   à 6 providers + charte stricte + personas (§A) est un cycle **indépendant**. **Ma reco :**
   construire le wiki sur l'`ai:chat` existant (déblocage immédiat), faire §A en parallèle/
   après. **À confirmer.**

3. **Charte IA** — réaffirmer que tout prompt wiki (ingest + ask_bible) porte la charte
   stricte (référence seulement, cite les sources, marque « (non vérifié) », ne réécrit
   jamais, jamais de prose ni de suggestion d'écriture). Reco : oui, non négociable
   (cf. [[palimpseste-ai-charter]]).

4. **Ingest in-app vs agent externe** — Savana délègue l'ingest/audit à un agent (Claude
   Code) lisant les `.md`. In-app, on appelle l'IA via `ai:chat`. Reco : in-app d'abord
   (un chapitre à la fois + « tout intégrer »), l'agent externe restant possible plus tard
   puisque le wiki est du Markdown sur disque. **À confirmer.**

## Découpage en sous-projets (chacun = spec → plan → implémentation)

Le wiki est trop gros pour un seul cycle. Séquence proposée :

- **W1 — Cœur stockage + modèle** (décision-léger, fondation). Port TS pur du `WikiStore`
  Qt : types, frontmatter, slug, lecture/écriture fiches/suggestions/alertes, `log.md`,
  `integrations.json`. Tests `node:test`. **Spec détaillé écrit** :
  `2026-06-14-wiki-1-storage-core-design.md`. Prêt à implémenter après aval (indépendant de
  la décision sheets). 
- **W2 — Liens & recherche** : wikilinks `[[…]]` + résolution + backlinks + graphe ;
  recherche plein-texte normalisée (fiches + manuscrit). Pur, testable. Port `wiki_links`.
- **W3 — Pipeline d'ingest LLM** : `maintain_chapter` (prompt + grille 8 points + parsing
  suggestions), badge « À intégrer », « Tout intégrer », acceptation/refus, alertes.
  Dépend de la décision providers (§2) ; utilise `ai:chat`.
- **W4 — Interroger la bible (ask_bible)** : sélection de contexte budgétée (≈140k car.,
  cap 30 docs), prompt strict, réponse sauvegardée en fiche `notes`. Port `wiki_query`.
- **W5 — Structure** : templates (6), tableau de bord mystères, index des scènes. Port
  `wiki_templates`/`wiki_structure`.
- **W6 — UI** : panneau wiki à onglets + éditeur de fiche + graphe. (Peut avancer en
  parallèle des couches pures dès W1.)
- **W0 (transverse) — Réconciliation sheets** : selon décision §1 (migration + remplacement
  de l'UI fiches). À placer tôt si « remplacer », sinon différé.

Ordre conseillé : **W1 → W2 → (W6 démarre) → W3 → W4 → W5**, avec W0 selon décision §1.

## Hors périmètre (de ce design directeur)
- Détails d'implémentation de chaque sous-projet (→ specs dédiés).
- §A (IA multi-provider) — son propre cycle.
- Recto-verso EPUB/PDF, etc.

## Prochaine étape
À ton réveil : trancher les **Décisions à valider** (surtout §1 sheets et §2 providers).
Ensuite : relire `2026-06-14-wiki-1-storage-core-design.md` → plan W1 → implémentation.
