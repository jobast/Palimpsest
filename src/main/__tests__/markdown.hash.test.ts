import test from 'node:test'
import assert from 'node:assert/strict'
import { sha256Hex } from '../../shared/markdown/hash.js'

test('sha256Hex matches the known digest of "abc"', async () => {
  assert.equal(
    await sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  )
})

test('sha256Hex is stable and sensitive to a single character', async () => {
  const a = await sha256Hex('Il faisait nuit.')
  const b = await sha256Hex('Il faisait nuit.')
  const c = await sha256Hex('Il faisait nuit!')
  assert.equal(a, b)
  assert.notEqual(a, c)
  assert.match(a, /^[0-9a-f]{64}$/)
})

test('sha256Hex handles UTF-8 (accents, nbsp)', async () => {
  const h = await sha256Hex('« Été » !')
  assert.match(h, /^[0-9a-f]{64}$/)
})
