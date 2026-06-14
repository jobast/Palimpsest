import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWikiAgentDoc } from '../../shared/wiki/agentDoc.js'

test('agent doc embeds project, categories, frontmatter contract, grille, conventions', () => {
  const doc = buildWikiAgentDoc('Prophéties', 'Jean Bastide')
  assert.match(doc, /Prophéties/)
  // categories
  for (const c of ['personnages', 'lieux', 'intrigues', 'structure', 'ecriture', 'notes']) {
    assert.match(doc, new RegExp(c))
  }
  // read-only chapters reference
  assert.match(doc, /\.\.\/chapitres\//)
  // frontmatter contract keys
  assert.match(doc, /titre:/)
  assert.match(doc, /categorie:/)
  assert.match(doc, /sources:/)
  // grille 8 points
  for (const kw of ['PERSONNAGES', 'CONTRADICTIONS', 'NOMS MANQUANTS', 'ETATS DE CONNAISSANCE']) {
    assert.match(doc, new RegExp(kw))
  }
  // conventions
  assert.match(doc, /non vérifié/)
  assert.match(doc, /jamais.*supprimer|ne jamais supprimer/i)
  assert.match(doc, /cadratin/)
  // wikilinks + sources mechanism
  assert.match(doc, /\[\[/)
  assert.match(doc, /integrations\.json/)
})
