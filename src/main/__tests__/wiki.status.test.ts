import test from 'node:test'
import assert from 'node:assert/strict'
import { hashContent, chapterStatus, toIntegrationRecord } from '../../shared/wiki/integration.js'

test('hashContent is deterministic and differs for different inputs', () => {
  assert.equal(hashContent('Bonjour'), hashContent('Bonjour'))
  assert.notEqual(hashContent('Bonjour'), hashContent('Bonsoir'))
  assert.equal(typeof hashContent(''), 'string')
})

test('chapterStatus: no record -> never', () => {
  assert.equal(chapterStatus('abc', undefined), 'never')
})

test('chapterStatus: matching hash -> current', () => {
  const rec = { at: 'd', created: [], appended: [], alerts: [], chapterHash: 'abc' }
  assert.equal(chapterStatus('abc', rec), 'current')
})

test('chapterStatus: different hash -> stale', () => {
  const rec = { at: 'd', created: [], appended: [], alerts: [], chapterHash: 'abc' }
  assert.equal(chapterStatus('xyz', rec), 'stale')
})

test('chapterStatus: legacy record without hash -> current (no false stale on upgrade)', () => {
  const rec = { at: 'd', created: [], appended: [], alerts: [] }
  assert.equal(chapterStatus('anything', rec), 'current')
})

test('toIntegrationRecord preserves chapterHash', () => {
  const rec = toIntegrationRecord({ at: 'd', created: [], appended: [], alerts: [], chapterHash: 'h1' })
  assert.equal(rec.chapterHash, 'h1')
})
