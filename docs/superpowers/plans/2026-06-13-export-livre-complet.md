# Export du livre complet (PDF + DOCX) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exporter le manuscrit entier (tous les chapitres dans l'ordre) en PDF et DOCX, en préservant pour le PDF une pagination identique à l'écran.

**Architecture:** L'export lit la source de vérité en mémoire (`editorStore.documentContents`, un JSON TipTap par chapitre) dans l'ordre de `manuscript.items`, au lieu de l'éditeur visible. Le PDF capture chaque chapitre via le pipeline html2canvas existant (un chapitre = de nouvelles pages, pagination interne identique à la vue solo) puis concatène. Le DOCX matérialise chaque chapitre via `editor.schema.nodeFromJSON` et enchaîne les paragraphes avec un saut de page entre chapitres.

**Tech Stack:** React 18, TipTap 2 (`@tiptap/pm/model`), html2canvas + jsPDF, `docx`, Zustand 4, `node:test`. Branche `feat/stockage-markdown`.

**Environnement :** node via nvm — préfixer toute commande par `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`. Build : `npm run build`. Tests : `npm run test:main` (actuellement 43 verts). Imports relatifs dans `src/shared/` avec extension `.js` (ESM/Node 22).

**Note de testabilité :** seul l'ordonnancement des chapitres est testable hors navigateur (Task 1, TDD). Le reste (html2canvas, docx, pilotage de l'éditeur) n'a pas de harnais de test renderer — vérifié par `npm run build` + une passe manuelle (Task 5). Les étapes de code donnent le code exact.

---

## Structure des fichiers

**Créés :**
- `src/shared/manuscript/order.ts` — `flattenChapterIds(items)` pur (ordre des chapitres).
- `src/main/__tests__/manuscript.order.test.ts` — tests de `flattenChapterIds`.

**Modifiés :**
- `src/renderer/lib/export/pdfExporter.ts` — extraire `capturePageImages` + `assembleBookPdf` ; `exportToPdf` devient un wrapper.
- `src/renderer/lib/export/docxExporter.ts` — `exportToDocx` prend une liste de docs de chapitres + saut de page entre chapitres.
- `src/renderer/hooks/useExport.ts` — orchestration livre complet (PDF boucle de capture, DOCX concaténation), restauration de la vue/zoom.
- `src/renderer/App.tsx` — neutraliser l'autosave pendant l'export PDF.

---

### Task 1 : `flattenChapterIds` (util pur) + test

**Files:**
- Create: `src/shared/manuscript/order.ts`
- Test: `src/main/__tests__/manuscript.order.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/main/__tests__/manuscript.order.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { flattenChapterIds } from '../../shared/manuscript/order.js'
import type { ManuscriptItem } from '../../shared/types/project.js'

const chapter = (id: string, children?: ManuscriptItem[]): ManuscriptItem => ({
  id, type: 'chapter', title: id, status: 'draft', wordCount: 0, children
})

test('flat list preserves order', () => {
  const items = [chapter('a'), chapter('b'), chapter('c')]
  assert.deepEqual(flattenChapterIds(items), ['a', 'b', 'c'])
})

test('nested children are flattened depth-first in order', () => {
  const items = [chapter('a', [chapter('a1'), chapter('a2')]), chapter('b')]
  assert.deepEqual(flattenChapterIds(items), ['a', 'a1', 'a2', 'b'])
})

test('empty list yields empty array', () => {
  assert.deepEqual(flattenChapterIds([]), [])
})
```

- [ ] **Step 2 : Lancer le test pour vérifier l'échec**

Run : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run test:main`
Expected : FAIL — module `order.js` introuvable.

- [ ] **Step 3 : Écrire l'implémentation**

Créer `src/shared/manuscript/order.ts` :
```typescript
import type { ManuscriptItem } from '../types/project.js'

/**
 * Ordered list of chapter ids (pre-order traversal). The model is flat today,
 * but children are flattened in order for robustness.
 */
export function flattenChapterIds(items: ManuscriptItem[]): string[] {
  const ids: string[] = []
  const walk = (list: ManuscriptItem[]) => {
    for (const item of list) {
      ids.push(item.id)
      if (item.children && item.children.length > 0) walk(item.children)
    }
  }
  walk(items)
  return ids
}
```

- [ ] **Step 4 : Lancer le test pour vérifier le succès**

Run : `npm run test:main`
Expected : PASS (3 nouveaux tests + 43 existants → 46 total).

- [ ] **Step 5 : Commit**
```bash
git add src/shared/manuscript/order.ts src/main/__tests__/manuscript.order.test.ts
git commit -m "feat(export): flattenChapterIds ordered traversal helper"
```

---

### Task 2 : pdfExporter — `capturePageImages` + `assembleBookPdf`

**Files:**
- Modify: `src/renderer/lib/export/pdfExporter.ts`

> But : séparer la **capture d'un élément éditeur en images de pages** (réutilisable par chapitre) de l'**assemblage du PDF final**. `exportToPdf` devient un wrapper pour ne rien casser.

- [ ] **Step 1 : Ajouter `capturePageImages`**

Dans `pdfExporter.ts`, ajouter cette fonction exportée (elle reprend la logique de capture+découpe de l'actuel `exportToPdf`, mais retourne les images au lieu de construire un PDF) :
```typescript
/**
 * Capture a paginated editor element into one JPEG data URL per page,
 * each at the template's page pixel geometry. WYSIWYG: slices on the real
 * tiptap-pagination-plus gaps, exactly as shown on screen.
 */
export async function capturePageImages(
  editorElement: HTMLElement,
  template: PageTemplate,
  quality: 'draft' | 'standard' | 'high' = 'standard'
): Promise<string[]> {
  const pageWidthPx = convertToPixels(template.page.width)
  const pageHeightPx = convertToPixels(template.page.height)
  const scaleFactors = { draft: 1, standard: 2, high: 3 }
  const scale = scaleFactors[quality]

  const paginationGaps = Array.from(editorElement.querySelectorAll('.rm-pagination-gap')) as HTMLElement[]
  const totalPages = Math.max(1, paginationGaps.length + 1)

  // Resolve colors from the originals before cloning (html2canvas can't read CSS vars).
  const originalElements = Array.from(editorElement.querySelectorAll('*'))
  const colorMap = new Map<number, string>()
  const bgColorMap = new Map<number, string>()
  originalElements.forEach((el, index) => {
    const computed = getComputedStyle(el)
    colorMap.set(index, computed.color)
    bgColorMap.set(index, computed.backgroundColor)
  })

  const fullCanvas = await html2canvas(editorElement, {
    scale,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: editorElement.scrollWidth,
    height: editorElement.scrollHeight,
    windowWidth: editorElement.scrollWidth,
    windowHeight: editorElement.scrollHeight,
    onclone: (_clonedDoc, clonedElement) => {
      clonedElement.style.backgroundColor = '#ffffff'
      const clonedElements = Array.from(clonedElement.querySelectorAll('*'))
      clonedElements.forEach((el, index) => {
        const htmlEl = el as HTMLElement
        const resolvedColor = colorMap.get(index)
        const resolvedBgColor = bgColorMap.get(index)
        if (resolvedColor) htmlEl.style.color = resolvedColor
        if (resolvedBgColor && resolvedBgColor !== 'rgba(0, 0, 0, 0)') {
          htmlEl.style.backgroundColor = resolvedBgColor
        }
        htmlEl.style.contentVisibility = 'visible'
        htmlEl.style.visibility = 'visible'
      })
      const gaps = Array.from(clonedElement.querySelectorAll('.rm-pagination-gap'))
      for (const gap of gaps) {
        const gapEl = gap as HTMLElement
        gapEl.style.backgroundColor = '#ffffff'
        gapEl.style.borderColor = '#ffffff'
      }
    }
  })

  const editorRect = editorElement.getBoundingClientRect()
  const pageRegions: { startY: number; endY: number }[] = []
  for (let i = 0; i < totalPages; i++) {
    let startY: number
    let endY: number
    if (i === 0) {
      startY = 0
    } else {
      const prevGap = paginationGaps[i - 1]
      const breaker = prevGap.closest('.breaker') as HTMLElement | null
      if (breaker) {
        const breakerRect = breaker.getBoundingClientRect()
        startY = breakerRect.bottom - editorRect.top + editorElement.scrollTop
      } else {
        const prevGapRect = prevGap.getBoundingClientRect()
        startY = prevGapRect.bottom - editorRect.top + editorElement.scrollTop
      }
    }
    if (i < paginationGaps.length) {
      const gap = paginationGaps[i]
      const breaker = gap.closest('.breaker') as HTMLElement | null
      if (breaker) {
        const breakerRect = breaker.getBoundingClientRect()
        endY = breakerRect.top - editorRect.top + editorElement.scrollTop
      } else {
        const gapRect = gap.getBoundingClientRect()
        endY = gapRect.top - editorRect.top + editorElement.scrollTop
      }
    } else {
      endY = editorElement.scrollHeight
    }
    pageRegions.push({ startY, endY })
  }

  const images: string[] = []
  for (let i = 0; i < totalPages; i++) {
    const region = pageRegions[i]
    const regionHeight = Math.max(1, region.endY - region.startY)
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = pageWidthPx * scale
    pageCanvas.height = pageHeightPx * scale
    const ctx = pageCanvas.getContext('2d')
    if (!ctx) continue
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
    const srcY = region.startY * scale
    const srcHeight = regionHeight * scale
    const srcWidth = fullCanvas.width
    const editorWidthPx = editorElement.scrollWidth
    const widthScale = pageWidthPx / editorWidthPx
    const destWidth = pageCanvas.width
    const destHeight = (srcHeight / scale) * widthScale * scale
    ctx.drawImage(fullCanvas, 0, srcY, srcWidth, srcHeight, 0, 0, destWidth, destHeight)
    images.push(pageCanvas.toDataURL('image/jpeg', 0.92))
  }
  return images
}
```

- [ ] **Step 2 : Ajouter `assembleBookPdf`**

Ajouter aussi :
```typescript
/**
 * Assemble one JPEG-per-page (across all chapters, in order) into a single PDF
 * at the template's page size.
 */
export function assembleBookPdf(pages: string[], template: PageTemplate, project: Project): Blob {
  const pageWidthMm = pxToMm(convertToPixels(template.page.width))
  const pageHeightMm = pxToMm(convertToPixels(template.page.height))
  const pdf = new jsPDF({
    orientation: pageWidthMm > pageHeightMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pageWidthMm, pageHeightMm]
  })
  pdf.setProperties({
    title: project.meta.name,
    author: project.meta.author,
    creator: 'Palimpseste',
    subject: `Manuscrit: ${project.meta.name}`
  })
  pages.forEach((img, i) => {
    if (i > 0) pdf.addPage([pageWidthMm, pageHeightMm])
    pdf.addImage(img, 'JPEG', 0, 0, pageWidthMm, pageHeightMm)
  })
  return pdf.output('blob')
}
```

- [ ] **Step 3 : Réécrire `exportToPdf` en wrapper**

Remplacer le corps de l'actuel `exportToPdf` (tout le bloc entre `export async function exportToPdf(options: PdfExportOptions): Promise<Blob> {` et son `}` final, lignes ~34-236) par :
```typescript
export async function exportToPdf(options: PdfExportOptions): Promise<Blob> {
  const { editorElement, template, project, quality = 'standard' } = options
  const pages = await capturePageImages(editorElement, template, quality)
  return assembleBookPdf(pages, template, project)
}
```
Conserver l'interface `PdfExportOptions` (le champ `onProgress?` reste, simplement inutilisé ici). Conserver `exportToPdfSimple`, `downloadPdf`, `pxToMm` tels quels.

- [ ] **Step 4 : Vérifier compilation + tests**

Run : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`
Expected : build OK (pas de variable inutilisée), 46 tests verts.

- [ ] **Step 5 : Commit**
```bash
git add src/renderer/lib/export/pdfExporter.ts
git commit -m "refactor(export): split PDF capture (per element) from book assembly"
```

---

### Task 3 : docxExporter — multi-chapitres + sauts de page

**Files:**
- Modify: `src/renderer/lib/export/docxExporter.ts`

> But : `exportToDocx` reçoit la liste ordonnée des docs de chapitres (nœuds ProseMirror) et concatène, avec un saut de page avant chaque chapitre sauf le premier.

- [ ] **Step 1 : Mettre à jour les imports**

En tête de `docxExporter.ts`, ajouter `PageBreak` à l'import `docx` et le type Node :
```typescript
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  Packer,
  PageBreak,
  convertInchesToTwip,
  IRunOptions
} from 'docx'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
```
(Retirer `import type { Editor } from '@tiptap/react'` s'il devient inutilisé après l'étape suivante.)

- [ ] **Step 2 : Nouvelle signature + concaténation**

Remplacer l'interface `DocxExportOptions` et le début de `exportToDocx` (lignes ~25-53, jusqu'à la fin de la boucle `editor.state.doc.forEach`) par :
```typescript
export interface DocxExportOptions {
  /** Ordered chapter documents (ProseMirror doc nodes), one per chapter. */
  chapterDocs: ProseMirrorNode[]
  template: PageTemplate
  project: Project
  includeHeaders?: boolean
  includeFooters?: boolean
}

/**
 * Export the whole manuscript to DOCX: every chapter concatenated in order,
 * with a page break before each chapter except the first.
 */
export async function exportToDocx(options: DocxExportOptions): Promise<Blob> {
  const {
    chapterDocs,
    template,
    project,
    includeHeaders = true,
    includeFooters = true
  } = options

  const children: Paragraph[] = []

  chapterDocs.forEach((chapterDoc, chapterIndex) => {
    if (chapterIndex > 0) {
      // New chapter starts on a new page.
      children.push(new Paragraph({ children: [new PageBreak()] }))
    }
    chapterDoc.forEach((node) => {
      const paragraph = convertNodeToParagraph(node, template)
      if (paragraph) {
        children.push(paragraph)
      }
    })
  })
```
Le reste de `exportToDocx` (création header/footer, dimensions, `new Document({...})`, `return await Packer.toBlob(doc)`) reste **inchangé**. `convertNodeToParagraph` et `extractTextRuns` restent **inchangés** (un nœud ProseMirror satisfait leur signature structurelle, et ils gèrent déjà `chapterTitle`/`paragraph`/`firstParagraph`/`sceneBreak`/`heading`/`blockquote`).

- [ ] **Step 3 : Vérifier compilation + tests**

Run : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`
Expected : build échouera d'abord sur l'appelant `useExport.ts` (ancienne signature `{editor}`) — c'est attendu, corrigé en Task 4. Pour valider Task 3 isolément, vérifier qu'il n'y a **pas** d'erreur DANS `docxExporter.ts` lui-même (les seules erreurs doivent pointer vers `useExport.ts`).

- [ ] **Step 4 : Commit**
```bash
git add src/renderer/lib/export/docxExporter.ts
git commit -m "feat(export): DOCX concatenates all chapters with page breaks"
```

---

### Task 4 : useExport — orchestration livre complet + gating autosave

**Files:**
- Modify: `src/renderer/hooks/useExport.ts`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1 : Mettre à jour les imports de `useExport.ts`**

En tête, ajuster les imports d'export et ajouter le helper d'ordre :
```typescript
import {
  exportToDocx,
  downloadDocx
} from '@/lib/export'
import { capturePageImages, assembleBookPdf, downloadPdf } from '@/lib/export/pdfExporter'
import { flattenChapterIds } from '@shared/manuscript/order'
```
(`exportToPdf` n'est plus importé ici.)

- [ ] **Step 2 : Réécrire `exportDocx`**

Remplacer le corps de `exportDocx` (le `useCallback`, lignes ~35-83) par :
```typescript
  const exportDocx = useCallback(async () => {
    if (!editor || !project) {
      setState(s => ({ ...s, error: 'Éditeur ou projet non disponible' }))
      return
    }
    setState({ isExporting: true, progress: 0, format: 'docx', error: null })
    try {
      // Flush the active chapter so its latest edits are in documentContents.
      useEditorStore.getState().flushCurrentDocument(useProjectStore.getState().activeDocumentId)
      const { documentContents } = useEditorStore.getState()
      const chapterDocs = flattenChapterIds(project.manuscript.items)
        .map(id => documentContents.get(id))
        .filter((c): c is string => !!c)
        .map(json => editor.schema.nodeFromJSON(JSON.parse(json)))

      if (chapterDocs.length === 0) {
        setState({ isExporting: false, progress: 0, format: null, error: 'Rien à exporter' })
        return
      }

      setState(s => ({ ...s, progress: 40 }))
      const blob = await exportToDocx({
        chapterDocs,
        template: currentTemplate,
        project,
        includeHeaders: true,
        includeFooters: true
      })
      setState(s => ({ ...s, progress: 80 }))
      await downloadDocx(blob, `${project.meta.name}.docx`)
      setState(s => ({ ...s, progress: 100 }))
      setTimeout(() => {
        setState({ isExporting: false, progress: 0, format: null, error: null })
      }, 1000)
    } catch (error) {
      console.error('DOCX export failed:', error)
      setState({
        isExporting: false,
        progress: 0,
        format: null,
        error: `Échec de l'export DOCX: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      })
    }
  }, [editor, currentTemplate, project])
```

- [ ] **Step 3 : Réécrire `exportPdf`**

Remplacer le corps de `exportPdf` (le `useCallback`, lignes ~89-189) par :
```typescript
  const exportPdf = useCallback(async () => {
    if (!editor || !project) {
      setState(s => ({ ...s, error: 'Éditeur ou projet non disponible' }))
      return
    }

    const { setIsExportingPdf, zoomLevel, setZoomLevel } = useUIStore.getState()
    const originalZoom = zoomLevel
    const originalDocId = useProjectStore.getState().activeDocumentId
    const originalNoteId = useProjectStore.getState().activeNoteId

    setState({ isExporting: true, progress: 0, format: 'pdf', error: null })

    try {
      setIsExportingPdf(true)
      if (zoomLevel !== 100) setZoomLevel(100)

      // Flush the active chapter, then collect chapters that have content.
      useEditorStore.getState().flushCurrentDocument(originalDocId)
      const { documentContents } = useEditorStore.getState()
      const ids = flattenChapterIds(project.manuscript.items)
        .filter(id => !!documentContents.get(id))

      if (ids.length === 0) {
        setState({ isExporting: false, progress: 0, format: null, error: 'Rien à exporter' })
        return
      }

      const allPages: string[] = []
      for (let i = 0; i < ids.length; i++) {
        // Load this chapter into the editor and let pagination settle.
        useProjectStore.getState().setActiveDocument(ids[i])
        await new Promise(resolve => setTimeout(resolve, 600))

        let editorElement = document.querySelector('.ProseMirror.rm-with-pagination') as HTMLElement | null
        if (!editorElement) {
          // One retry — the editor may still be mounting.
          await new Promise(resolve => setTimeout(resolve, 600))
          editorElement = document.querySelector('.ProseMirror.rm-with-pagination') as HTMLElement | null
        }
        if (!editorElement) {
          console.warn('Chapitre ignoré (éditeur introuvable):', ids[i])
          continue
        }

        // Force visibility (defeat virtualization) before capture.
        editorElement.style.contentVisibility = 'visible'
        editorElement.querySelectorAll('.rm-page-break').forEach(pb => {
          (pb as HTMLElement).style.contentVisibility = 'visible'
        })
        await new Promise(resolve => setTimeout(resolve, 200))

        const pages = await capturePageImages(editorElement, currentTemplate, 'standard')
        allPages.push(...pages)
        setState(s => ({ ...s, progress: Math.round(((i + 1) / ids.length) * 90) }))
      }

      if (allPages.length === 0) {
        throw new Error('Aucune page capturée')
      }

      const blob = assembleBookPdf(allPages, currentTemplate, project)
      setState(s => ({ ...s, progress: 95 }))
      await downloadPdf(blob, `${project.meta.name}.pdf`)
      setState(s => ({ ...s, progress: 100 }))
      setTimeout(() => {
        setState({ isExporting: false, progress: 0, format: null, error: null })
      }, 1000)
    } catch (error) {
      console.error('PDF export failed:', error)
      setState({
        isExporting: false,
        progress: 0,
        format: null,
        error: `Échec de l'export PDF: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      })
    } finally {
      // Restore virtualization, zoom and the original view.
      setIsExportingPdf(false)
      if (originalZoom !== 100) setZoomLevel(originalZoom)
      if (originalNoteId) {
        useProjectStore.getState().setActiveNote(originalNoteId)
      } else if (originalDocId) {
        useProjectStore.getState().setActiveDocument(originalDocId)
      }
    }
  }, [editor, currentTemplate, project])
```

- [ ] **Step 4 : Neutraliser l'autosave pendant l'export PDF (App.tsx)**

Dans `src/renderer/App.tsx`, l'effet d'autosave (vers la ligne 65-81) déclenche `saveProject()` sur intervalle. Lire `isExportingPdf` du `uiStore` et l'exclure. Repérer la lecture du uiStore existante (ex. `const autoSaveEnabled = ...`) et ajouter :
```typescript
  const isExportingPdf = useUIStore(state => state.isExportingPdf)
```
(si `useUIStore` n'est pas importé, l'importer : `import { useUIStore } from './stores/uiStore'`). Puis dans le `setInterval` de l'autosave, remplacer la condition `if (isDirty || statsDirty) {` par :
```typescript
      if ((isDirty || statsDirty) && !isExportingPdf) {
        saveProject()
      }
```
et ajouter `isExportingPdf` au tableau de dépendances de l'effet d'autosave.

- [ ] **Step 5 : Vérifier compilation + tests**

Run : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`
Expected : build OK (plus d'erreur liée à l'ancienne signature DOCX ; pas de variable/imports inutilisés), 46 tests verts.

- [ ] **Step 6 : Commit**
```bash
git add src/renderer/hooks/useExport.ts src/renderer/App.tsx
git commit -m "feat(export): whole-book PDF (per-chapter capture) + DOCX from all chapters"
```

---

### Task 5 : Vérification bout-en-bout (manuelle)

**Files:** aucun (vérification)

- [ ] **Step 1 : Build + tests**

Run : `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`
Expected : build OK, 46 tests verts.

- [ ] **Step 2 : Cycle manuel**

Run : `npm run launch:dev` (avec un projet à **plusieurs chapitres**, contenu varié : gras/italique, au moins un `* * *`).
1. **PDF** (menu → Export PDF) : le PDF contient **tous** les chapitres ; chaque chapitre **commence en haut d'une page** ; la pagination interne de chaque chapitre **correspond à ce qu'on voit** en l'ouvrant seul.
2. **DOCX** (menu → Export DOCX) : tous les chapitres présents, **saut de page entre chapitres**, chaque titre une seule fois, gras/italique et `* * *` rendus.
3. **Depuis une vue note/fiche/stats** : lancer l'export → fonctionne (plus d'« Éditeur non trouvé » ni de DOCX vide), et la **vue d'origine est restaurée** après (note rouverte si on était dessus, sinon chapitre courant).
4. **Projet vide de contenu** : export → notification « Rien à exporter », pas de fichier.

- [ ] **Step 3 : Commit (si correctifs)**
```bash
git add -A
git commit -m "fix(export): adjustments from end-to-end verification"
```

---

## Auto-revue (couverture du spec)

- Objectif (livre complet, 2 formats) → Tasks 2-4. ✅
- Contrainte WYSIWYG PDF (capture du DOM paginé) → Task 2 (`capturePageImages` réutilise le pipeline existant), Task 4 (capture par chapitre). ✅
- Source de vérité = `documentContents` + ordre `manuscript.items` ; flush du chapitre actif → Task 1 (`flattenChapterIds`), Task 4 (flush + lecture documentContents). ✅
- Décision 2 (PDF par chapitre, nouvelle page, pagination = vue solo) → Task 4 (boucle de capture). ✅
- Décision 3 (DOCX concaténé, saut de page avant chaque chapitre) → Task 3. ✅
- Décision 4 (pilotage de l'éditeur, restauration) → Task 4 (`finally` restaure vue/zoom). ✅
- Décision 5 (export depuis n'importe quelle vue) → Task 4 (basé sur documentContents, pas la vue ; restaure note/doc). ✅
- Décision 6 (titre une seule fois) → inhérent (nœud `chapterTitle` dans le JSON du chapitre). ✅
- Gestion d'erreurs (rien à exporter ; chapitre introuvable ignoré ; restauration en `finally` ; autosave neutralisé) → Task 4. ✅
- Tests : `flattenChapterIds` (Task 1) ; reste manuel (Task 5), conformément au spec. ✅

## Cohérence des types/signatures

- `flattenChapterIds(items: ManuscriptItem[]): string[]` — Task 1, appelée Task 4.
- `capturePageImages(editorElement, template, quality): Promise<string[]>` — Task 2, appelée Task 4.
- `assembleBookPdf(pages: string[], template, project): Blob` — Task 2, appelée Task 4.
- `exportToDocx({ chapterDocs: ProseMirrorNode[], template, project, includeHeaders?, includeFooters? })` — Task 3, appelée Task 4.
- `exportToPdf` reste exporté (wrapper) — non utilisé par useExport mais préserve l'API publique.
- `editor.schema.nodeFromJSON(json)` produit un `ProseMirrorNode` consommé par `exportToDocx`.
