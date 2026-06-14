import test from 'node:test'
import assert from 'node:assert/strict'
import { docToMarkdownBody, markdownBodyToContent } from '../../shared/markdown/body.js'
import type { TipTapDoc } from '../../shared/markdown/types.js'

const doc = (content: unknown[]): TipTapDoc => ({ type: 'doc', content: content as never })
const p = (text: string, marks?: unknown[]) =>
  ({ type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] })

test('chapterTitle is excluded from the body', () => {
  const d = doc([
    { type: 'chapterTitle', content: [{ type: 'text', text: 'Le Départ' }] },
    p('Bonjour.')
  ])
  assert.equal(docToMarkdownBody(d), 'Bonjour.\n')
})

test('firstParagraph serializes like a normal paragraph', () => {
  const d = doc([
    { type: 'firstParagraph', content: [{ type: 'text', text: 'Début.' }] },
    p('Suite.')
  ])
  assert.equal(docToMarkdownBody(d), 'Début.\n\nSuite.\n')
})

test('bold and italic marks become ** and *', () => {
  const d = doc([
    p('gras', [{ type: 'bold' }]),
    p('penché', [{ type: 'italic' }])
  ])
  assert.equal(docToMarkdownBody(d), '**gras**\n\n*penché*\n')
})

test('sceneBreak becomes * * *', () => {
  const d = doc([p('Avant.'), { type: 'sceneBreak' }, p('Après.')])
  assert.equal(docToMarkdownBody(d), 'Avant.\n\n* * *\n\nAprès.\n')
})

test('literal asterisks and leading markers are escaped', () => {
  const d = doc([p('# pas un titre'), p('un * isolé')])
  assert.equal(docToMarkdownBody(d), '\\# pas un titre\n\nun \\* isolé\n')
})

test('French typography passes through untouched', () => {
  const d = doc([p('« Bonjour » dit-il…')])
  assert.equal(docToMarkdownBody(d), '« Bonjour » dit-il…\n')
})

test('markdownBodyToContent marks the first paragraph as firstParagraph', () => {
  const nodes = markdownBodyToContent('Début.\n\nSuite.\n')
  assert.equal(nodes[0].type, 'firstParagraph')
  assert.equal(nodes[1].type, 'paragraph')
})

test('markdownBodyToContent maps * * * to sceneBreak', () => {
  const nodes = markdownBodyToContent('Avant.\n\n* * *\n\nAprès.\n')
  assert.deepEqual(nodes.map(n => n.type), ['firstParagraph', 'sceneBreak', 'paragraph'])
})

test('markdownBodyToContent parses bold/italic and unescapes', () => {
  const nodes = markdownBodyToContent('**gras** et \\* littéral')
  const marks = (nodes[0].content ?? []).map(c => ({ text: c.text, m: c.marks?.[0]?.type }))
  assert.deepEqual(marks[0], { text: 'gras', m: 'bold' })
  assert.equal(nodes[0].content?.map(c => c.text).join(''), 'gras et * littéral')
})

test('body round-trips French typography', () => {
  const md = '« Bonjour » dit-il…\n'
  const nodes = markdownBodyToContent(md)
  assert.equal(nodes[0].content?.map(c => c.text).join(''), '« Bonjour » dit-il…')
})
