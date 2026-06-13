# TDM : sections et notes comme items sous les chapitres — Design

**Date :** 2026-06-13
**Projet :** Palimpseste (Electron) — `/Users/saidimu/DEV/PROJETS/palimpseste`
**Statut :** approuvé (design)
**Branche :** `feat/stockage-markdown` (suite directe du stockage Markdown, non encore mergé)
**Voir aussi :** `docs/superpowers/specs/2026-06-13-stockage-markdown-design.md` (§3 scènes = `* * *`, §9 note sidecar), `docs/upgrade-plan-depuis-qt.md` §D/§E.

## Objectif

Dans la table des matières (panneau gauche), faire apparaître sous chaque chapitre :
- ses **sections** (les scènes, dérivées des `* * *`) comme items de **navigation** ;
- sa **note privée** comme item, ouvrant la note dans la **zone d'édition centrale**.

But : navigation intra-chapitre + accès direct à la note, sans rien changer au stockage
(chapitre = `.md`, note = sidecar `.note.md`, scènes = `* * *`).

## Principe

> Les sections et la note affichées dans la TDM sont des **enfants dérivés en rendu
> pur** : calculés au moment de l'affichage, jamais persistés comme `ManuscriptItem`.

Conséquence : aucun risque qu'un faux item fuite dans la sauvegarde ou l'export ; le
modèle en mémoire reste une liste plate de chapitres.

## Décisions actées

1. **Sections = navigation seule, dérivées.** Pas d'entité, pas de titre/métadonnée
   persisté. On ne touche pas au stockage.
2. **Comptage des sections** = nombre de nœuds `sceneBreak` (+1) dans le doc TipTap en
   mémoire du chapitre (`editorStore.documentContents[chapterId]`).
3. **Affichage conditionnel des sections** : seulement s'il y a **≥ 1** `* * *`
   (≥ 2 sections). Un chapitre sans saut n'affiche aucun enfant section.
4. **Libellé section** : « Section 1 », « Section 2 »… (numérotation simple, 1-indexée).
5. **Clic sur une section** : si le chapitre n'est pas actif, l'ouvrir ; puis **scroller**
   jusqu'au début de cette section dans l'éditeur (sélection au nœud + `scrollIntoView`).
6. **Item note affiché seulement si la note existe** (sidecar présent), conformément à
   §D (« pas de ligne Note par défaut »).
7. **Clic sur la note = vue centrale** : nouvel état `activeNoteId` dans `projectStore`
   (comme `activeSheetId`/`activeReportId`) ; `EditorArea` rend un composant `NoteEditor`.
   La **modale de note (Task 14) est retirée**.
8. **Création/suppression de note** : le menu contextuel « Note du chapitre » ouvre la
   note (vide) au centre ; sauver du contenu crée le sidecar et fait apparaître l'item ;
   vider la note supprime le sidecar (déjà le cas) et fait disparaître l'item.

## Architecture (unités)

### Détection de l'existence des notes — `projectStore`
- Nouvel état `chaptersWithNote: Set<string>` (ids de chapitres ayant un `.note.md`).
- Peuplé à l'ouverture du projet : pour chaque `chapterRefs`, un `window.electronAPI.exists`
  sur le chemin `…/<file>.note.md`. (N appels légers, en parallèle.)
- Mis à jour par `saveChapterNote(id, note)` : ajout si contenu non vide, retrait si vide.
- Action utilitaire `hasChapterNote(id): boolean` (ou lecture directe du Set).

### Vue note centrale — `projectStore` + `EditorArea` + `NoteEditor`
- `projectStore` : `activeNoteId: string | null` + `setActiveNote(id)`.
  - Poser `activeNoteId` efface `activeDocumentId`/`activeSheetId`/`activeReportId` ;
    réciproquement, `setActiveDocument`/`setActiveSheet`/`setActiveReport` effacent
    `activeNoteId` (exclusivité de la vue centrale, comme l'existant).
- `EditorArea` : si `activeNoteId` est posé, rendre `<NoteEditor chapterId={activeNoteId} />`
  (au même niveau que `SheetEditor`/`ReportViewer`), sinon le comportement actuel.
- `NoteEditor` (nouveau composant) : `textarea` simple ; charge via `loadChapterNote`,
  autosave débouncé via `saveChapterNote` ; titre « Note — <titre du chapitre> ». Pas
  d'éditeur riche (YAGNI).

### Dérivation des sections — pur, dans la TDM
- Fonction pure `countSections(docJson: string | undefined): number` (compte les
  `sceneBreak` + 1, retourne 0/1 si vide). Testable sans UI.
- `ManuscriptTreeItem` calcule, pour son chapitre, le nombre de sections depuis
  `editorStore.documentContents[chapterId]` (abonnement au store pour le live update).

### Navigation vers une section — `editorStore` + `EditorArea`
- Mécanisme de scroll : `scrollToSection(chapterId, index)` :
  - si `activeDocumentId !== chapterId`, `setActiveDocument(chapterId)` puis mémoriser une
    cible en attente (`pendingSectionScroll = { chapterId, index }`) ;
  - `EditorArea`, une fois le contenu du chapitre chargé, si une cible en attente
    correspond, calcule la position du `index`-ième début de section (après le
    `(index-1)`-ième `sceneBreak`), pose la sélection et `scrollIntoView`, puis efface la
    cible.
  - si le chapitre est déjà actif, scroller immédiatement.
- État `pendingSectionScroll` porté par `uiStore` ou `editorStore` (au choix de
  l'implémentation ; `editorStore` est le plus proche de l'éditeur).

### Rendu TDM — `Sidebar.tsx`
- Sous la ligne du chapitre (quand déplié) :
  1. les lignes « Section N » (si ≥ 2 sections), indentées `depth+1`, clic → `scrollToSection` ;
  2. la ligne « Note » (si `chaptersWithNote.has(chapterId)`), indentée `depth+1`, clic →
     `setActiveNote(chapterId)`.
- Ces lignes ne sont **pas** des `ManuscriptItem` : rendu inline, handlers dédiés.
- Le chevron déplier/replier du chapitre tient compte de ces enfants dérivés (déplié si
  sections ≥ 2 ou note présente).

## Gestion d'erreurs
- `documentContents[chapterId]` absent ou JSON invalide → 0 section (pas d'enfant), jamais
  d'exception.
- `exists` qui échoue → chapitre considéré sans note (pas d'item), non bloquant.
- Note ouverte au centre puis chapitre supprimé → `activeNoteId` effacé.

## Tests
- **`countSections`** (pur, `node:test`) : 0/1 saut → pas d'affichage ; 1 saut → 2 ;
  plusieurs sauts → n+1 ; doc vide/JSON invalide → 0.
- **Détection note** : après `saveChapterNote` non vide, `chaptersWithNote` contient l'id ;
  après vidage, ne le contient plus. (Logique store testable si extraite en util pur, sinon
  vérif manuelle.)
- **Vérif visuelle** (manuelle, `npm run launch:dev`) : sections sous un chapitre à ≥ 2
  scènes ; clic scrolle au bon endroit ; item note apparaît/disparaît avec la note ; clic
  ouvre la note au centre ; sélectionner un chapitre referme la vue note.

## Hors périmètre
- Titres/statuts/métadonnées **par section** (navigation seule).
- Éditeur riche pour la note (textarea simple).
- Réordonnancement des sections (ce sont des positions dérivées).
- Tout changement de **stockage** (chapitre `.md`, sidecar `.note.md`, manifeste inchangés).
