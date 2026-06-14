import test from 'node:test'
import assert from 'node:assert/strict'
import { sheetToFiche, sheetsToFiches } from '../../shared/wiki/migrate.js'
import type { CharacterSheet, LocationSheet, NoteSheet } from '../../shared/types/project.js'

test('character sheet maps to a personnages fiche, fields preserved in meta', () => {
  const s: CharacterSheet = { id: '1', type: 'character', name: 'Marie Curie', role: 'protagonist', description: 'Physicienne.', goals: 'Découvrir', createdAt: '2026-06-14T10:00:00Z', updatedAt: '2026-06-14T11:00:00Z' }
  const f = sheetToFiche(s)
  assert.equal(f.category, 'personnages')
  assert.equal(f.title, 'Marie Curie')
  assert.equal(f.slug, 'marie-curie')
  assert.equal(f.body, 'Physicienne.')
  assert.equal(f.meta?.role, 'protagonist')
  assert.equal(f.meta?.goals, 'Découvrir')
  assert.equal(f.created, '2026-06-14')
})

test('location sheet preserves coordinates + mapZoom in meta', () => {
  const s: LocationSheet = { id: '2', type: 'location', name: 'Paris', description: 'Capitale.', coordinates: { latitude: 48.85, longitude: 2.35 }, mapZoom: 12, createdAt: '2026-06-14T10:00:00Z', updatedAt: '2026-06-14T10:00:00Z' }
  const f = sheetToFiche(s)
  assert.equal(f.category, 'lieux')
  assert.deepEqual(f.meta?.coordinates, { latitude: 48.85, longitude: 2.35 })
  assert.equal(f.meta?.mapZoom, 12)
})

test('note sheet maps content to body in notes category', () => {
  const s: NoteSheet = { id: '3', type: 'note', name: 'Idée', content: 'Une idée.', tags: ['x'], createdAt: '2026-06-14T10:00:00Z', updatedAt: '2026-06-14T10:00:00Z' }
  const f = sheetToFiche(s)
  assert.equal(f.category, 'notes')
  assert.equal(f.body, 'Une idée.')
  assert.deepEqual(f.meta?.tags, ['x'])
})

test('sheetsToFiches disambiguates duplicate slugs within a category', () => {
  const a: CharacterSheet = { id: '1', type: 'character', name: 'Jean', role: 'minor', description: '', createdAt: '2026-06-14T10:00:00Z', updatedAt: '2026-06-14T10:00:00Z' }
  const b: CharacterSheet = { id: '2', type: 'character', name: 'Jean', role: 'minor', description: '', createdAt: '2026-06-14T10:00:00Z', updatedAt: '2026-06-14T10:00:00Z' }
  const fiches = sheetsToFiches([a, b])
  assert.equal(fiches[0].slug, 'jean')
  assert.equal(fiches[1].slug, 'jean-2')
})
