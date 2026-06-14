# Section « Univers » + éditeur de fiche (W-FE, slices 1+2) — Design

**Date :** 2026-06-14
**Projet :** Palimpseste (Electron) — `/Users/saidimu/DEV/PROJETS/palimpseste`
**Statut :** approuvé (design ; à implémenter)
**Branche :** `feat/wiki`
**Voir aussi :** `docs/superpowers/specs/2026-06-14-wiki-master-design.md` (cœur wiki), recherche Savana/Qt. Cœur déjà implémenté : `src/shared/wiki/*` (fiches, liens, recherche, etc.) + `src/renderer/lib/wiki/wikiIO.ts`.

## Nom

La section visible s'appelle **« Univers »** (l'univers de référence du roman). En interne, le
stockage reste `<projet>.palim/wiki/...` et les modules `src/shared/wiki` — on ne renomme
pas le code/dossiers, seulement le **libellé d'interface**.

## Portée de ce design (slices 1+2)

1. **Coquille de la section Univers** : un commutateur **Écriture / Univers** ; en mode
   Univers, une disposition 3 volets (gauche = navigation des fiches par catégorie ; centre =
   éditeur de fiche ; droite = réservée, vide pour l'instant) ; ouvrir/créer/supprimer une
   fiche.
2. **Éditeur de fiche (W-FE)** au centre : en-tête (titre + catégorie), champs structurés
   (carte pour un lieu, etc.), corps Markdown éditable (autosave), backlinks.
   **Édition manuelle uniquement** dans ce design.

**Hors périmètre (slices suivantes, déjà cadrées dans le master) :** les **actions IA** sur
la fiche (Compléter / Vérifier incohérences / Sourcer / Condenser), l'**orchestration IA
live** (ingest, ask_bible), le **panneau droit** (dashboards mystères/thèmes, suggestions,
alertes, recherche, graphe), le **compagnon IA** du mode Écriture, la **migration
sheets→fiches** (mapping pur déjà fait, action store à venir).

## Architecture

Le centre de l'app suit déjà le motif « une vue centrale selon l'état actif »
(`EditorArea` choisit selon `activeNoteId`/`activeSheetId`/`activeReportId`/`activeDocumentId`).
On ajoute une dimension de plus haut niveau : la **section active**.

### État (uiStore)
- `activeSection: 'ecriture' | 'univers'` (défaut `'ecriture'`), + `setActiveSection`.
- Persisté localement comme les autres préférences UI.

### État (nouveau store wiki renderer : `src/renderer/stores/wikiStore.ts`)
Store Zustand qui charge et tient l'état du wiki en mémoire, par-dessus `wikiIO` :
- `fiches: Fiche[]`, `activeFicheKey: string | null` (`<category>/<slug>`), `isLoading`.
- `loadWiki(projectPath)` → `fiches = await loadFiches(projectPath)`.
- `setActiveFiche(key)`, `getActiveFiche(): Fiche | null`.
- `saveFiche(fiche)` (débouncé via l'appelant ; écrit via `wikiIO.saveFiche` + met à jour le tableau).
- `createFiche(category, title)` (via `wikiIO.createFiche`, ajoute, active).
- `deleteFiche(fiche)` (via `wikiIO.deleteFiche`, retire, désactive).
- Chargé à l'ouverture d'un projet (brancher dans les 3 chemins d'ouverture du projectStore,
  ou paresseux au 1er passage en mode Univers — voir Décisions).

### Disposition (Layout)
- Un **commutateur de section** (onglets « Écriture » / « Univers ») dans la barre supérieure
  (Toolbar/Layout). `setActiveSection`.
- `Layout` rend selon `activeSection` :
  - `'ecriture'` : l'agencement actuel (Sidebar + EditorArea), inchangé.
  - `'univers'` : `UniversLayout` = `FicheNavigator` (gauche) + `FicheEditor` (centre) +
    panneau droit réservé (placeholder vide, pour la slice 4).

### Composants (nouveaux, `src/renderer/components/univers/`)
- `UniversLayout.tsx` — agencement 3 volets de la section.
- `FicheNavigator.tsx` — liste les fiches par catégorie (depuis `wikiStore.fiches`), repli par
  catégorie, sélection → `setActiveFiche`, bouton « + » par catégorie (créer), menu
  contextuel (renommer/supprimer). (Calque sur `Sidebar`/`ManuscriptTreeItem`.)
- `FicheEditor.tsx` — l'éditeur de fiche (centre) :
  - **En-tête** : titre éditable (met à jour `fiche.title`) + badge catégorie.
  - **Champs structurés** : rendus selon `fiche.category`, lus/écrits dans `fiche.meta` :
    - `lieux` : carte + coordonnées (réutiliser `MapPicker` de `LocationSheetEditor`,
      `meta.coordinates`/`meta.mapZoom`) + `significance`/`sensoryDetails` (champs texte).
    - `personnages` : `role` (select), `relationships`, `physicalDescription`,
      `backstory`/`goals`/`flaws` (champs texte).
    - autres catégories : pas de champ structuré (corps seul).
    Implémentation : un petit composant `FicheStructuredFields` qui prend `(fiche, onChange)`.
  - **Corps** : `textarea` Markdown, autosave débouncé (modèle `NoteEditor`).
  - **Backlinks** : liste des fiches pointant vers celle-ci (`backlinks(fiche, fiches)` de
    `@shared/wiki`), cliquables → `setActiveFiche`.

### Flux de données
- Passage en mode Univers → `wikiStore.loadWiki(projectPath)` si pas déjà chargé.
- Sélection d'une fiche → `setActiveFiche` → `FicheEditor` affiche `getActiveFiche()`.
- Édition (titre, champ structuré, corps) → maj de l'objet `Fiche` en mémoire → autosave
  débouncé → `wikiIO.saveFiche` (sérialise via `serializeFiche` : corps + frontmatter avec
  `meta`). Le titre/slug : le slug **ne change pas** au renommage (stable, comme les chapitres) ;
  seul `title` (frontmatter) change. (Création = slug dérivé du titre, unique.)
- Suppression → `wikiIO.deleteFiche` (journal de sauvegarde → restaurable).

## Gestion d'erreurs
- Aucun projet ouvert → la section Univers affiche un état vide (« Ouvrez un projet »).
- `wiki/` absent → `loadFiches` renvoie `[]` (déjà tolérant) → navigateur vide + bouton créer.
- Fiche illisible → ignorée au chargement (déjà géré par `parseFiche` tolérant).
- Autosave : en cas d'échec d'écriture, notification non bloquante (réutiliser `statsStore.showNotification`).

## Tests
- **Pur (déjà couvert)** : codecs/liens/recherche (`src/shared/wiki/*` — 89 tests).
- **Nouveau, testable** : extraire la logique de regroupement par catégorie / tri du
  navigateur en util pur si pertinent (sinon vérif manuelle). Le store `wikiStore` et les
  composants React = **vérification manuelle** (pas de harnais renderer) :
  - basculer Écriture↔Univers ; créer une fiche perso et une fiche lieu ; éditer le corps →
    rouvrir le projet → persisté en `wiki/<cat>/<slug>.md` ; pour un lieu, poser une position
    sur la carte → `meta.coordinates` persiste ; backlinks corrects entre deux fiches
    `[[…]]` ; supprimer une fiche (et la restaurer via `.recovery` si besoin).
  - l'écriture (mode Écriture) reste **inchangée**.

## Décisions (par défaut, ajustables)
- **Chargement du wiki** : paresseux au 1er passage en mode Univers (évite le coût à
  l'ouverture des projets sans wiki). Rechargé si `projectPath` change.
- **Éditeur de corps** : `textarea` Markdown (choix utilisateur), autosave 500 ms.
- **Champs structurés** : on câble la **carte des lieux** (valeur phare) + champs texte
  simples pour le reste ; pas de refonte des éditeurs de sheets existants (réutilisation de
  `MapPicker`).
- **Renommage** : édite `title` (frontmatter) ; le fichier/slug reste stable.

## Hors périmètre (rappel)
Actions IA, orchestration IA live, panneau droit (dashboards/suggestions/alertes/recherche/
graphe), compagnon IA mode Écriture, action de migration sheets→fiches.
