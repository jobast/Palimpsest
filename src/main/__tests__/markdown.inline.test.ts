import test from 'node:test'
import assert from 'node:assert/strict'
import { serializeInline, parseInline, MARK_ORDER } from '../../shared/markdown/body.js'
import type { TipTapNode } from '../../shared/markdown/types.js'

const t = (text: string, ...marks: string[]): TipTapNode =>
  marks.length ? { type: 'text', text, marks: marks.map(type => ({ type })) } : { type: 'text', text }

test('each supported mark serializes to its delimiter', () => {
  assert.equal(serializeInline([t('g', 'bold')]), '**g**')
  assert.equal(serializeInline([t('i', 'italic')]), '*i*')
  assert.equal(serializeInline([t('b', 'strike')]), '~~b~~')
  assert.equal(serializeInline([t('c', 'code')]), '`c`')
  assert.equal(serializeInline([t('s', 'underline')]), '<u>s</u>')
  assert.equal(serializeInline([t('h', 'highlight')]), '==h==')
})

test('nested marks use a fixed outer-to-inner order regardless of input order', () => {
  const a = serializeInline([t('x', 'bold', 'highlight', 'italic')])
  const b = serializeInline([t('x', 'italic', 'bold', 'highlight')])
  assert.equal(a, '==***x***==')
  assert.equal(a, b)
  assert.deepEqual([...MARK_ORDER], ['highlight', 'underline', 'strike', 'italic', 'bold', 'code'])
})

test('code content is never escaped, other text escapes mark openers only', () => {
  assert.equal(serializeInline([t('a*b `c` ~~d', 'code')]), '`a*b `c` ~~d`')
  assert.equal(serializeInline([t('2 * 3 ~ 4 = 5 <b>')]), '2 \\* 3 ~ 4 = 5 <b>')
  assert.equal(serializeInline([t('a~~b==c`d<u>e</u>')]), 'a\\~~b\\==c\\`d\\<u>e\\</u>')
})

test('hardBreak serializes as a trailing backslash line break', () => {
  assert.equal(serializeInline([t('un'), { type: 'hardBreak' }, t('deux')]), 'un\\\ndeux')
})

test('parseInline reads every mark and sorts marks canonically', () => {
  assert.deepEqual(parseInline('**g** *i* ~~b~~ `c` <u>s</u> ==h=='), [
    t('g', 'bold'), t(' '), t('i', 'italic'), t(' '), t('b', 'strike'), t(' '),
    t('c', 'code'), t(' '), t('s', 'underline'), t(' '), t('h', 'highlight')
  ])
  assert.deepEqual(parseInline('==***x***=='), [t('x', 'highlight', 'italic', 'bold')])
})

test('parseInline: an opener without a closer is plain text', () => {
  assert.deepEqual(parseInline('2 * 3 = 6 et a == b'), [t('2 * 3 = 6 et a == b')])
  assert.deepEqual(parseInline('<u>ouvert sans fin'), [t('<u>ouvert sans fin')])
})

test('parseInline honours escapes, including legacy \\- and \\.', () => {
  assert.deepEqual(parseInline('a\\~~b\\==c\\`d\\<u>e\\</u> \\- \\.'), [t('a~~b==c`d<u>e</u> - .')])
  assert.deepEqual(parseInline('\\*pas italique\\*'), [t('*pas italique*')])
})

test('parseInline: a closer inside a code span does not close an outer mark', () => {
  assert.deepEqual(parseInline('**bold `code**span` end**'), [
    t('bold ', 'bold'), t('code**span', 'bold', 'code'), t(' end', 'bold')
  ])
})

test('inline round-trip for marks and escapable characters', () => {
  // marks are given in canonical order (MARK_ORDER) so deepEqual can hold
  const nodes = [t('« '), t('Été', 'italic', 'bold'), t(' » 2*3 ~~x ==y `z` <u>w</u> \\ fin')]
  assert.deepEqual(parseInline(serializeInline(nodes)), nodes)
})
