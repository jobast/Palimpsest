# Export du livre complet (PDF + DOCX) — Design

**Date :** 2026-06-13
**Projet :** Palimpseste (Electron) — `/Users/saidimu/DEV/PROJETS/palimpseste`
**Statut :** approuvé (design)
**Branche :** `feat/stockage-markdown` (suite du stockage Markdown + TDM, non encore mergé)
**Voir aussi :** `docs/superpowers/specs/2026-06-13-stockage-markdown-design.md`, `CLAUDE.md` (§ Export PDF, § tiptap-pagination-plus).

## Problème

Depuis le passage au stockage Markdown (un document TipTap par chapitre), l'éditeur
n'affiche qu'**un chapitre à la fois**. Or l'export lit l'éditeur visible :

- **PDF** (`exportToPdf`) capture le DOM `.ProseMirror.rm-with-pagination` (le chapitre
  actif). S'il n'y a pas de chapitre à l'écran (note/fiche/stats ouverte), il jette
  « Éditeur non trouvé ».
- **DOCX** (`exportToDocx`) itère `editor.state.doc` (le chapitre actif), d'où un fichier
  vide ou réduit à un seul chapitre.

Résultat : impossible d'exporter le **livre complet**.

## Objectif

« Exporter » produit le **manuscrit entier** (tous les chapitres, dans l'ordre du
manuscrit) en PDF et en DOCX, indépendamment de la vue ouverte au moment de l'export.

## Contrainte directrice (non négociable)

> La pagination du PDF doit correspondre **exactement** à ce que l'auteur voit à l'écran
> (identité « voir son livre »).

Le PDF actuel y parvient en capturant le DOM réellement paginé par
**tiptap-pagination-plus** (découpe sur les `.rm-pagination-gap`). Ce mécanisme est
conservé tel quel.

## Source de vérité

Tous les chapitres sont déjà en mémoire : `editorStore.documentContents`
(`Map<chapterId, jsonString>`, JSON TipTap), dans l'ordre de
`projectStore.project.manuscript.items`. L'export lit **cette source**, pas l'éditeur
visible. Avant de commencer, on *flush* le chapitre actif
(`flushCurrentDocument(activeDocumentId)`) pour que `documentContents` soit à jour.

## Décisions actées

1. **Livre complet, les deux formats** (PDF + DOCX) dans ce cycle.
2. **PDF = capture par chapitre, concaténée.** Pour chaque chapitre dans l'ordre : le
   charger dans l'éditeur, laisser pagination-plus paginer, capturer ses pages avec la
   logique de découpe existante, les ajouter au PDF.
   - **Chaque chapitre démarre sur une nouvelle page** (convention livre) ; sa pagination
     interne est **identique** à la vue solo du chapitre → garantie WYSIWYG maximale.
3. **DOCX = concaténation de tous les chapitres**, avec **saut de page avant chaque
   chapitre** (sauf le premier). Un seul `Document`, une seule section, en-têtes/pieds
   inchangés. Word reflowe (pas de WYSIWYG pagination attendu).
4. **L'export pilote l'éditeur** à travers les chapitres (défilement bref, masqué par la
   barre de progression). À la fin : restaurer le chapitre actif, le zoom, la vue.
5. **L'export fonctionne depuis n'importe quelle vue** (note/fiche/stats/placeholder) :
   il bascule sur le manuscrit et itère les chapitres lui-même.
6. **Titre une seule fois** : le nœud `chapterTitle` de chaque chapitre porte le titre
   (déjà source unique via la sync TDM↔page). Rien à régénérer côté export.

## Architecture (unités)

### `pdfExporter.ts` — découpe en deux fonctions réutilisables
- `capturePageImages(editorElement, template, quality): Promise<string[]>`
  Extrait de l'actuel `exportToPdf` : capture html2canvas + découpe sur les
  `.rm-pagination-gap` → un tableau d'images JPEG (data URLs), **une par page**, à la
  géométrie du template. Aucune création de PDF ici.
- `assembleBookPdf(pages: string[], template, project): Blob`
  Crée le `jsPDF` (format = dimensions du template, métadonnées projet) et ajoute chaque
  image de page (une page PDF par image). `pages` = concaténation, dans l'ordre, des
  pages de tous les chapitres.
- L'ancien `exportToPdf` (mono-document) est retiré ou réduit à un wrapper ; `exportToPdfSimple` (inutilisé) peut rester.

### `docxExporter.ts` — itérer tous les chapitres
- `exportToDocx({ chapterDocs, template, project, includeHeaders, includeFooters })`
  où `chapterDocs: ProseMirrorNode[]` est la liste ordonnée des docs de chapitres,
  matérialisés par l'appelant via `editor.schema.nodeFromJSON(JSON.parse(content))`.
  Pour chaque chapitre : itérer ses nœuds via `convertNodeToParagraph` (inchangé), en
  posant `pageBreakBefore: true` sur le **premier paragraphe (titre)** de chaque chapitre
  sauf le premier chapitre. Tous les paragraphes dans une seule section.
- `convertNodeToParagraph`/`extractTextRuns` restent inchangés (ils gèrent déjà
  `chapterTitle`, `paragraph`, `firstParagraph`, `sceneBreak`, `heading`, `blockquote`).

### `useExport.ts` — orchestration
- Données : `project.manuscript.items` (ordre), `editorStore.documentContents`, `editor`
  (pour `schema` et la capture), `currentTemplate`.
- **DOCX** (`exportDocx`) :
  1. `if (!editor || !project)` → erreur.
  2. `flushCurrentDocument(activeDocumentId)`.
  3. Construire `chapterDocs` : pour chaque `item` de `manuscript.items`, lire
     `documentContents.get(item.id)`, `editor.schema.nodeFromJSON(JSON.parse(...))`.
     Ignorer les chapitres sans contenu.
  4. `exportToDocx({ chapterDocs, ... })` → `downloadDocx`.
- **PDF** (`exportPdf`) :
  1. `if (!editor || !project)` → erreur.
  2. Mémoriser `activeDocumentId`, `activeNoteId`, `zoomLevel`, vue courante.
  3. `setIsExportingPdf(true)`, zoom 100 %, basculer sur le manuscrit (clore note/fiche).
  4. `flushCurrentDocument(activeDocumentId)`.
  5. Pour chaque `item` de `manuscript.items` qui a du contenu :
     a. `setActiveDocument(item.id)` ; attendre le rendu + la pagination (délai fixe,
        comme l'actuel : ~500 ms, puis forcer `contentVisibility: visible`).
     b. `editorElement = document.querySelector('.ProseMirror.rm-with-pagination')`.
        Si absent après le délai → réessayer une fois, sinon ignorer ce chapitre et
        journaliser (jamais jeter pour tout le livre).
     c. `capturePageImages(editorElement, template, quality)` → pousser dans `allPages`.
     d. Mettre à jour la progression (chapitre courant / total).
  6. `assembleBookPdf(allPages, template, project)` → `downloadPdf`.
  7. **Restaurer** : `setIsExportingPdf(false)`, zoom d'origine, `setActiveDocument`/
     `setActiveNote` d'origine.

## Gestion d'erreurs

- Aucun chapitre avec contenu → notification « Rien à exporter », pas de fichier.
- Un chapitre dont l'élément éditeur reste introuvable après réessai → ignoré + log ;
  l'export continue (on ne casse pas tout le livre pour un chapitre).
- Toute exception : restaurer l'état (vue, zoom, `isExportingPdf`) dans `finally`, afficher
  l'erreur réelle (déjà le cas dans `useExport`).
- L'autosave est neutralisé pendant l'export PDF (gardé par `isExportingPdf`) pour éviter
  des écritures fichier concurrentes pendant l'itération des chapitres.

## Tests

- **Unitaire (pur, `node:test`)** : l'assemblage de l'ordre des chapitres — une fonction
  pure `orderedChapterIds(items)` (aplatissement de la liste plate) testée pour préserver
  l'ordre et ignorer les ids sans contenu. (Le reste — capture html2canvas, docx — n'est
  pas testable hors navigateur : vérification manuelle.)
- **Vérification manuelle (`npm run launch:dev`)** :
  - Projet à plusieurs chapitres → **PDF** : contient tous les chapitres, chacun
    commençant en haut d'une page, et la pagination de chaque chapitre **correspond à sa
    vue à l'écran**.
  - **DOCX** : tous les chapitres présents, saut de page entre eux, titres uniques, gras/
    italique/sauts de scène (`* * *`) rendus.
  - Lancer l'export depuis une **vue note/fiche/stats** → fonctionne (plus d'« Éditeur non
    trouvé »), et la vue d'origine est restaurée après.

## Hors périmètre

- Moteur PDF typographique « léger » (sans html2canvas) — chantier séparé.
- Options recto/verso, page de garde, table des matières générée, numérotation par partie.
- Export d'une sélection / d'un seul chapitre (on garde l'export = livre complet).
