import test from 'node:test'
import assert from 'node:assert/strict'
import { formatLogEntry, prependLogEntry } from '../../shared/wiki/log.js'

test('formatLogEntry has the expected shape', () => {
  const e = formatLogEntry('NEW PAGE', 'personnages/anna', 'Création de la fiche.', '2026-06-14')
  assert.equal(e, '## 2026-06-14 - NEW PAGE personnages/anna\n\nCréation de la fiche.\n\n---\n')
})

test('prependLogEntry puts the newest entry first', () => {
  const first = formatLogEntry('NEW PAGE', 'a', 'd1', '2026-06-14')
  const second = formatLogEntry('UPDATE', 'a', 'd2', '2026-06-15')
  const log = prependLogEntry(first, second)
  assert.ok(log.indexOf('UPDATE') < log.indexOf('NEW PAGE'))
  assert.ok(log.startsWith('## 2026-06-15'))
})
