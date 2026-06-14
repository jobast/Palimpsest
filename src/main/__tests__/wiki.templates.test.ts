import test from 'node:test'
import assert from 'node:assert/strict'
import { WIKI_TEMPLATES, getTemplate } from '../../shared/wiki/templates.js'

test('there are six templates with the expected ids', () => {
  assert.deepEqual(
    WIKI_TEMPLATES.map(t => t.id).sort(),
    ['chronologie', 'etat_connaissance', 'libre', 'mystere', 'pov', 'voix_personnage']
  )
})

test('each template has category + label + body; mystere targets structure', () => {
  for (const t of WIKI_TEMPLATES) {
    assert.ok(t.label && t.category && typeof t.body === 'string')
  }
  const m = getTemplate('mystere')
  assert.equal(m?.category, 'structure')
  assert.equal(m?.type, 'mystere')
  assert.match(m!.body, /Statut/)
})

test('getTemplate returns undefined for unknown id', () => {
  assert.equal(getTemplate('nope'), undefined)
})
