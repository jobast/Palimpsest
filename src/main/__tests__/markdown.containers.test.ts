import test from 'node:test'
import assert from 'node:assert/strict'
import { docToMarkdownBody, markdownBodyToContent } from '../../shared/markdown/body.js'
import type { TipTapNode, TipTapDoc } from '../../shared/markdown/types.js'

const p = (text: string): TipTapNode => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const fp = (text: string): TipTapNode => ({ type: 'firstParagraph', content: [{ type: 'text', text }] })
const li = (...blocks: TipTapNode[]): TipTapNode => ({ type: 'listItem', content: blocks })
const doc = (...content: TipTapNode[]): TipTapDoc => ({ type: 'doc', content })

test('bullet list writes with + and reads back; * is accepted on read', () => {
  const list: TipTapNode = { type: 'bulletList', content: [li(p('un')), li(p('deux'))] }
  assert.equal(docToMarkdownBody(doc(list)), '+ un\n+ deux\n')
  assert.deepEqual(markdownBodyToContent('+ un\n+ deux'), [list])
  assert.deepEqual(markdownBodyToContent('* un\n* deux'), [list])
})

test('ordered list keeps its start number', () => {
  const list: TipTapNode = { type: 'orderedList', attrs: { start: 3 }, content: [li(p('trois')), li(p('quatre'))] }
  assert.equal(docToMarkdownBody(doc(list)), '3. trois\n4. quatre\n')
  assert.deepEqual(markdownBodyToContent('3. trois\n4. quatre'), [list])
  assert.deepEqual(markdownBodyToContent('1. a'), [{ type: 'orderedList', attrs: { start: 1 }, content: [li(p('a'))] }])
})

test('nested lists and multi-paragraph items round-trip', () => {
  const list: TipTapNode = { type: 'bulletList', content: [
    li(p('parent'), { type: 'bulletList', content: [li(p('enfant'))] }),
    li(p('premier paragraphe'), p('second paragraphe'))
  ] }
  const md = docToMarkdownBody(doc(list))
  assert.equal(md, '+ parent\n\n  + enfant\n+ premier paragraphe\n\n  second paragraphe\n')
  assert.deepEqual(markdownBodyToContent(md), [list])
})

test('a blank line between items keeps a single list', () => {
  assert.deepEqual(markdownBodyToContent('+ a\n\n+ b'), [{ type: 'bulletList', content: [li(p('a')), li(p('b'))] }])
})

test('blockquote with nested blocks round-trips', () => {
  const quote: TipTapNode = { type: 'blockquote', content: [
    p('Citation.'),
    { type: 'bulletList', content: [li(p('point'))] },
    { type: 'blockquote', content: [p('imbriquée')] }
  ] }
  const md = docToMarkdownBody(doc(quote))
  assert.equal(md, '> Citation.\n>\n> + point\n>\n> > imbriquée\n')
  assert.deepEqual(markdownBodyToContent(md), [quote])
})

test('code block keeps language, raw content and blank lines', () => {
  const code: TipTapNode = { type: 'codeBlock', attrs: { language: 'ts' }, content: [{ type: 'text', text: 'const a = 1\n\n*pas italique* - tiret' }] }
  const md = docToMarkdownBody(doc(code))
  assert.equal(md, '```ts\nconst a = 1\n\n*pas italique* - tiret\n```\n')
  assert.deepEqual(markdownBodyToContent(md), [code])
  assert.deepEqual(markdownBodyToContent('```\n```'), [{ type: 'codeBlock', attrs: { language: null } }])
})

test('an empty code block reads back without an empty text node', () => {
  const md = docToMarkdownBody(doc({ type: 'codeBlock', attrs: { language: null } }))
  assert.equal(md, '```\n\n```\n')
  assert.deepEqual(markdownBodyToContent(md), [{ type: 'codeBlock', attrs: { language: null } }])
  const withLang = docToMarkdownBody(doc({ type: 'codeBlock', attrs: { language: 'ts' } }))
  assert.equal(withLang, '```ts\n\n```\n')
  assert.deepEqual(markdownBodyToContent(withLang), [{ type: 'codeBlock', attrs: { language: 'ts' } }])
})

test('a code block containing a fence line is written with a longer fence', () => {
  const code: TipTapNode = { type: 'codeBlock', attrs: { language: null }, content: [{ type: 'text', text: '```\nnon fermé' }] }
  const md = docToMarkdownBody(doc(code))
  assert.equal(md, '````\n```\nnon fermé\n````\n')
  assert.deepEqual(markdownBodyToContent(md), [code])
  // A longer fence is also accepted on read, and a shorter run inside stays content.
  assert.deepEqual(markdownBodyToContent('`````js\na ``` b\n`````'), [
    { type: 'codeBlock', attrs: { language: 'js' }, content: [{ type: 'text', text: 'a ``` b' }] }
  ])
})

test('an unterminated fence swallows the rest of the body without throwing', () => {
  assert.deepEqual(markdownBodyToContent('```\nreste'), [{ type: 'codeBlock', attrs: { language: null }, content: [{ type: 'text', text: 'reste' }] }])
})

test('a list ends when a normal paragraph follows, dialogue dash included', () => {
  assert.deepEqual(markdownBodyToContent('+ a\n- Dialogue.\ntexte'), [
    { type: 'bulletList', content: [li(p('a'))] }, fp('- Dialogue.'), p('texte')
  ])
})
