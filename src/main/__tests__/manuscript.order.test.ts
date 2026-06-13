import test from 'node:test'
import assert from 'node:assert/strict'
import { flattenChapterIds } from '../../shared/manuscript/order.js'
import type { ManuscriptItem } from '../../shared/types/project.js'

const chapter = (id: string, children?: ManuscriptItem[]): ManuscriptItem => ({
  id, type: 'chapter', title: id, status: 'draft', wordCount: 0, children
})

test('flat list preserves order', () => {
  const items = [chapter('a'), chapter('b'), chapter('c')]
  assert.deepEqual(flattenChapterIds(items), ['a', 'b', 'c'])
})

test('nested children are flattened depth-first in order', () => {
  const items = [chapter('a', [chapter('a1'), chapter('a2')]), chapter('b')]
  assert.deepEqual(flattenChapterIds(items), ['a', 'a1', 'a2', 'b'])
})

test('empty list yields empty array', () => {
  assert.deepEqual(flattenChapterIds([]), [])
})
