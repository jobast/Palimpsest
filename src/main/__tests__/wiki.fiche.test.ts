import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFiche, serializeFiche, addSourceToFiche } from '../../shared/wiki/fiche.js'
import type { Fiche } from '../../shared/wiki/types.js'

test('round-trip preserves core fields and structured meta', () => {
  const md = [
    '---', 'titre: Marseille', 'categorie: lieux', 'cree: 2026-06-14',
    'last_updated: 2026-06-14', 'sources: [ch-1, ch-2]',
    'coordinates: {latitude: 43.3, longitude: 5.4}', 'mapZoom: 11',
    '---', 'Ville portuaire.', ''
  ].join('\n')
  const fiche = parseFiche(md, 'marseille', 'lieux')
  assert.equal(fiche.title, 'Marseille')
  assert.equal(fiche.category, 'lieux')
  assert.equal(fiche.slug, 'marseille')
  assert.deepEqual(fiche.sources, ['ch-1', 'ch-2'])
  assert.equal(fiche.body.trim(), 'Ville portuaire.')
  assert.equal(fiche.meta?.mapZoom, 11)
  assert.deepEqual(fiche.meta?.coordinates, { latitude: 43.3, longitude: 5.4 })
  const out = serializeFiche(fiche)
  assert.match(out, /titre: Marseille/)
  assert.match(out, /mapZoom: 11/)
  assert.match(out, /latitude: 43\.3/)
  const reparsed = parseFiche(out, 'marseille', 'lieux')
  assert.equal(reparsed.meta?.mapZoom, 11)
})

test('missing/invalid frontmatter falls back without throwing', () => {
  const fiche = parseFiche('Juste du texte.', '003-x', 'notes')
  assert.equal(fiche.slug, '003-x')
  assert.equal(fiche.category, 'notes')
  assert.equal(fiche.title, '003-x')
  assert.equal(fiche.body.trim(), 'Juste du texte.')
})

test('invalid category in frontmatter falls back to provided category', () => {
  const md = '---\ntitre: X\ncategorie: bogus\ncree: 2026-06-14\n---\nb'
  const fiche = parseFiche(md, 'x', 'personnages')
  assert.equal(fiche.category, 'personnages')
})

test('addSourceToFiche is idempotent and refreshes lastUpdated', () => {
  const base: Fiche = { slug: 'a', category: 'notes', title: 'A', created: '2026-06-01', body: 'x', sources: ['ch-1'] }
  const once = addSourceToFiche(base, 'ch-2', '2026-06-14')
  assert.deepEqual(once.sources, ['ch-1', 'ch-2'])
  assert.equal(once.lastUpdated, '2026-06-14')
  const twice = addSourceToFiche(once, 'ch-2', '2026-06-15')
  assert.deepEqual(twice.sources, ['ch-1', 'ch-2'])
  assert.equal(twice.lastUpdated, '2026-06-14')
})
