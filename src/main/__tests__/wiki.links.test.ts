import test from 'node:test'
import assert from 'node:assert/strict'
import { extractWikilinks, resolveWikilink, backlinks, buildGraph } from '../../shared/wiki/links.js'
import type { Fiche } from '../../shared/wiki/types.js'

const f = (category: Fiche['category'], slug: string, title: string, body = ''): Fiche =>
  ({ slug, category, title, created: '2026-06-14', body })

test('extractWikilinks handles target and target|display', () => {
  const links = extractWikilinks('Voir [[kiran]] et [[lieux/laikipia|Laikipia]].')
  assert.equal(links.length, 2)
  assert.deepEqual({ t: links[0].target, d: links[0].display }, { t: 'kiran', d: 'kiran' })
  assert.deepEqual({ t: links[1].target, d: links[1].display }, { t: 'lieux/laikipia', d: 'Laikipia' })
})

test('resolveWikilink: exact path, then unique slug, then title (accent/case-insensitive)', () => {
  const fiches = [f('personnages', 'kiran', 'Kiran'), f('lieux', 'laikipia', 'Laikipia')]
  assert.equal(resolveWikilink('lieux/laikipia', fiches)?.slug, 'laikipia')
  assert.equal(resolveWikilink('kiran', fiches)?.slug, 'kiran')
  assert.equal(resolveWikilink('LAÏKIPIA', fiches)?.slug, 'laikipia')
  assert.equal(resolveWikilink('inconnu', fiches), null)
})

test('resolveWikilink returns null on ambiguous slug', () => {
  const fiches = [f('personnages', 'x', 'Perso X'), f('lieux', 'x', 'Lieu X')]
  assert.equal(resolveWikilink('x', fiches), null)
})

test('backlinks finds fiches linking to a target', () => {
  const fiches = [
    f('personnages', 'kiran', 'Kiran', 'ami de [[nkosigai]]'),
    f('personnages', 'nkosigai', 'Nkosigai', 'seule'),
    f('lieux', 'laikipia', 'Laikipia', 'terre de [[nkosigai]]')
  ]
  const target = fiches[1]
  const back = backlinks(target, fiches).map((x: Fiche) => x.slug).sort()
  assert.deepEqual(back, ['kiran', 'laikipia'])
})

test('buildGraph yields nodes and dedup edges, no self-loop', () => {
  const fiches = [
    f('personnages', 'kiran', 'Kiran', '[[nkosigai]] [[nkosigai]] [[kiran]]'),
    f('personnages', 'nkosigai', 'Nkosigai', '')
  ]
  const g = buildGraph(fiches)
  assert.equal(g.nodes.length, 2)
  assert.deepEqual(g.edges, [[0, 1]])
})
