import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SIDECAR_DIR, sidecarPath, stringifySidecar, parseSidecar, type ChapterSidecar
} from '../../shared/markdown/sidecar.js'

const doc = { type: 'doc' as const, content: [
  { type: 'chapterTitle', content: [{ type: 'text', text: 'Un' }] },
  { type: 'paragraph', attrs: { textAlign: 'center' }, content: [
    { type: 'text', text: 'Centré ', marks: [{ type: 'highlight', attrs: { color: '#fde047' } }] },
    { type: 'text', text: 'exact.' }
  ] },
  { type: 'mysteryNode', attrs: { x: 1 }, content: [{ type: 'text', text: 'inconnu' }] }
] }

test('sidecarPath is id-based under the hidden .palim dir', () => {
  assert.equal(SIDECAR_DIR, 'chapitres/.palim')
  assert.equal(sidecarPath('abc-123'), 'chapitres/.palim/abc-123.json')
})

test('stringify/parse round-trips every node, attr and mark exactly', () => {
  const s: ChapterSidecar = { version: 1, mdHash: 'ff'.repeat(32), savedAt: '2026-09-13T10:00:00.000Z', doc }
  const text = stringifySidecar(s)
  assert.ok(text.endsWith('\n'))
  const r = parseSidecar(text)
  assert.ok(r.ok)
  if (r.ok) assert.deepEqual(r.sidecar, s)
})

test('parseSidecar rejects corrupt JSON', () => {
  assert.deepEqual(parseSidecar('{ "version": 1, '), { ok: false, reason: 'corrupt' })
  assert.deepEqual(parseSidecar(''), { ok: false, reason: 'corrupt' })
})

test('parseSidecar rejects unknown versions', () => {
  const r = parseSidecar(JSON.stringify({ version: 2, mdHash: 'a', savedAt: 's', doc }))
  assert.deepEqual(r, { ok: false, reason: 'unknown-version' })
})

test('parseSidecar rejects an invalid doc or missing hash', () => {
  assert.deepEqual(parseSidecar(JSON.stringify({ version: 1, mdHash: 'a', savedAt: 's', doc: { type: 'paragraph' } })), { ok: false, reason: 'invalid-doc' })
  assert.deepEqual(parseSidecar(JSON.stringify({ version: 1, mdHash: 'a', savedAt: 's', doc: { type: 'doc', content: 'x' } })), { ok: false, reason: 'invalid-doc' })
  assert.deepEqual(parseSidecar(JSON.stringify({ version: 1, savedAt: 's', doc })), { ok: false, reason: 'invalid-doc' })
})
