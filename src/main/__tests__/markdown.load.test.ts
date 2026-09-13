import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveChapterDoc } from '../../shared/markdown/load.js'
import { stringifySidecar } from '../../shared/markdown/sidecar.js'
import { sha256Hex } from '../../shared/markdown/hash.js'

const md = '---\nid: ref\ntitle: Le Départ\nstatus: revision\n---\nIl faisait nuit.\n'
const exactDoc = { type: 'doc' as const, content: [
  { type: 'chapterTitle', attrs: { textAlign: 'left' }, content: [{ type: 'text', text: 'Le Départ' }] },
  { type: 'firstParagraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Il faisait nuit.' }] }
] }

async function sidecarFor(text: string, doc = exactDoc, version = 1) {
  return stringifySidecar({ version: version as 1, mdHash: await sha256Hex(text), savedAt: 's', doc })
}

test('unreadable when the .md cannot be read, whatever the sidecar says', async () => {
  const r = await resolveChapterDoc({ md: null, sidecarText: await sidecarFor(md), refId: 'ref', fallbackTitle: '001-le-depart' })
  assert.equal(r.loadState, 'unreadable')
  assert.equal(r.doc, null)
  assert.equal(r.frontmatter, null)
})

test('exact when the sidecar hash matches: doc from sidecar, frontmatter from md', async () => {
  const r = await resolveChapterDoc({ md, sidecarText: await sidecarFor(md), refId: 'ref', fallbackTitle: 'f' })
  assert.equal(r.loadState, 'exact')
  assert.deepEqual(r.doc, exactDoc)
  assert.equal(r.frontmatter?.title, 'Le Départ')
  assert.equal(r.frontmatter?.status, 'revision')
})

test('fromMarkdown with reason when the sidecar is absent, stale, corrupt or of unknown version', async () => {
  const none = await resolveChapterDoc({ md, sidecarText: null, refId: 'ref', fallbackTitle: 'f' })
  assert.equal(none.loadState, 'fromMarkdown'); assert.equal(none.reason, 'no-sidecar')
  assert.equal(none.doc?.content[1].type, 'firstParagraph')
  assert.equal(none.doc?.content[1].attrs, undefined)  // textAlign not expressible in md

  const stale = await resolveChapterDoc({ md: md + 'Ajout externe.\n', sidecarText: await sidecarFor(md), refId: 'ref', fallbackTitle: 'f' })
  assert.equal(stale.loadState, 'fromMarkdown'); assert.equal(stale.reason, 'hash-mismatch')
  assert.equal(stale.doc?.content.length, 3)

  const corrupt = await resolveChapterDoc({ md, sidecarText: '{ nope', refId: 'ref', fallbackTitle: 'f' })
  assert.equal(corrupt.reason, 'corrupt')

  const future = await resolveChapterDoc({ md, sidecarText: await sidecarFor(md, exactDoc, 2), refId: 'ref', fallbackTitle: 'f' })
  assert.equal(future.reason, 'unknown-version')
})

test('the manifest id always wins', async () => {
  const r = await resolveChapterDoc({ md: '---\nid: autre\ntitle: T\n---\nx\n', sidecarText: null, refId: 'ref', fallbackTitle: 'f' })
  assert.equal(r.frontmatter?.id, 'ref')
})

test('an empty .md is a readable, empty chapter', async () => {
  const r = await resolveChapterDoc({ md: '', sidecarText: null, refId: 'ref', fallbackTitle: '003-le-seuil' })
  assert.equal(r.loadState, 'fromMarkdown')
  assert.equal(r.frontmatter?.title, '003-le-seuil')
  assert.equal(r.doc?.content.length, 2) // chapterTitle + empty firstParagraph
})
