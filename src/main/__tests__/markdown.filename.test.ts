import test from 'node:test'
import assert from 'node:assert/strict'
import { slugify, chapterFileName, uniqueFileName } from '../../shared/markdown/filename.js'

test('slugify strips accents, lowercases, hyphenates', () => {
  assert.equal(slugify('Le Départ à l’aube'), 'le-depart-a-l-aube')
})

test('slugify falls back to "chapitre" when empty', () => {
  assert.equal(slugify('   ***   '), 'chapitre')
})

test('chapterFileName pads the index to 3 digits', () => {
  assert.equal(chapterFileName(0, 'Le Départ'), '001-le-depart.md')
  assert.equal(chapterFileName(11, 'Fin'), '012-fin.md')
})

test('uniqueFileName appends a numeric suffix on collision', () => {
  const taken = new Set(['001-fin.md'])
  assert.equal(uniqueFileName('001-fin.md', taken), '001-fin-2.md')
  taken.add('001-fin-2.md')
  assert.equal(uniqueFileName('001-fin.md', taken), '001-fin-3.md')
})
