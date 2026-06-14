import test from 'node:test'
import assert from 'node:assert/strict'
import { planChapterFiles, orphanFiles } from '../../shared/markdown/manifest.js'

test('planChapterFiles reuses existing files by id (no churn on rename/reorder)', () => {
  const existing = [
    { id: 'a', file: 'chapitres/001-un.md' },
    { id: 'b', file: 'chapitres/002-deux.md' }
  ]
  // reordered + 'a' renamed in title; ids unchanged
  const items = [{ id: 'b', title: 'Deux' }, { id: 'a', title: 'Un (renommé)' }]
  const refs = planChapterFiles(items, existing)
  assert.deepEqual(refs, [
    { id: 'b', file: 'chapitres/002-deux.md' },
    { id: 'a', file: 'chapitres/001-un.md' }
  ])
})

test('planChapterFiles generates unique files for new chapters', () => {
  const existing = [{ id: 'a', file: 'chapitres/001-fin.md' }]
  const items = [
    { id: 'a', title: 'Fin' },
    { id: 'c', title: 'Fin' },          // same slug → must disambiguate
    { id: 'd', title: 'Nouveau' }
  ]
  const refs = planChapterFiles(items, existing)
  assert.equal(refs[0].file, 'chapitres/001-fin.md')
  assert.equal(refs[1].file, 'chapitres/002-fin.md')
  assert.equal(refs[2].file, 'chapitres/003-nouveau.md')
})

test('orphanFiles returns files no longer referenced', () => {
  const oldRefs = [
    { id: 'a', file: 'chapitres/001-un.md' },
    { id: 'b', file: 'chapitres/002-deux.md' }
  ]
  const newRefs = [{ id: 'a', file: 'chapitres/001-un.md' }]
  assert.deepEqual(orphanFiles(oldRefs, newRefs), ['chapitres/002-deux.md'])
})
