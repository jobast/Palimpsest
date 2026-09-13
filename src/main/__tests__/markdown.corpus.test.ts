import test from 'node:test'
import assert from 'node:assert/strict'
import { docToMarkdownBody, markdownBodyToContent } from '../../shared/markdown/body.js'
import { projectMarkdown } from '../../shared/markdown/projection.js'
import { stringifySidecar, parseSidecar } from '../../shared/markdown/sidecar.js'
import { EDITOR_NODE_AND_MARK_NAMES, CODEC_SUPPORTED_NAMES } from '../../shared/markdown/schemaNames.js'
import { CODEC_CORPUS, SAVANA_FORMAT_SAMPLES } from '../../shared/markdown/__fixtures__/codecCorpus.js'
import type { TipTapDoc } from '../../shared/markdown/types.js'

for (const entry of CODEC_CORPUS) {
  test(`sidecar round-trip is exact: ${entry.name}`, () => {
    const text = stringifySidecar({ version: 1, mdHash: 'h', savedAt: 's', doc: entry.doc })
    const r = parseSidecar(text)
    assert.ok(r.ok)
    if (r.ok) assert.deepEqual(r.sidecar.doc, entry.doc)
  })

  test(`markdown round-trip equals the documented projection: ${entry.name}`, () => {
    const md = docToMarkdownBody(entry.doc)
    const reparsed = markdownBodyToContent(md)
    assert.deepEqual(reparsed, projectMarkdown(entry.doc).content, `via:\n${md}`)
  })

  test(`markdown is stable after one round-trip: ${entry.name}`, () => {
    const md1 = docToMarkdownBody(entry.doc)
    const md2 = docToMarkdownBody({ type: 'doc', content: markdownBodyToContent(md1) })
    assert.equal(md2, md1)
  })

  if (entry.markdownExact) {
    test(`markdown loses nothing but chapterTitle/textAlign:left: ${entry.name}`, () => {
      const stripped = stripDefaults(entry.doc)
      assert.deepEqual(projectMarkdown(entry.doc), stripped)
    })
  }
}

/** Removes chapterTitle and textAlign:'left' (the two lossless normalisations). */
function stripDefaults(doc: TipTapDoc): TipTapDoc {
  const walk = (nodes: TipTapDoc['content']): TipTapDoc['content'] => nodes
    .filter(n => n.type !== 'chapterTitle')
    .map(n => {
      const copy = { ...n }
      if (copy.attrs && 'textAlign' in copy.attrs) {
        const { textAlign, ...rest } = copy.attrs
        void textAlign
        if (Object.keys(rest).length) copy.attrs = rest
        else delete copy.attrs
      }
      if (copy.type === 'firstParagraph') copy.type = 'paragraph'
      if (copy.content) copy.content = walk(copy.content)
      return copy
    })
  const content = walk(doc.content)
  const first = content.find(n => n.type === 'paragraph')
  if (first) first.type = 'firstParagraph'
  return { type: 'doc', content }
}

test('every editor node and mark is known to the codec (schema parity)', () => {
  const missing = EDITOR_NODE_AND_MARK_NAMES.filter(n => !CODEC_SUPPORTED_NAMES.has(n))
  assert.deepEqual(missing, [], `extend body.ts for: ${missing.join(', ')}`)
})

for (const sample of SAVANA_FORMAT_SAMPLES) {
  test(`Savana format: ${sample.name}`, () => {
    const once = markdownBodyToContent(sample.md)
    const paragraphs = once.filter(n => n.type === 'paragraph' || n.type === 'firstParagraph')
    assert.equal(paragraphs.length, sample.paragraphs)
    assert.ok(!once.some(n => n.type === 'bulletList'), 'no dialogue became a bullet list')
    const twice = markdownBodyToContent(docToMarkdownBody({ type: 'doc', content: once }))
    assert.deepEqual(twice, once)
  })
}
