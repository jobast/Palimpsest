# Export PDF vectoriel print-ready (Chromium printToPDF) — Design

**Date :** 2026-06-13
**Projet :** Palimpseste (Electron) — `/Users/saidimu/DEV/PROJETS/palimpseste`
**Statut :** approuvé (design ; à implémenter)
**Branche :** `feat/stockage-markdown`
**Remplace :** l'export PDF raster (html2canvas) du cycle « export livre complet ».
**Voir aussi :** `docs/superpowers/specs/2026-06-13-export-livre-complet-design.md`, `src/main/index.ts` (`export:savePDF` existant), `CLAUDE.md`.

## Problème

L'export PDF actuel rastérise l'écran (html2canvas → image JPEG). Même à haute
résolution, le texte n'est pas **print-ready** : flou, non sélectionnable, fichiers
lourds. Une imprimerie veut du **texte vectoriel**.

## Objectif

Produire un PDF **vectoriel** du livre complet : texte net à l'infini, sélectionnable,
léger. Rendu fidèle à l'écran (même géométrie de page, même typographie), pagination de
qualité (gérée par Chromium).

## Principe

> On reconstruit le livre en **HTML + CSS print** (dérivés du template) et on laisse
> **Chromium** le rendre via `webContents.printToPDF` dans une **fenêtre cachée**.

Avantages : vectoriel, même moteur que l'éditeur (fidélité), unités CSS natives
(mm/in/cm, aucune conversion hasardeuse). Compromis accepté : la pagination est celle de
Chromium (gère veuves/orphelines) — **très proche** de l'écran car mêmes métriques, mais
pas pixel-identique à tiptap-pagination-plus. Choix validé par l'utilisateur (priorité =
print-ready vectoriel).

## Décisions actées

1. **PDF = livre complet**, tous les chapitres dans l'ordre du manuscrit.
2. **Rendu vectoriel via Chromium** (`printToPDF`), pas de raster.
3. **Source** : `editorStore.documentContents` (JSON TipTap par chapitre) + ordre
   `manuscript.items` (réutilise `flattenChapterIds`). Flush du chapitre actif d'abord.
4. **Chaque chapitre démarre sur une nouvelle page** (`break-before: page`, sauf le 1er).
5. **Géométrie via CSS** (`@page { size; margin }`, `preferCSSPageSize: true`) en unités
   natives du template.
6. **Typographie du template** : police, taille, interligne, justification, retrait de
   1ère ligne (sauf `firstParagraph`), titre centré gras, saut de scène `* * *` centré.
7. **En-têtes/pieds conservés selon le template** : running heads (auteur/titre) + numéro
   de page sur chaque page, via `displayHeaderFooter` + `headerTemplate`/`footerTemplate`
   de Chromium (tokens `.pageNumber`, et auteur/titre injectés en littéral).
8. **Le raster est retiré** : `capturePageImages`/`assembleBookPdf`/`exportToPdf` (et
   l'usage de html2canvas/jsPDF pour le PDF) supprimés. **DOCX inchangé.**
9. **Téléchargement** : le main renvoie le Buffer PDF ; le renderer le sauvegarde (Blob →
   `downloadPdf`, même UX que DOCX). (`export:savePDF` par dialog reste dispo, non requis.)

## Architecture (unités)

### `docToPrintHtml(doc)` — pur, testable (`src/shared/export/printHtml.ts`)
Convertit le JSON TipTap d'un chapitre → fragment HTML (chaîne). Mapping :
- `chapterTitle` → `<h1 class="chapter-title">…</h1>`
- `firstParagraph` → `<p class="first-paragraph">…</p>`
- `paragraph` → `<p>…</p>` (respecte `attrs.textAlign` → `style="text-align:…"`)
- `sceneBreak` → `<p class="scene-break">* * *</p>`
- `heading` (level 1-3) → `<h1|h2|h3>`
- marque `bold` → `<strong>`, `italic` → `<em>`
- `hardBreak` → `<br>`
- texte : **échappement HTML** (`& < >`), typographie française (« » … U+202F) conservée.
- nœud inconnu → repli `<p>` avec son texte (anti-perte).

### `buildBookHtml(chapterHtmls, template, project)` — `src/shared/export/printHtml.ts`
Assemble un document HTML autonome :
- `<head>` : `<meta charset>`, `<style>` avec la **CSS print dérivée du template** :
  - `@page { size: <width> <height>; margin: <top> <right> <bottom> <left>; }`
  - `body { font-family; font-size; line-height; color:#000; }`
  - `p { text-align: justify; text-indent: <firstLineIndent>; margin: 0; }`
  - `.first-paragraph { text-indent: 0; }`
  - `.chapter-title { text-align:center; font-weight:bold; margin: <space> 0; break-after: avoid; }`
  - `.chapter + .chapter { break-before: page; }` (nouvelle page entre chapitres ; le 1er ne casse pas)
  - `.scene-break { text-align:center; margin: 1em 0; }`
- `<body>` : pour chaque chapitre, `<section class="chapter">` + son HTML.
- Fonction pure → testable (présence des règles, ordre des chapitres, échappement).

### Main — `ipcMain.handle('export:printBookPdf', …)` (`src/main/index.ts`)
- Reçoit `{ html, headerTemplate, footerTemplate, displayHeaderFooter }`.
- Crée une **`BrowserWindow` cachée** (`show:false`), écrit `html` dans un fichier temp
  (`app.getPath('temp')`), `await win.loadFile(tmp)`, attend `did-finish-load`.
- `await win.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true,
  displayHeaderFooter, headerTemplate, footerTemplate })` → `Buffer`.
- Ferme la fenêtre, supprime le temp. Renvoie `{ success, data }` (Buffer) ou `{ success:false, error }`.
- Preload : exposer `printBookPdf(payload)`. Type dans `electron.d.ts`.

### En-têtes/pieds — construits côté renderer depuis le template
- `headerTemplate` : si `template.header?.show`, HTML avec `font-size` inline (sinon
  Chromium met une taille minuscule), marges latérales, contenu = `template.header.content`
  où `{author}`→`project.meta.author`, `{title}`→`project.meta.name`, `{page}`→
  `<span class="pageNumber"></span>`. Si pas de header → `headerTemplate:'<span></span>'` +
  `displayHeaderFooter` selon header OU footer.
- `footerTemplate` : si `template.footer?.show` et `showPageNumber` → numéro centré
  (`<span class="pageNumber"></span>`), `font-size` inline.
- `displayHeaderFooter = !!(header?.show || footer?.show)`.

### `useExport.exportPdf` réécrit (`src/renderer/hooks/useExport.ts`)
1. `if (!editor || !project)` → erreur.
2. `flushCurrentDocument(activeDocumentId)`.
3. `chapterHtmls = flattenChapterIds(items).map(id => documentContents.get(id)).filter(Boolean)
   .map(json => docToPrintHtml(JSON.parse(json)))`. Si vide → « Rien à exporter ».
4. `html = buildBookHtml(chapterHtmls, currentTemplate, project)`.
5. header/footer templates depuis `currentTemplate` + `project`.
6. IPC `printBookPdf({ html, headerTemplate, footerTemplate, displayHeaderFooter })`.
7. `new Blob([data], {type:'application/pdf'})` → `downloadPdf(blob, \`${project.meta.name}.pdf\`)`.
8. Gestion d'erreur : afficher l'erreur réelle remontée par le main.

> Pas de pilotage de l'éditeur, pas de `isExportingPdf`/zoom : le rendu se fait dans la
> fenêtre cachée à partir de `documentContents`. L'export marche depuis n'importe quelle
> vue, sans rien perturber. (On peut donc retirer la logique de restauration de vue propre
> au raster.)

## Gestion d'erreurs
- Aucun chapitre avec contenu → « Rien à exporter », pas de fichier.
- Échec `loadFile`/`printToPDF` → `{success:false,error}` ; le renderer affiche l'erreur ;
  la fenêtre cachée et le fichier temp sont nettoyés dans un `finally`.
- Polices du template non installées → fallback de la stack (Georgia/serif…), comme à
  l'écran. Acceptable.

## Tests
- **`docToPrintHtml`** (`node:test`) : titre→h1.chapter-title, firstParagraph, paragraph
  (+ textAlign), sceneBreak→`* * *`, gras/italique→strong/em, échappement `<&>`, typo
  française conservée, nœud inconnu non perdu.
- **`buildBookHtml`** (`node:test`) : contient `@page` avec les dimensions/marges du
  template ; `break-before: page` entre chapitres ; police/taille/interligne injectées ;
  ordre des chapitres préservé ; 1er chapitre sans saut de page.
- **Vérification manuelle** (utilisateur, au réveil) : PDF net (texte vectoriel
  sélectionnable), chapitres sur nouvelles pages, en-tête auteur/titre + numéro sur chaque
  page, marges correctes, accents/guillemets corrects.

## Hors périmètre
- EPUB (cycle séparé).
- Page de garde, table des matières générée, recto-verso, sauts de page manuels intra-chapitre.
- Égalité pixel-parfaite avec la pagination écran (assumé : Chromium pagine).
