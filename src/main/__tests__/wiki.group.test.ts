import test from 'node:test'
import assert from 'node:assert/strict'
import { ficheKey, groupFichesByCategory } from '../../shared/wiki/group.js'
import type { Fiche } from '../../shared/wiki/types.js'

const f = (category: Fiche['category'], slug: string, title: string): Fiche =>
  ({ slug, category, title, created: '2026-06-14', body: '' })

test('ficheKey is category/slug', () => {
  assert.equal(ficheKey(f('lieux', 'paris', 'Paris')), 'lieux/paris')
})

test('groupFichesByCategory groups in canonical category order, sorts by title', () => {
  const groups = groupFichesByCategory([
    f('lieux', 'b', 'Beta'), f('personnages', 'z', 'Zoe'), f('personnages', 'a', 'Alice'), f('lieux', 'a', 'Alpha')
  ])
  assert.deepEqual(groups.map(g => g.category), ['personnages', 'lieux'])
  assert.deepEqual(groups[0].fiches.map(x => x.title), ['Alice', 'Zoe'])
  assert.deepEqual(groups[1].fiches.map(x => x.title), ['Alpha', 'Beta'])
})

test('empty categories are omitted', () => {
  const groups = groupFichesByCategory([f('notes', 'n', 'Note')])
  assert.deepEqual(groups.map(g => g.category), ['notes'])
})
