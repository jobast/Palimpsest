import test from 'node:test'
import assert from 'node:assert/strict'
import { parseIngestOutput } from '../../shared/wiki/ingestPrompt.js'

const WITH_BOTH = `=== SUGGESTION ===
TYPE: nouvelle_fiche
CIBLE: personnages
TITRE: Jean
RESUME: un homme
CORPS:
Jean est grand.
=== SUGGESTION ===
TYPE: ajout
CIBLE: lieux/paris
TITRE: Paris
RESUME: la ville
CORPS:
Il pleut sur Paris.
=== RESUME CHAPITRE ===
Jean arrive à Paris sous la pluie. Il cherche un indice.`

test('parseIngestOutput separates suggestions from the chapter summary', () => {
  const { suggestions, summary } = parseIngestOutput(WITH_BOTH)
  assert.equal(suggestions.length, 2)
  assert.equal(suggestions[0].title, 'Jean')
  assert.equal(suggestions[1].type, 'ajout')
  assert.ok(!suggestions[1].body.includes('RESUME CHAPITRE'))
  assert.ok(!suggestions[1].body.includes('cherche un indice'))
  assert.equal(summary, 'Jean arrive à Paris sous la pluie. Il cherche un indice.')
})

test('parseIngestOutput: no summary marker -> empty summary, suggestions intact', () => {
  const txt = `=== SUGGESTION ===
TYPE: nouvelle_fiche
CIBLE: lieux
TITRE: Cave
RESUME: sombre
CORPS:
Une cave humide.`
  const { suggestions, summary } = parseIngestOutput(txt)
  assert.equal(suggestions.length, 1)
  assert.equal(summary, '')
})

test('parseIngestOutput: AUCUNE SUGGESTION + summary -> no suggestions, summary kept', () => {
  const txt = `AUCUNE SUGGESTION
=== RESUME CHAPITRE ===
Chapitre de transition, rien de neuf.`
  const { suggestions, summary } = parseIngestOutput(txt)
  assert.deepEqual(suggestions, [])
  assert.equal(summary, 'Chapitre de transition, rien de neuf.')
})

test('parseIngestOutput tolerates a totally empty output', () => {
  const { suggestions, summary } = parseIngestOutput('')
  assert.deepEqual(suggestions, [])
  assert.equal(summary, '')
})
