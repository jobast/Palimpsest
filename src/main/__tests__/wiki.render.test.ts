import test from 'node:test'
import assert from 'node:assert/strict'
import { wikilinksToMarkdown, stripHtmlComments } from '../../shared/wiki/links.js'

test('stripHtmlComments removes internal ingest markers', () => {
  assert.equal(stripHtmlComments('Avant\n<!-- ingest:abc-123 -->\nAprès'), 'Avant\nAprès')
  assert.equal(stripHtmlComments('Texte sans commentaire.'), 'Texte sans commentaire.')
})

test('converts [[target]] to a wiki: markdown link', () => {
  assert.equal(wikilinksToMarkdown('Voir [[kiran]] ici.'), 'Voir [kiran](wiki:kiran) ici.')
})

test('converts [[target|display]] keeping the display text', () => {
  assert.equal(wikilinksToMarkdown('Voir [[personnages/kiran|Kiran]].'), 'Voir [Kiran](wiki:personnages%2Fkiran).')
})

test('converts several links in one body', () => {
  assert.equal(wikilinksToMarkdown('[[a]] et [[b]]'), '[a](wiki:a) et [b](wiki:b)')
})

test('leaves text without wikilinks unchanged', () => {
  assert.equal(wikilinksToMarkdown('# Titre\nPas de lien.'), '# Titre\nPas de lien.')
})
