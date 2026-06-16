import test from 'node:test'
import assert from 'node:assert/strict'
import { extractHeadings, headingSlug } from '../../shared/wiki/links.js'

test('headingSlug lowercases, strips accents and non-alnum', () => {
  assert.equal(headingSlug('Traits physiques'), 'traits-physiques')
  assert.equal(headingSlug('Résumé'), 'resume')
  assert.equal(headingSlug('Violence sexuelle (ch. 048)'), 'violence-sexuelle-ch-048')
})

test('extractHeadings captures ## and ### with level + slug, ignores # (h1)', () => {
  const body = '# Anton\n\n## Résumé\ntexte\n\n### Sous-section\n\n## Traits physiques'
  assert.deepEqual(extractHeadings(body), [
    { level: 2, text: 'Résumé', slug: 'resume' },
    { level: 3, text: 'Sous-section', slug: 'sous-section' },
    { level: 2, text: 'Traits physiques', slug: 'traits-physiques' }
  ])
})

test('extractHeadings strips inline markdown from the display text', () => {
  assert.deepEqual(extractHeadings('## **Arc** narratif'), [
    { level: 2, text: 'Arc narratif', slug: 'arc-narratif' }
  ])
})

test('extractHeadings on a body without headings returns []', () => {
  assert.deepEqual(extractHeadings('Juste du texte.'), [])
})
