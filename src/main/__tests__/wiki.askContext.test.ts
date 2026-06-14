import test from 'node:test'
import assert from 'node:assert/strict'
import { selectContext, buildQueryPrompt, QUERY_SYSTEM_PROMPT } from '../../shared/wiki/askContext.js'

const docs = [
  { label: 'fiche kiran', text: 'Kiran cherche le commanditaire du meurtre.' },
  { label: 'fiche henry', text: 'Henry possède un ranch.' },
  { label: 'chapitre 03', text: 'Le meurtre a lieu la nuit.' }
]

test('selectContext ranks by relevance and respects the file cap', () => {
  const sel = selectContext('Qui est le commanditaire du meurtre ?', docs, { charBudget: 100000, maxFiles: 2 })
  assert.equal(sel.length, 2)
  assert.equal(sel[0].label, 'fiche kiran')          // most relevant first
})

test('selectContext falls back to all docs when nothing matches', () => {
  const sel = selectContext('xyzzy', docs, { charBudget: 100000, maxFiles: 30 })
  assert.equal(sel.length, 3)
})

test('query system prompt is strict (cite sources, no prose, mark uncertainty)', () => {
  assert.match(QUERY_SYSTEM_PROMPT, /cite/i)
  assert.match(QUERY_SYSTEM_PROMPT, /non vérifié/i)
  assert.match(QUERY_SYSTEM_PROMPT, /prose/i)
})

test('buildQueryPrompt embeds the question and labelled context', () => {
  const { user } = buildQueryPrompt('Qui a tué Henry ?', [{ label: 'fiche kiran', text: 'Kiran enquête.' }])
  assert.match(user, /Qui a tué Henry/)
  assert.match(user, /\[fiche kiran\]/)
  assert.match(user, /Kiran enquête/)
})
