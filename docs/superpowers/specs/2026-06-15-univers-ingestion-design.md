# Univers — Couche 1 : Ingestion in-app (chapitre + batch) — Design

**Date :** 2026-06-15
**Projet :** Palimpseste (Electron) — `/Users/saidimu/DEV/PROJETS/palimpseste`
**Statut :** approuvé (design ; à implémenter)
**Branche :** `feat/wiki`
**Voir aussi :** `…/2026-06-14-wiki-master-design.md`, `ingestPrompt.ts` (déjà construit), `wikiIO.ts`, modèle Savana. Couche 2 (synthèse multi-lentilles) = spec séparé à venir.

## Objectif

Analyser le manuscrit **dans l'app**, via la **couche IA des réglages** (`ai:chat`, donc
n'importe quel provider) : pour chaque chapitre, extraire les entités (personnages, lieux,
intrigues) et **construire/enrichir les fiches** de l'Univers, **plus un résumé succinct du
chapitre**. Deux portées (un chapitre / batch), deux modes (basique auto / avancé revue),
avec un **journal annulable**.

> Cette couche fait l'**ingestion par entité** (local au chapitre). La **synthèse transverse**
> qui « connecte les fils » (mystères, chronologie, états de connaissance, thèmes,
> contradictions inter-chapitres, liens/lint) est la **Couche 2** (multi-lentilles parallèles),
> spécifiée à part. Couche 1 est sa fondation.

## Deux axes

- **Portée** : *un chapitre* (continu — proposé à l'ouverture du chapitre suivant) · *batch*
  (tous les chapitres non encore intégrés — pour un import comme Savana).
- **Mode** (réglage `uiStore`/settings, défaut basique) :
  - **Basique** : applique direct (auto-construit la bible). 
  - **Avancé** : dépose des suggestions à valider une par une (file dans le panneau droit).
  Le mode s'applique aux deux portées.

## Pipeline d'un chapitre (cœur réutilisable)

1. **Texte du chapitre** : `documentContents[chapterId]` (JSON TipTap) → `docToMarkdownBody`
   (déjà existant) → texte brut.
2. **Contexte** : résumé des fiches existantes (titres par catégorie), « déjà connu »
   (suggestions/alertes en cours, anti-doublon), mystères ouverts. (`ingestPrompt` fournit
   déjà `buildWikiUpdatePrompt` ; on étend la consigne pour exiger AUSSI un **résumé** du
   chapitre.)
3. **Appel IA** : via le **moteur sélectionné** (voir « Moteur d'analyse ») — soit `ai:chat`
   (API, clés), soit un **CLI d'abonnement** (`claude`/`codex`/`gemini`). Même entrée
   (system = `WIKI_SYSTEM_PROMPT`, user = prompt), même sortie texte à parser. Model-agnostic.
4. **Parsing** : `parseSuggestionsBlock` → suggestions (nouvelle_fiche / ajout / incoherence)
   + extraction du bloc **`=== RESUME ===`** (le résumé succinct).
5. **Sortie** : `{ suggestions, summary }`.

Unité pure testable : `parseIngestOutput(text) -> { suggestions, summary }` (réutilise
`parseSuggestionsBlock` + extrait le résumé). Le prompt gagne une section « RESUME » dans son
format de sortie.

## Moteur d'analyse (API ou abonnement via CLI)

L'appel au modèle passe par un **moteur** pluggable, derrière une interface commune
`runEngine(system, user) -> Promise<string>`. Deux familles :

- **API** (existant) : `ai:chat` via le client des réglages (claude/openai/ollama + clés).
  Coût par token. Adapté aux appels ponctuels.
- **Abonnement via CLI** (nouveau) : lance un outil local déjà connecté à l'abonnement de
  l'utilisateur, depuis le **process principal** (`child_process.spawn`, **args en tableau,
  pas de shell** → zéro injection), prompt passé en argument ou via stdin, sortie = stdout.
  Registre (calqué sur le Qt `CLI_ENGINES`) :
  | id | binaire | invocation | abonnement |
  |---|---|---|---|
  | `claude` | `claude` | `claude -p <prompt>` | Claude (Max/Pro) |
  | `codex` | `codex` | `codex exec <prompt>` | ChatGPT |
  | `gemini` | `gemini` | `gemini -p <prompt>` | Google |
  → **pas de facture API** (juste le forfait + ses limites). Idéal pour le gros batch (cas
  Savana, qui marchait précisément ainsi via Claude Code).

**Détection & sélection** : le main expose `wiki:detectEngines` (teste la présence des
binaires, ex. `which claude`) ; les réglages affichent les moteurs disponibles et l'auteur
**choisit le moteur d'analyse** (API provider X, ou CLI claude/codex/gemini). Si un CLI est
choisi mais absent/non connecté → message clair (« installe et connecte `claude` », etc.).

**IPC** : `wiki:runEngine({ engineId, system, user }) -> { ok, text?, error? }` côté main
(spawn API n/a — l'API reste côté renderer via `ai:chat` ; le CLI est forcément côté main).
En pratique, `runEngine` côté renderer route : API → `ai:chat` (renderer) ; CLI →
`window.electronAPI.runWikiEngine(...)` (main spawn).

## Application (selon le mode)

- **Résumé** (toujours) : écrit dans le **`synopsis`** du frontmatter du chapitre
  (`chapitres/<file>.md` via le codec chapitre + le store manuscrit). Visible dans le
  manuscrit. (Métadonnée de référence, pas de prose insérée.)
- **Mode basique (auto)** : applique chaque suggestion immédiatement :
  - `nouvelle_fiche` → `createFiche` (corps = corps proposé).
  - `ajout` → **append d'une section datée** au corps de la fiche cible + `addSourceToFiche` ;
    la section porte un **marqueur invisible** `<!-- ingest:<chapterId> -->` (pour l'annulation).
  - `incoherence` → `saveAlert` (alerte « contradiction » ouverte).
  - `wikiIO` : `appendLog`, `writeWikiIndex`, `markChapterIntegrated`.
- **Mode avancé (revue)** : `addSuggestions` (file) au lieu d'appliquer ; l'auteur
  accepte/refuse depuis le panneau droit (réutilise l'acceptation : même `applySuggestion`).

## Journal annulable

Chaque exécution (par chapitre) écrit une **entrée de log** décrivant les ops appliquées,
et l'app garde de quoi **annuler une intégration** :
- `nouvelle_fiche` → undo = supprimer la fiche créée.
- `ajout` → undo = retirer la section marquée `<!-- ingest:<chapterId> -->` du corps + retirer
  le chapitre de `sources:` si plus aucune section de ce chapitre.
- `incoherence` → undo = supprimer l'alerte créée.
- + retirer le chapitre de `integrations.json`.
Concrètement : `undoChapterIntegration(chapterId)` rejoue ces retraits (le marqueur rend le
retrait de section fiable). Exposé via un bouton « Annuler l'intégration » par chapitre
(et/ou par entrée de log). (En basique, c'est le filet de sécurité ; en avancé, l'annulation
est moins nécessaire mais reste dispo.)

## Batch

`analyzeManuscript({ mode })` :
- chapitres cibles = `flattenChapterIds(items)` filtrés par « non présents dans
  `integrations.json` » (incrémental ; option « tout réanalyser »).
- boucle séquentielle (un `ai:chat` à la fois — simple, respecte les limites provider), avec
  **barre de progression** (chapitre i/N) et **annulation possible** (stop).
- en basique : auto-applique au fil ; en avancé : empile les suggestions.
- résumé écrit pour chaque chapitre.
- à la fin : notification (N chapitres, M fiches touchées, K alertes).

## Déclencheurs UI

- **Continu** : à l'ouverture d'un chapitre, si le précédent n'est pas intégré, proposer
  « Intégrer [chapitre précédent] dans l'Univers ? » (discret, dismissible). (Réglage pour
  désactiver.)
- **Batch** : bouton « Analyser le manuscrit » dans la section Univers (à côté de « Préparer
  l'analyse approfondie »). Affiche la progression.
- **Mode** : un sélecteur Basique/Avancé (réglages ou près du bouton d'analyse).

## Architecture (unités)

- **Pur (testable `node:test`)** :
  - étendre `ingestPrompt.ts` : ajouter au format de sortie un bloc `=== RESUME ===` ;
    `parseIngestOutput(text) -> { suggestions: Suggestion[]; summary: string }`.
- **Main** :
  - IPC `wiki:detectEngines` → liste des CLI disponibles (test de présence des binaires).
  - IPC `wiki:runEngine({ engineId, prompt }) -> { ok, text?, error? }` → `child_process.spawn`
    du CLI (args en tableau, pas de shell), prompt via arg/stdin, renvoie stdout. Timeout + nettoyage.
  - Preload : `detectWikiEngines()`, `runWikiEngine(payload)`. Types dans `electron.d.ts`.
- **Renderer** :
  - `src/renderer/lib/wiki/engine.ts` : interface `runEngine(system, user): Promise<string>`
    + sélection (réglage `engineId`) ; route API → `ai:chat` ; CLI → `runWikiEngine`.
  - `src/renderer/lib/wiki/ingest.ts` : `ingestChapter(chapterId, mode)` (texte → prompt →
    `runEngine` → parse → applique/queue + résumé + log), `analyzeManuscript(mode, onProgress)`,
    `undoChapterIntegration(chapterId)`, `applySuggestion(suggestion)` (création/append/alerte).
    Utilise `wikiIO`, `wikiStore`, le client IA (`createAIClientFromStore`), et le
    `projectStore`/`editorStore` pour le texte + le synopsis.
  - écriture du `synopsis` : via le store manuscrit (mettre à jour `ManuscriptItem.synopsis`
    + persistance du chapitre) — réutiliser le chemin de sauvegarde des chapitres.
  - UI : bouton « Analyser le manuscrit » + progression + sélecteur de mode ; prompt continu
    au changement de chapitre.

## Gestion d'erreurs
- Pas de clé IA configurée → message clair (« configure un modèle dans les réglages »).
- Échec d'un appel `ai:chat` sur un chapitre → on logge, on continue le batch (le chapitre
  reste « non intégré »), notification de fin avec le nombre d'échecs.
- Sortie IA non parsable → 0 suggestion pour ce chapitre (jamais d'exception ; déjà tolérant).
- Annulation utilisateur du batch → arrêt propre, ce qui est fait reste fait (intégrations
  marquées au fur et à mesure).

## Tests
- **Purs** : `parseIngestOutput` (suggestions + RESUME ; absence de RESUME → summary vide ;
  AUCUNE SUGGESTION + RESUME ; tolérance). Le prompt contient le bloc RESUME.
- **Manuel** (sur `~/Desktop/Savana.palim`) : « Analyser le manuscrit » en basique → fiches
  créées/enrichies, résumés posés sur les chapitres, alertes pour contradictions, progression ;
  « Annuler l'intégration » d'un chapitre → ses ajouts disparaissent ; mode avancé → file de
  suggestions à valider.

## Hors périmètre (Couche 1)
- **Couche 2** (synthèse multi-lentilles : mystères/chronologie/états/thèmes/contradictions
  inter-chapitres/liens/lint) — spec séparé.
- Le panneau droit complet (revue suggestions/alertes/recherche) — slice UI à part ; ici on
  pose `addSuggestions`/`applySuggestion` + un affichage minimal pour le mode avancé.
- Interroger l'Univers (ask) — slice séparée.

## Décisions (par défaut)
- Résumé → `synopsis` du chapitre (source unique, visible manuscrit).
- Batch séquentiel (pas de parallélisme en Couche 1 ; le parallélisme arrive en Couche 2).
- Incrémental par défaut (chapitres non intégrés) ; option « tout réanalyser ».
- Marqueur de section `<!-- ingest:<chapterId> -->` pour une annulation fiable.
