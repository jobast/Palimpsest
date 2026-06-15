import test from 'node:test'
import assert from 'node:assert/strict'
import { CLI_ENGINES, engineCommand, isCliEngine } from '../../shared/wiki/engines.js'

test('the three CLI engines exist with binary + base args', () => {
  assert.deepEqual(CLI_ENGINES.map(e => e.id).sort(), ['claude', 'codex', 'gemini'])
})

test('engineCommand returns bin + args (prompt goes to stdin, not args)', () => {
  assert.deepEqual(engineCommand('claude'), { bin: 'claude', args: ['-p'] })
  assert.deepEqual(engineCommand('codex'), { bin: 'codex', args: ['exec'] })
  assert.deepEqual(engineCommand('gemini'), { bin: 'gemini', args: ['-p'] })
})

test('engineCommand returns null for non-CLI / unknown engines', () => {
  assert.equal(engineCommand('api'), null)
  assert.equal(engineCommand('bogus'), null)
})

test('isCliEngine distinguishes api from cli ids', () => {
  assert.equal(isCliEngine('api'), false)
  assert.equal(isCliEngine('claude'), true)
})
