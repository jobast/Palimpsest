import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFrontmatter, stringifyFrontmatter } from '../../shared/markdown/frontmatter.js'

test('parseFrontmatter extracts YAML data and body', () => {
  const md = '---\nid: abc\ntitle: Le Départ\n---\nIl faisait nuit.\n'
  const { data, body } = parseFrontmatter(md)
  assert.equal(data.id, 'abc')
  assert.equal(data.title, 'Le Départ')
  assert.equal(body, 'Il faisait nuit.\n')
})

test('parseFrontmatter returns empty data when no fence', () => {
  const md = 'Pas de frontmatter ici.'
  const { data, body } = parseFrontmatter(md)
  assert.deepEqual(data, {})
  assert.equal(body, 'Pas de frontmatter ici.')
})

test('parseFrontmatter tolerates a title containing a colon', () => {
  const md = '---\nid: x\ntitle: "Chapitre 1: Le seuil"\n---\nTexte.'
  const { data } = parseFrontmatter(md)
  assert.equal(data.title, 'Chapitre 1: Le seuil')
})

test('stringifyFrontmatter round-trips arbitrary titles', () => {
  const out = stringifyFrontmatter({ id: 'x', title: 'Titre: avec « accents »' }, 'Corps.\n')
  const { data, body } = parseFrontmatter(out)
  assert.equal(data.id, 'x')
  assert.equal(data.title, 'Titre: avec « accents »')
  assert.equal(body, 'Corps.\n')
})

test('parseFrontmatter on corrupt YAML returns empty data, keeps body', () => {
  const md = '---\n: : : bad\n---\nCorps.'
  const { data, body } = parseFrontmatter(md)
  assert.deepEqual(data, {})
  assert.equal(body, 'Corps.')
})
