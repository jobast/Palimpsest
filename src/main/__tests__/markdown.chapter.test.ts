import test from 'node:test'
import assert from 'node:assert/strict'
import { parseChapter, serializeChapter } from '../../shared/markdown/chapter.js'
import type { ParsedChapter } from '../../shared/markdown/types.js'

test('parseChapter builds a chapterTitle node from frontmatter', () => {
  const md = '---\nid: x\ntitle: Le Départ\n---\nIl faisait nuit.\n'
  const { frontmatter, doc } = parseChapter(md, 'fallback')
  assert.equal(frontmatter.id, 'x')
  assert.equal(frontmatter.title, 'Le Départ')
  assert.equal(doc.content[0].type, 'chapterTitle')
  assert.equal(doc.content[0].content?.[0].text, 'Le Départ')
  assert.equal(doc.content[1].type, 'firstParagraph')
})

test('parseChapter uses fallback title when frontmatter title missing', () => {
  const { frontmatter } = parseChapter('Juste du texte.', '003-le-seuil')
  assert.equal(frontmatter.title, '003-le-seuil')
  assert.ok(frontmatter.id)  // a generated id
})

test('serializeChapter never duplicates the title in the body', () => {
  const parsed: ParsedChapter = {
    frontmatter: { id: 'x', title: 'Le Départ' },
    doc: { type: 'doc', content: [
      { type: 'chapterTitle', content: [{ type: 'text', text: 'Le Départ' }] },
      { type: 'firstParagraph', content: [{ type: 'text', text: 'Il faisait nuit.' }] }
    ] }
  }
  const md = serializeChapter(parsed)
  assert.equal(md, '---\nid: x\ntitle: Le Départ\n---\nIl faisait nuit.\n')
  assert.equal((md.match(/Le Départ/g) ?? []).length, 1) // only in frontmatter
})

test('round-trip preserves paragraphs, marks, scene breaks and French typography', () => {
  const md = [
    '---', 'id: x', 'title: Chapitre', '---',
    'Première phrase avec **gras** et *italique*.',
    '',
    '* * *',
    '',
    '« Dialogue » dit-elle…'
  ].join('\n') + '\n'
  const reparsed = serializeChapter(parseChapter(md, 'fallback'))
  assert.equal(reparsed, md)
})

test('status/synopsis/pov survive round-trip', () => {
  const md = '---\nid: x\ntitle: T\nstatus: revision\npov: Marie\n---\nTexte.\n'
  const out = serializeChapter(parseChapter(md, 'f'))
  assert.match(out, /status: revision/)
  assert.match(out, /pov: Marie/)
})
