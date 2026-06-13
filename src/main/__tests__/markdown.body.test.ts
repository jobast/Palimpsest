import test from 'node:test'
import assert from 'node:assert/strict'
import { docToMarkdownBody } from '../../shared/markdown/body.js'
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
