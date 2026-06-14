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
