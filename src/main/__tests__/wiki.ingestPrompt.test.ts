import test from 'node:test'
import assert from 'node:assert/strict'
import { WIKI_SYSTEM_PROMPT, buildWikiUpdatePrompt } from '../../shared/wiki/ingestPrompt.js'

test('system prompt carries the strict charter (no prose)', () => {
  assert.match(WIKI_SYSTEM_PROMPT, /jamais/i)
  assert.match(WIKI_SYSTEM_PROMPT, /prose/i)
  assert.match(WIKI_SYSTEM_PROMPT, /AUCUNE SUGGESTION/)
})

test('update prompt embeds chapter, grille (8 points), fiches summary, output format', () => {
  const p = buildWikiUpdatePrompt({
    chapterTitle: 'Chapitre 1',
    chapterText: 'Marie partit à l\'aube.',
    fichesSummary: 'personnages/marie : Marie',
    pendingSummary: '(rien)',
    mysteriesSummary: ''
  })
  assert.match(p, /Chapitre 1/)
  assert.match(p, /Marie partit/)
  assert.match(p, /personnages\/marie/)
  // grille 8 points present
  for (const kw of ['PERSONNAGES', 'LIEUX', 'INTRIGUES', 'CONTRADICTIONS', 'NOMS MANQUANTS', 'INCERTITUDES', 'CHRONOLOGIE', 'ETATS DE CONNAISSANCE']) {
    assert.match(p, new RegExp(kw))
  }
  // output format
  assert.match(p, /=== SUGGESTION ===/)
  assert.match(p, /TYPE:/)
  assert.match(p, /AUCUNE SUGGESTION/)
})
