import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAlert, serializeAlert, suggestionToAlert } from '../../shared/wiki/alert.js'
import type { Suggestion } from '../../shared/wiki/types.js'

test('alert frontmatter round-trips', () => {
  const out = serializeAlert({ id: 'a1', type: 'contradiction', title: 'Âge d\'Anna', resume: '20 puis 40', body: 'détail', created: '2026-06-14', status: 'ouverte' })
  const back = parseAlert(out, 'a1')
  assert.equal(back.type, 'contradiction')
  assert.equal(back.title, 'Âge d\'Anna')
  assert.equal(back.status, 'ouverte')
  assert.equal(back.body.trim(), 'détail')
})

test('suggestionToAlert maps an incoherence to an open contradiction', () => {
  const s: Suggestion = { id: '', type: 'incoherence', cible: '', title: 'Anachronisme', resume: '1850 vs 1845', body: 'le texte dit…' }
  const a = suggestionToAlert(s, '2026-06-14')
  assert.equal(a.type, 'contradiction')
  assert.equal(a.title, 'Anachronisme')
  assert.equal(a.resume, '1850 vs 1845')
  assert.equal(a.status, 'ouverte')
  assert.equal(a.created, '2026-06-14')
})

test('parseAlert tolerates invalid type/status', () => {
  const a = parseAlert('---\ntype: bogus\ntitre: X\nstatut: weird\ncree: 2026-06-14\n---\nb', 'a2')
  assert.equal(a.type, 'autre')
  assert.equal(a.status, 'ouverte')
})
