# Export PDF vectoriel print-ready — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'export PDF raster par un PDF **vectoriel** (Chromium `printToPDF`) du livre complet, fidèle au template, avec en-têtes/pieds.

**Architecture:** Le renderer reconstruit le livre en HTML+CSS print (purs, testables) depuis `documentContents`, puis un IPC fait rendre ce HTML par une `BrowserWindow` cachée via `webContents.printToPDF` → Buffer PDF vectoriel → téléchargé comme le DOCX.

**Tech Stack:** Electron (`BrowserWindow.printToPDF`), React, TipTap JSON, `node:test`. Branche `feat/stockage-markdown`.

**Environnement :** node via nvm — préfixer par `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`. Build `npm run build`, tests `npm run test:main` (actuellement 46 verts). Imports relatifs `src/shared/` en `.js`.

---

## Structure des fichiers

**Créés :**
- `src/shared/export/printHtml.ts` — `docToPrintHtml`, `buildBookHtml`, `buildPrintHeaderFooter` (purs).
- `src/main/__tests__/printHtml.test.ts` — tests des trois fonctions.

**Modifiés :**
- `src/main/index.ts` — IPC `export:printBookPdf` (fenêtre cachée).
- `src/main/preload.ts` — pont `printBookPdf`.
- `src/shared/types/electron.d.ts` — type `printBookPdf`.
- `src/renderer/hooks/useExport.ts` — `exportPdf` réécrit (vectoriel) ; retrait des imports raster.
- `src/renderer/lib/export/pdfExporter.ts` — retirer le code raster, ne garder que `downloadPdf`.

---

### Task 1 : `docToPrintHtml` (pur) + tests

**Files:**
- Create: `src/shared/export/printHtml.ts`
- Test: `src/main/__tests__/printHtml.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/main/__tests__/printHtml.test.ts` :
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { docToPrintHtml } from '../../shared/export/printHtml.js'
import type { TipTapDoc } from '../../shared/markdown/types.js'

const doc = (content: unknown[]): TipTapDoc => ({ type: 'doc', content: content as never })

test('chapterTitle becomes h1.chapter-title', () => {
  const html = docToPrintHtml(doc([{ type: 'chapterTitle', content: [{ type: 'text', text: 'Le Départ' }] }]))
  assert.match(html, /<h1 class="chapter-title">Le Départ<\/h1>/)
})

test('first paragraph keeps its class; bold/italic map to strong/em', () => {
  const html = docToPrintHtml(doc([
    { type: 'firstParagraph', content: [{ type: 'text', text: 'Début' }] },
    { type: 'paragraph', content: [
      { type: 'text', text: 'gras', marks: [{ type: 'bold' }] },
      { type: 'text', text: ' et ' },
      { type: 'text', text: 'penché', marks: [{ type: 'italic' }] }
    ] }
  ]))
  assert.match(html, /<p class="first-paragraph">Début<\/p>/)
  assert.match(html, /<strong>gras<\/strong> et <em>penché<\/em>/)
})

test('sceneBreak renders centered asterisks', () => {
  assert.match(docToPrintHtml(doc([{ type: 'sceneBreak' }])), /<p class="scene-break">\* \* \*<\/p>/)
})

test('HTML special chars are escaped; French typography preserved', () => {
  const html = docToPrintHtml(doc([{ type: 'paragraph', content: [{ type: 'text', text: '« a < b & c » …' }] }]))
  assert.match(html, /« a &lt; b &amp; c » …/)
})

test('textAlign is honored', () => {
  const html = docToPrintHtml(doc([{ type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'x' }] }]))
  assert.match(html, /<p style="text-align:center">x<\/p>/)
})
```

- [ ] **Step 2 : Lancer le test (échec)** — Run `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run test:main`. Expected: FAIL — module `printHtml.js` introuvable.

- [ ] **Step 3 : Écrire l'implémentation** — Créer `src/shared/export/printHtml.ts` :
```typescript
import type { TipTapDoc, TipTapNode } from '../markdown/types.js'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function serializeInline(nodes: TipTapNode[] | undefined): string {
  if (!nodes) return ''
  let out = ''
  for (const node of nodes) {
    if (node.type === 'hardBreak') { out += '<br>'; continue }
    if (node.type !== 'text' || typeof node.text !== 'string') continue
    let html = escapeHtml(node.text)
    const marks = node.marks?.map(m => m.type) ?? []
    if (marks.includes('italic')) html = `<em>${html}</em>`
    if (marks.includes('bold')) html = `<strong>${html}</strong>`
    out += html
  }
  return out
}

function alignStyle(node: TipTapNode): string {
  const align = node.attrs?.textAlign
  return typeof align === 'string' && align ? ` style="text-align:${align}"` : ''
}

function serializeBlock(node: TipTapNode): string {
  switch (node.type) {
    case 'chapterTitle':
      return `<h1 class="chapter-title">${serializeInline(node.content)}</h1>`
    case 'sceneBreak':
      return `<p class="scene-break">* * *</p>`
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 2)))
      return `<h${level}>${serializeInline(node.content)}</h${level}>`
    }
    case 'firstParagraph':
      return `<p class="first-paragraph"${alignStyle(node)}>${serializeInline(node.content)}</p>`
    case 'paragraph':
      return `<p${alignStyle(node)}>${serializeInline(node.content)}</p>`
    default:
      // Anti-loss fallback for unexpected nodes.
      return `<p${alignStyle(node)}>${serializeInline(node.content)}</p>`
  }
}

/** chapter doc JSON → HTML fragment (no <html>/<body> wrapper). */
export function docToPrintHtml(doc: TipTapDoc): string {
  return (doc.content ?? []).map(serializeBlock).join('\n')
}
```

- [ ] **Step 4 : Lancer le test (succès)** — Run `npm run test:main`. Expected: PASS (5 nouveaux + 46 → 51).

- [ ] **Step 5 : Commit**
```bash
git add src/shared/export/printHtml.ts src/main/__tests__/printHtml.test.ts
git commit -m "feat(export): docToPrintHtml — chapter JSON to print HTML"
```

---

### Task 2 : `buildBookHtml` + `buildPrintHeaderFooter` + tests

**Files:**
- Modify: `src/shared/export/printHtml.ts`
- Test: `src/main/__tests__/printHtml.test.ts` (ajouts)

- [ ] **Step 1 : Ajouter les tests qui échouent** — Append to `src/main/__tests__/printHtml.test.ts`:
```typescript
import { buildBookHtml, buildPrintHeaderFooter } from '../../shared/export/printHtml.js'
import type { PageTemplate } from '../../shared/types/templates.js'
import type { Project } from '../../shared/types/project.js'

const tpl = {
  id: 't', name: 'T', description: '', region: 'fr',
  page: { width: '14cm', height: '21cm', marginTop: '1.8cm', marginBottom: '1.8cm', marginLeft: '1.5cm', marginRight: '1.5cm' },
  typography: { fontFamily: 'Garamond, serif', fontSize: '11pt', lineHeight: 1.4, paragraphSpacing: '0', firstLineIndent: '1cm' },
  header: { show: true, content: '{author} / {title} / {page}', fontSize: '9pt' },
  footer: { show: true, showPageNumber: true, fontSize: '9pt' }
} as PageTemplate
const proj = { meta: { name: 'Mon Livre', author: 'Jean' } } as Project

test('buildBookHtml embeds @page size + margins and chapter page breaks', () => {
  const html = buildBookHtml(['<p>a</p>', '<p>b</p>'], tpl, proj)
  assert.match(html, /@page\s*\{[^}]*size:\s*14cm 21cm/)
  assert.match(html, /margin:\s*1\.8cm 1\.5cm 1\.8cm 1\.5cm/)
  assert.match(html, /section\.chapter\s*\{[^}]*break-before:\s*page/)
  assert.match(html, /first-of-type[^}]*break-before:\s*avoid/)
  assert.match(html, /font-family:\s*Garamond, serif/)
  // chapters present in order
  const ai = html.indexOf('<p>a</p>'); const bi = html.indexOf('<p>b</p>')
  assert.ok(ai > 0 && bi > ai)
})

test('buildPrintHeaderFooter maps tokens and toggles display', () => {
  const hf = buildPrintHeaderFooter(tpl, proj)
  assert.equal(hf.displayHeaderFooter, true)
  assert.match(hf.headerTemplate, /Jean \/ Mon Livre \/ <span class="pageNumber"><\/span>/)
  assert.match(hf.footerTemplate, /class="pageNumber"/)
  const none = buildPrintHeaderFooter({ ...tpl, header: undefined, footer: undefined }, proj)
  assert.equal(none.displayHeaderFooter, false)
})
```

- [ ] **Step 2 : Lancer le test (échec)** — Run `npm run test:main`. Expected: FAIL — `buildBookHtml`/`buildPrintHeaderFooter` non exportés.

- [ ] **Step 3 : Écrire l'implémentation** — Append to `src/shared/export/printHtml.ts`:
```typescript
import type { PageTemplate } from '../types/templates.js'
import type { Project } from '../types/project.js'

/** Assemble a standalone print HTML document from chapter fragments + template CSS. */
export function buildBookHtml(chapterHtmls: string[], template: PageTemplate, project: Project): string {
  const { page, typography } = template
  const css = `
    @page { size: ${page.width} ${page.height}; margin: ${page.marginTop} ${page.marginRight} ${page.marginBottom} ${page.marginLeft}; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ${typography.fontFamily}; font-size: ${typography.fontSize}; line-height: ${typography.lineHeight}; color: #000; }
    p { margin: 0; text-align: justify; text-indent: ${typography.firstLineIndent}; }
    p.first-paragraph { text-indent: 0; }
    p.scene-break { text-align: center; text-indent: 0; margin: 1em 0; }
    h1.chapter-title { text-align: center; font-weight: bold; text-indent: 0; margin: 0 0 2em; break-after: avoid; }
    h1, h2, h3 { text-indent: 0; }
    section.chapter { break-before: page; }
    section.chapter:first-of-type { break-before: avoid; }
  `
  const body = chapterHtmls.map(h => `<section class="chapter">${h}</section>`).join('\n')
  const title = escapeHtml(project.meta.name ?? '')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head><body>${body}</body></html>`
}

/** Build Chromium printToPDF header/footer templates from the page template. */
export function buildPrintHeaderFooter(
  template: PageTemplate,
  project: Project
): { displayHeaderFooter: boolean; headerTemplate: string; footerTemplate: string } {
  const headerOn = !!template.header?.show
  const footerOn = !!(template.footer?.show && template.footer.showPageNumber)
  const author = escapeHtml(project.meta.author ?? '')
  const title = escapeHtml(project.meta.name ?? '')
  const empty = '<span></span>'

  let headerTemplate = empty
  if (headerOn) {
    const content = (template.header!.content || '')
      .replace(/\{author\}/g, author)
      .replace(/\{title\}/g, title)
      .replace(/\{page\}/g, '<span class="pageNumber"></span>')
    const fs = template.header!.fontSize || '9pt'
    headerTemplate = `<div style="font-size:${fs}; width:100%; text-align:center; padding:0 8mm;">${content}</div>`
  }

  let footerTemplate = empty
  if (footerOn) {
    const fs = template.footer!.fontSize || '9pt'
    footerTemplate = `<div style="font-size:${fs}; width:100%; text-align:center;"><span class="pageNumber"></span></div>`
  }

  return { displayHeaderFooter: headerOn || footerOn, headerTemplate, footerTemplate }
}
```

- [ ] **Step 4 : Lancer le test (succès)** — Run `npm run test:main`. Expected: PASS (→ 53 total).

- [ ] **Step 5 : Commit**
```bash
git add src/shared/export/printHtml.ts src/main/__tests__/printHtml.test.ts
git commit -m "feat(export): buildBookHtml + print header/footer from template"
```

---

### Task 3 : IPC `export:printBookPdf` (fenêtre cachée)

**Files:**
- Modify: `src/main/index.ts` (après `export:savePDF`, ~l.697)
- Modify: `src/main/preload.ts` (après `savePDF`, ~l.86)
- Modify: `src/shared/types/electron.d.ts`

- [ ] **Step 1 : Handler main** — Dans `src/main/index.ts`, après le handler `export:savePDF`, ajouter (les imports `app`, `BrowserWindow`, `fs`, `path` sont déjà présents) :
```typescript
// Vector PDF of the whole book: render print HTML in a hidden window, printToPDF.
ipcMain.handle('export:printBookPdf', async (_, payload: {
  html: string
  displayHeaderFooter: boolean
  headerTemplate: string
  footerTemplate: string
}) => {
  let win: BrowserWindow | null = null
  let tmpFile: string | null = null
  try {
    tmpFile = path.join(app.getPath('temp'), `palimpseste-print-${Date.now()}.html`)
    await fs.promises.writeFile(tmpFile, payload.html, 'utf-8')
    win = new BrowserWindow({
      show: false,
      webPreferences: { javascript: false, sandbox: true }
    })
    await win.loadFile(tmpFile)
    const pdfData = await win.webContents.printToPDF({
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: payload.displayHeaderFooter,
      headerTemplate: payload.headerTemplate || '<span></span>',
      footerTemplate: payload.footerTemplate || '<span></span>'
    })
    return { success: true, data: pdfData }
  } catch (error) {
    return { success: false, error: String(error) }
  } finally {
    if (win && !win.isDestroyed()) win.close()
    if (tmpFile) await fs.promises.unlink(tmpFile).catch(() => undefined)
  }
})
```
Vérifier en haut du fichier que `fs` et `path` sont importés (ils le sont — utilisés par les handlers fs:* et `export:savePDF`). Si `fs` est importé en `import fs from 'fs'` et `path` en `import path from 'path'`, OK.

- [ ] **Step 2 : Preload** — Dans `src/main/preload.ts`, après `savePDF` (~l.86), ajouter :
```typescript
  printBookPdf: (payload: {
    html: string
    displayHeaderFooter: boolean
    headerTemplate: string
    footerTemplate: string
  }) => ipcRenderer.invoke('export:printBookPdf', payload),
```

- [ ] **Step 3 : Type** — Dans `src/shared/types/electron.d.ts`, ajouter une interface + l'entrée sur `ElectronAPI` (à côté de `printToPDF`/`savePDF`) :
```typescript
export interface PrintBookPdfResult {
  success: boolean
  data?: Uint8Array
  error?: string
}
```
et dans l'interface `ElectronAPI` :
```typescript
  printBookPdf: (payload: {
    html: string
    displayHeaderFooter: boolean
    headerTemplate: string
    footerTemplate: string
  }) => Promise<PrintBookPdfResult>
```
(Lire le fichier pour placer l'entrée dans l'interface au bon endroit et réutiliser le style existant.)

- [ ] **Step 4 : Vérifier compilation** — Run `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, 53 tests verts.

- [ ] **Step 5 : Commit**
```bash
git add src/main/index.ts src/main/preload.ts src/shared/types/electron.d.ts
git commit -m "feat(main): export:printBookPdf — vector PDF via hidden-window printToPDF"
```

---

### Task 4 : `useExport.exportPdf` vectoriel + retrait du raster

**Files:**
- Modify: `src/renderer/hooks/useExport.ts`
- Modify: `src/renderer/lib/export/pdfExporter.ts`

- [ ] **Step 1 : Réduire `pdfExporter.ts` à `downloadPdf`** — Remplacer tout le contenu de `src/renderer/lib/export/pdfExporter.ts` par :
```typescript
/**
 * PDF download helper. (Vector PDF rendering is done in the main process via
 * Chromium printToPDF — see useExport + export:printBookPdf.)
 */
export async function downloadPdf(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```
(Supprime `capturePageImages`, `assembleBookPdf`, `exportToPdf`, `exportToPdfSimple`, `pxToMm`, `PdfExportOptions`, et les imports `jsPDF`/`html2canvas`/`convertToPixels`.)

- [ ] **Step 2 : Imports de `useExport.ts`** — Remplacer le bloc d'imports d'export par :
```typescript
import { exportToDocx, downloadDocx } from '@/lib/export'
import { downloadPdf } from '@/lib/export/pdfExporter'
import { flattenChapterIds } from '@shared/manuscript/order'
import { docToPrintHtml, buildBookHtml, buildPrintHeaderFooter } from '@shared/export/printHtml'
import type { TipTapDoc } from '@shared/markdown'
```

- [ ] **Step 3 : Réécrire `exportPdf`** — Remplacer le `useCallback` `exportPdf` par :
```typescript
  const exportPdf = useCallback(async () => {
    if (!editor || !project) {
      setState(s => ({ ...s, error: 'Éditeur ou projet non disponible' }))
      return
    }
    setState({ isExporting: true, progress: 0, format: 'pdf', error: null })
    try {
      // Flush the active chapter so its latest edits are in documentContents.
      useEditorStore.getState().flushCurrentDocument(useProjectStore.getState().activeDocumentId)
      const { documentContents } = useEditorStore.getState()
      const chapterHtmls = flattenChapterIds(project.manuscript.items)
        .map(id => documentContents.get(id))
        .filter((c): c is string => !!c)
        .map(json => docToPrintHtml(JSON.parse(json) as TipTapDoc))

      if (chapterHtmls.length === 0) {
        setState({ isExporting: false, progress: 0, format: null, error: 'Rien à exporter' })
        return
      }

      setState(s => ({ ...s, progress: 30 }))
      const html = buildBookHtml(chapterHtmls, currentTemplate, project)
      const { displayHeaderFooter, headerTemplate, footerTemplate } =
        buildPrintHeaderFooter(currentTemplate, project)

      setState(s => ({ ...s, progress: 50 }))
      const result = await window.electronAPI.printBookPdf({
        html, displayHeaderFooter, headerTemplate, footerTemplate
      })
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Échec du rendu PDF')
      }

      setState(s => ({ ...s, progress: 85 }))
      const blob = new Blob([result.data], { type: 'application/pdf' })
      await downloadPdf(blob, `${project.meta.name}.pdf`)
      setState(s => ({ ...s, progress: 100 }))
      setTimeout(() => {
        setState({ isExporting: false, progress: 0, format: null, error: null })
      }, 1000)
    } catch (error) {
      console.error('PDF export failed:', error)
      setState({
        isExporting: false, progress: 0, format: null,
        error: `Échec de l'export PDF: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      })
    }
  }, [editor, currentTemplate, project])
```
Note : supprimer du fichier toute référence désormais inutilisée à `useUIStore`/`capturePageImages`/`assembleBookPdf` SI elles ne servent plus ailleurs dans le hook. `useUIStore` n'est plus nécessaire dans `exportPdf` ; vérifier qu'il n'est pas utilisé par `exportDocx` (non) → retirer son import s'il devient inutilisé.

- [ ] **Step 4 : Vérifier compilation + tests** — Run `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK (aucun import/variable inutilisé), 53 tests verts.

- [ ] **Step 5 : Commit**
```bash
git add src/renderer/hooks/useExport.ts src/renderer/lib/export/pdfExporter.ts
git commit -m "feat(export): vector PDF export path; remove raster pipeline"
```

---

### Task 5 : Vérification

**Files:** aucun

- [ ] **Step 1 : Build + tests**
Run `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" && npm run build && npm run test:main`. Expected: build OK, 53 verts.

- [ ] **Step 2 : Cycle manuel (utilisateur)** — `npm run launch:dev`, projet multi-chapitres :
  1. Export PDF → ouvrir le PDF : **texte vectoriel net et sélectionnable** (zoom fort = pas de pixelisation) ; chaque chapitre sur une nouvelle page ; en-tête auteur/titre + numéro de page ; marges correctes ; accents/« » corrects.
  2. Comparer la taille de fichier (doit être bien plus petite que le raster).
  3. Export depuis une vue note/stats → fonctionne (rendu dans la fenêtre cachée).

- [ ] **Step 3 : Commit (si correctifs)**
```bash
git add -A && git commit -m "fix(export): adjustments from vector PDF verification"
```

---

## Auto-revue (couverture du spec)
- PDF vectoriel via printToPDF (fenêtre cachée) → Tasks 3, 4. ✅
- Livre complet, ordre manuscrit, flush actif → Task 4 (`flattenChapterIds`, flush). ✅
- Géométrie/typo/retrait/justification via CSS du template → Task 2 (`buildBookHtml`). ✅
- Chapitre = nouvelle page → Task 2 (`section.chapter break-before:page`, 1er exclu). ✅
- En-têtes/pieds selon template (auteur/titre/numéro) → Task 2 (`buildPrintHeaderFooter`) + Task 3 (displayHeaderFooter). ✅
- Retrait du raster → Task 4. ✅
- Téléchargement (Blob → downloadPdf), depuis n'importe quelle vue → Task 4. ✅
- Tests purs (docToPrintHtml, buildBookHtml, header/footer) → Tasks 1, 2 ; rendu réel = manuel (Task 5). ✅

## Cohérence des types/signatures
- `docToPrintHtml(doc: TipTapDoc): string` — Task 1, utilisé Task 4.
- `buildBookHtml(chapterHtmls: string[], template, project): string` — Task 2, utilisé Task 4.
- `buildPrintHeaderFooter(template, project): {displayHeaderFooter, headerTemplate, footerTemplate}` — Task 2, utilisé Task 4.
- `electronAPI.printBookPdf({html, displayHeaderFooter, headerTemplate, footerTemplate}): Promise<{success, data?, error?}>` — Task 3, appelé Task 4.
- `downloadPdf(blob, filename)` conservé — Task 4.
