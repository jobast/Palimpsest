import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFichesSummary } from '../../shared/wiki/ingestPrompt.js'
import { appendIngestSection } from '../../shared/wiki/fiche.js'
import type { Fiche } from '../../shared/wiki/types.js'

const fiche = (over: Partial<Fiche>): Fiche => ({
  slug: 'jean', category: 'personnages', title: 'Jean', created: '2026-06-15', body: '', ...over
})

test('buildFichesSummary groups titles by category', () => {
  const out = buildFichesSummary([
    fiche({ slug: 'jean', title: 'Jean', category: 'personnages' }),
    fiche({ slug: 'paris', title: 'Paris', category: 'lieux' })
  ])
  assert.ok(out.includes('personnages'))
  assert.ok(out.includes('Jean'))
  assert.ok(out.includes('lieux'))
  assert.ok(out.includes('Paris'))
})

test('buildFichesSummary on empty list returns a non-empty placeholder', () => {
  const out = buildFichesSummary([])
  assert.ok(out.trim().length > 0)
})

test('appendIngestSection appends a marked, dated section and preserves the body', () => {
  const f = fiche({ body: 'Corps existant.' })
  const out = appendIngestSection(f, 'ch-12', 'Nouvelle info.', '2026-06-15')
  assert.ok(out.body.startsWith('Corps existant.'))
  assert.ok(out.body.includes('<!-- ingest:ch-12 -->'))
  assert.ok(out.body.includes('Nouvelle info.'))
  assert.equal(out.lastUpdated, '2026-06-15')
})

test('appendIngestSection works when the body is empty', () => {
  const out = appendIngestSection(fiche({ body: '' }), 'ch-1', 'Première info.', '2026-06-15')
  assert.ok(out.body.includes('<!-- ingest:ch-1 -->'))
  assert.ok(out.body.includes('Première info.'))
})
