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
