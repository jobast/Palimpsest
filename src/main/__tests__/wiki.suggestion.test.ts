import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSuggestionsBlock, serializeSuggestion, parseSuggestion } from '../../shared/wiki/suggestion.js'

const llm = [
  '=== SUGGESTION ===',
  'TYPE: nouvelle_fiche',
  'CIBLE: personnages',
  'TITRE: Anna Lefèvre',
  'RESUME: jeune femme mystérieuse',
  'CORPS:',
  'Apparition au chapitre 3. Regard perçant. (non vérifié)',
  '=== SUGGESTION ===',
  'TYPE: ajout',
  'CIBLE: personnages/anna-lefevre',
  'TITRE: Relation au Comte',
  'RESUME: lien révélé',
  'CORPS:',
  'Ils se connaissaient avant.',
  '=== SUGGESTION ===',
  'TYPE: incoherence',
  'CIBLE:',
  'TITRE: Anachronisme',
  'RESUME: 1850 vs 1845',
  'CORPS:',
  'Le chapitre dit 1850 mais la fiche dit 1845.'
].join('\n')

test('parseSuggestionsBlock parses multiple blocks', () => {
  const s = parseSuggestionsBlock(llm)
  assert.equal(s.length, 3)
  assert.equal(s[0].type, 'nouvelle_fiche')
  assert.equal(s[0].cible, 'personnages')
  assert.equal(s[0].title, 'Anna Lefèvre')
  assert.match(s[0].body, /Regard perçant/)
  assert.equal(s[1].type, 'ajout')
  assert.equal(s[1].cible, 'personnages/anna-lefevre')
  assert.equal(s[2].type, 'incoherence')
})

test('AUCUNE SUGGESTION yields empty array', () => {
  assert.deepEqual(parseSuggestionsBlock('AUCUNE SUGGESTION'), [])
})

test('blocks with invalid/missing TYPE are skipped', () => {
  const s = parseSuggestionsBlock('=== SUGGESTION ===\nTYPE: bogus\nTITRE: x\nCORPS:\ny')
  assert.deepEqual(s, [])
})

test('suggestion frontmatter round-trips', () => {
  const out = serializeSuggestion({ id: 'u1', type: 'ajout', cible: 'lieux/marseille', title: 'Port', resume: 'r', body: 'Corps.', sourceChapitre: 'ch-3' })
  const back = parseSuggestion(out, 'u1')
  assert.equal(back.type, 'ajout')
  assert.equal(back.cible, 'lieux/marseille')
  assert.equal(back.title, 'Port')
  assert.equal(back.sourceChapitre, 'ch-3')
  assert.equal(back.body.trim(), 'Corps.')
})
