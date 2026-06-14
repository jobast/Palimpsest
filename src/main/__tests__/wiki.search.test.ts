import test from 'node:test'
import assert from 'node:assert/strict'
import { searchFiches } from '../../shared/wiki/search.js'
import type { Fiche } from '../../shared/wiki/types.js'

const f = (slug: string, title: string, body: string): Fiche =>
  ({ slug, category: 'personnages', title, created: '2026-06-14', body })

test('search is accent/case-insensitive and scores by occurrences', () => {
  const fiches = [
    f('kiran', 'Kiran', 'Kiran rêve de la prophétie. La prophétie le hante.'),
    f('henry', 'Henry', 'Henry parle une fois de prophetie.')
  ]
  const hits = searchFiches(fiches, 'prophétie')
  assert.equal(hits.length, 2)
  assert.equal(hits[0].slug, 'kiran')
  assert.ok(hits[0].score >= hits[1].score)
  assert.match(hits[0].snippet, /prophétie/i)
})

test('short words and stopwords are ignored; no match yields empty', () => {
  const fiches = [f('x', 'X', 'le la et un texte')]
  assert.deepEqual(searchFiches(fiches, 'le la'), [])
  assert.deepEqual(searchFiches(fiches, 'zzzz'), [])
})

test('matches title too', () => {
  const fiches = [f('laikipia', 'Laikipia', 'rien'), f('nairobi', 'Nairobi', 'rien')]
  const hits = searchFiches(fiches, 'laikipia')
  assert.equal(hits[0].slug, 'laikipia')
})
