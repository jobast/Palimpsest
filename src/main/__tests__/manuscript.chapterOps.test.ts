import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultChapterDoc, markItemUnreadable, duplicateItem, planChapterSave } from '../../shared/manuscript/chapterOps.js'
import type { ManuscriptItem } from '../../shared/types/project.js'

const chapter = (id: string, extra: Partial<ManuscriptItem> = {}): ManuscriptItem => ({
  id, type: 'chapter', title: id, status: 'draft', wordCount: 0, ...extra
})

test('the default chapter document is a title plus an empty first paragraph', () => {
  assert.deepEqual(defaultChapterDoc('Un'), {
    type: 'doc',
    content: [
      { type: 'chapterTitle', content: [{ type: 'text', text: 'Un' }] },
      { type: 'firstParagraph', content: [] }
    ]
  })
})

test('markItemUnreadable marks one item, deep, without touching the others', () => {
  const items = [chapter('a'), chapter('b', { children: [chapter('b1')] })]
  const marked = markItemUnreadable(items, 'b1')
  assert.equal(marked[1].children![0].loadState, 'unreadable')
  assert.equal(marked[0].loadState, undefined)
  assert.equal(items[1].children![0].loadState, undefined, 'entrée non mutée')
})

test('a duplicate never inherits loadState and reports its id pairs', () => {
  let n = 0
  const source = chapter('src', { loadState: 'unreadable', synopsis: 'résumé', children: [chapter('kid', { loadState: 'exact' })] })
  const { clone, idPairs } = duplicateItem(source, () => `new-${++n}`)
  assert.equal(clone.id, 'new-1')
  assert.equal(clone.title, 'src (copie)')
  assert.equal(clone.synopsis, 'résumé')
  assert.equal(clone.loadState, undefined)
  assert.equal(clone.children![0].id, 'new-2')
  assert.equal(clone.children![0].title, 'kid', 'seul le titre racine reçoit le suffixe')
  assert.equal(clone.children![0].loadState, undefined)
  assert.deepEqual(idPairs, [{ from: 'src', to: 'new-1' }, { from: 'kid', to: 'new-2' }])
})

test('planChapterSave never rewrites a chapter it could not read', () => {
  assert.deepEqual(planChapterSave(chapter('a', { loadState: 'unreadable' }), '{"type":"doc","content":[]}'), { action: 'skip', reason: 'unreadable' })
})

test('planChapterSave never rewrites a loaded chapter whose content is not in memory', () => {
  assert.deepEqual(planChapterSave(chapter('a', { loadState: 'exact' }), undefined), { action: 'skip', reason: 'no-content' })
  assert.deepEqual(planChapterSave(chapter('a', { loadState: 'fromMarkdown' }), undefined), { action: 'skip', reason: 'no-content' })
})

test('planChapterSave writes the default document for a chapter created in session', () => {
  assert.deepEqual(planChapterSave(chapter('a', { title: 'Neuf' }), undefined), { action: 'write', doc: defaultChapterDoc('Neuf') })
})

test('planChapterSave writes the in-memory document, and skips it when unparsable', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] }
  assert.deepEqual(planChapterSave(chapter('a', { loadState: 'exact' }), JSON.stringify(doc)), { action: 'write', doc })
  assert.deepEqual(planChapterSave(chapter('a', { loadState: 'exact' }), '{oops'), { action: 'skip', reason: 'invalid-content' })
})
