import test from 'node:test'
import assert from 'node:assert/strict'
import { mysteriesOverview, sceneEntities } from '../../shared/wiki/structure.js'
import type { Fiche } from '../../shared/wiki/types.js'

const fiche = (slug: string, title: string, type: string | undefined, body: string): Fiche =>
  ({ slug, category: 'structure', title, created: '2026-06-14', body, type })

test('mysteriesOverview extracts status/revelation/false-trail count from type=mystere fiches', () => {
  const f = fiche('m1', 'Qui a tué Henry ?', 'mystere', [
    '## Question', 'Qui est le commanditaire ?', '## Fausses pistes', '- les Maasaï', '- le voisin',
    '## Révélation prévue', 'Acte 6', '## Statut', 'ouvert'
  ].join('\n'))
  const other = fiche('x', 'Pas un mystère', undefined, 'rien')
  const rows = mysteriesOverview([f, other])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].title, 'Qui a tué Henry ?')
  assert.equal(rows[0].statut, 'ouvert')
  assert.equal(rows[0].revelation, 'Acte 6')
  assert.equal(rows[0].fauxPistes, 2)
  assert.match(rows[0].question, /commanditaire/)
})

test('sceneEntities detects fiche titles present in a text (accent/case-insensitive, word-boundary)', () => {
  const fiches: Fiche[] = [
    { slug: 'kiran', category: 'personnages', title: 'Kiran', created: '', body: '' },
    { slug: 'laikipia', category: 'lieux', title: 'Laïkipia', created: '', body: '' },
    { slug: 'nairobi', category: 'lieux', title: 'Nairobi', created: '', body: '' }
  ]
  const hits = sceneEntities('Kiran arrive à laikipia au petit matin.', fiches).map(f => f.slug).sort()
  assert.deepEqual(hits, ['kiran', 'laikipia'])
})
