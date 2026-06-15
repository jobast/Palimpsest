import test from 'node:test'
import assert from 'node:assert/strict'
import { removeIngestSection } from '../../shared/wiki/fiche.js'
import { toIntegrationRecord, emptyIntegrationRecord } from '../../shared/wiki/integration.js'

test('removeIngestSection drops the marked section, keeps the rest', () => {
  const body = 'Intro.\n\n<!-- ingest:ch-1 -->\n_(2026-06-15)_\nFait A.'
  assert.equal(removeIngestSection(body, 'ch-1'), 'Intro.')
})

test('removeIngestSection keeps other chapters sections', () => {
  const body = '<!-- ingest:ch-1 -->\n_(d)_\nA.\n\n<!-- ingest:ch-2 -->\n_(d)_\nB.'
  const out = removeIngestSection(body, 'ch-1')
  assert.ok(!out.includes('ingest:ch-1'))
  assert.ok(out.includes('<!-- ingest:ch-2 -->'))
  assert.ok(out.includes('B.'))
})

test('removeIngestSection on a body without that marker is unchanged (trimmed)', () => {
  assert.equal(removeIngestSection('Juste du corps.', 'ch-9'), 'Juste du corps.')
})

test('toIntegrationRecord coerces a legacy timestamp string', () => {
  assert.deepEqual(toIntegrationRecord('2026-06-15T10:00:00Z'),
    { at: '2026-06-15T10:00:00Z', created: [], appended: [], alerts: [] })
})

test('toIntegrationRecord preserves a structured record', () => {
  const rec = { at: 'd', created: [{ category: 'personnages', slug: 'jean' }], appended: [], alerts: ['a1'] }
  assert.deepEqual(toIntegrationRecord(rec), rec)
})

test('toIntegrationRecord on garbage returns an empty record', () => {
  assert.deepEqual(toIntegrationRecord(null), { at: '', created: [], appended: [], alerts: [] })
})

test('emptyIntegrationRecord stamps at and empties arrays', () => {
  assert.deepEqual(emptyIntegrationRecord('d'), { at: 'd', created: [], appended: [], alerts: [] })
})
