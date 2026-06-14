import test from 'node:test'
import assert from 'node:assert/strict'
import { countSections } from '../../shared/markdown/sections.js'

const doc = (content: unknown[]) => JSON.stringify({ type: 'doc', content })
const title = { type: 'chapterTitle', content: [{ type: 'text', text: 'T' }] }
const p = (t: string) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })
const sb = { type: 'sceneBreak' }

test('a chapter with no scene break has 1 section', () => {
  assert.equal(countSections(doc([title, p('a'), p('b')])), 1)
})

test('one scene break yields 2 sections', () => {
  assert.equal(countSections(doc([title, p('a'), sb, p('b')])), 2)
})

test('three scene breaks yield 4 sections', () => {
  assert.equal(countSections(doc([title, p('a'), sb, p('b'), sb, p('c'), sb, p('d')])), 4)
})

test('empty or invalid input yields 0', () => {
  assert.equal(countSections(undefined), 0)
  assert.equal(countSections(''), 0)
  assert.equal(countSections('not json'), 0)
  assert.equal(countSections(JSON.stringify({ type: 'doc' })), 0) // no content
})
