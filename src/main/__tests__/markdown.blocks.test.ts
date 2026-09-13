import test from 'node:test'
import assert from 'node:assert/strict'
import { docToMarkdownBody, markdownBodyToContent } from '../../shared/markdown/body.js'
import type { TipTapNode } from '../../shared/markdown/types.js'

const p = (text: string): TipTapNode => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const fp = (text: string): TipTapNode => ({ type: 'firstParagraph', content: [{ type: 'text', text }] })

test('a single newline separates two paragraphs (Savana format)', () => {
  const nodes = markdownBodyToContent('Première ligne.\nDeuxième ligne.\n\nTroisième.')
  assert.deepEqual(nodes, [fp('Première ligne.'), p('Deuxième ligne.'), p('Troisième.')])
})

test('a dash-opened line is dialogue prose, never a list', () => {
  const nodes = markdownBodyToContent('- Bonjour, dit-il.\n- Bonsoir, répondit-elle.')
  assert.deepEqual(nodes, [fp('- Bonjour, dit-il.'), p('- Bonsoir, répondit-elle.')])
  const md = docToMarkdownBody({ type: 'doc', content: [fp('- Bonjour, dit-il.')] })
  assert.equal(md, '- Bonjour, dit-il.\n')
})

test('trailing backslash or two spaces = hardBreak inside the same paragraph', () => {
  const expected: TipTapNode[] = [{ type: 'firstParagraph', content: [
    { type: 'text', text: 'un' }, { type: 'hardBreak' }, { type: 'text', text: 'deux' }
  ] }]
  assert.deepEqual(markdownBodyToContent('un\\\ndeux'), expected)
  assert.deepEqual(markdownBodyToContent('un  \ndeux'), expected)
  assert.equal(docToMarkdownBody({ type: 'doc', content: expected }), 'un\\\ndeux\n')
})

test('scene break and horizontal rule are distinct', () => {
  assert.deepEqual(markdownBodyToContent('a\n\n* * *\n\n---\n\nb'), [
    fp('a'), { type: 'sceneBreak' }, { type: 'horizontalRule' }, p('b')
  ])
  assert.equal(docToMarkdownBody({ type: 'doc', content: [{ type: 'sceneBreak' }, { type: 'horizontalRule' }] }), '* * *\n\n---\n')
})

test('headings read up to ###### and are capped at level 3', () => {
  assert.deepEqual(markdownBodyToContent('## Deux\n##### Cinq'), [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Deux' }] },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Cinq' }] }
  ])
  assert.equal(docToMarkdownBody({ type: 'doc', content: [{ type: 'heading', attrs: { level: 5, textAlign: 'left' }, content: [{ type: 'text', text: 'x' }] }] }), '### x\n')
})

test('paragraphs that look like block openers are escaped and read back', () => {
  const texts = ['# pas un titre', '> pas une citation', '+ pas une puce', '* pas une puce', '3. pas une liste', '```pas un code', '---']
  for (const text of texts) {
    const md = docToMarkdownBody({ type: 'doc', content: [fp(text)] })
    assert.deepEqual(markdownBodyToContent(md), [fp(text)], `round-trip failed for ${JSON.stringify(text)} via ${JSON.stringify(md)}`)
  }
})

test('chapterTitle is never written to the body; empty paragraphs are dropped', () => {
  const md = docToMarkdownBody({ type: 'doc', content: [
    { type: 'chapterTitle', content: [{ type: 'text', text: 'Titre' }] },
    { type: 'firstParagraph', content: [] },
    p('texte')
  ] })
  assert.equal(md, 'texte\n')
  assert.equal(docToMarkdownBody({ type: 'doc', content: [] }), '')
})

test('unknown block nodes fall back to their inline text', () => {
  const md = docToMarkdownBody({ type: 'doc', content: [
    { type: 'callout', attrs: { kind: 'note' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'survit' }] }] }
  ] })
  assert.equal(md, 'survit\n')
})

test('CRLF input is accepted', () => {
  assert.deepEqual(markdownBodyToContent('a\r\nb\r\n'), [fp('a'), p('b')])
})
