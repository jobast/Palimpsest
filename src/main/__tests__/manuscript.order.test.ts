import test from 'node:test'
import assert from 'node:assert/strict'
import { flattenChapterIds, chaptersToAnalyze } from '../../shared/manuscript/order.js'
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

test('chaptersToAnalyze returns only non-integrated chapters, in order', () => {
  const items = [
    { id: 'a', type: 'chapter', title: 'A', status: 'draft', wordCount: 0 },
    { id: 'b', type: 'chapter', title: 'B', status: 'draft', wordCount: 0 },
    { id: 'c', type: 'chapter', title: 'C', status: 'draft', wordCount: 0 }
  ] as any
  assert.deepEqual(chaptersToAnalyze(items, { b: '2026-06-15' }), ['a', 'c'])
})

test('chaptersToAnalyze ignores folders and scenes', () => {
  const items = [
    { id: 'f', type: 'folder', title: 'Part', status: 'draft', wordCount: 0, children: [
      { id: 'c1', type: 'chapter', title: 'C1', status: 'draft', wordCount: 0 },
      { id: 's1', type: 'scene', title: 'S1', status: 'draft', wordCount: 0 }
    ] }
  ] as any
  assert.deepEqual(chaptersToAnalyze(items, {}), ['c1'])
})

test('chaptersToAnalyze on empty input returns []', () => {
  assert.deepEqual(chaptersToAnalyze([], {}), [])
})
