import type { TipTapDoc, TipTapNode } from '../types.js'

const t = (text: string, marks?: Array<{ type: string; attrs?: Record<string, unknown> }>): TipTapNode =>
  marks ? { type: 'text', text, marks } : { type: 'text', text }
const para = (align: string, ...content: TipTapNode[]): TipTapNode => ({ type: 'paragraph', attrs: { textAlign: align }, content })
const title = (text: string): TipTapNode => ({ type: 'chapterTitle', attrs: { textAlign: 'left' }, content: [t(text)] })
const doc = (...content: TipTapNode[]): TipTapDoc => ({ type: 'doc', content })

export interface CorpusEntry {
  name: string
  doc: TipTapDoc
  /** true when the .md projection loses nothing (projectMarkdown(doc) is doc minus chapterTitle/textAlign:left). */
  markdownExact: boolean
}

/** One document per node and mark the editor registers, with realistic TipTap attrs. */
export const CODEC_CORPUS: CorpusEntry[] = [
  { name: 'paragraphs and firstParagraph', markdownExact: true, doc: doc(title('Un'),
    { type: 'firstParagraph', attrs: { textAlign: 'left' }, content: [t('Il faisait nuit.')] },
    para('left', t('Deuxième paragraphe.'))) },
  // Marks are listed in canonical MARK_ORDER and separated by plain spaces (no leading space inside a mark).
  { name: 'all marks, nested', markdownExact: true, doc: doc(title('Marks'),
    para('left', t('g', [{ type: 'bold' }]), t(' '), t('i', [{ type: 'italic' }]), t(' '), t('b', [{ type: 'strike' }]), t(' '),
      t('c', [{ type: 'code' }]), t(' '), t('s', [{ type: 'underline' }]), t(' '),
      t('gi', [{ type: 'italic' }, { type: 'bold' }]), t(' '),
      t('tout', [{ type: 'highlight' }, { type: 'underline' }, { type: 'strike' }, { type: 'italic' }, { type: 'bold' }]))) },
  { name: 'highlight color is sidecar-only', markdownExact: false, doc: doc(title('Couleur'),
    para('left', t('jaune', [{ type: 'highlight', attrs: { color: '#fde047' } }]))) },
  { name: 'textAlign is sidecar-only', markdownExact: false, doc: doc(title('Align'),
    para('center', t('Épigraphe centrée.')), para('right', t('Signature.')),
    { type: 'heading', attrs: { level: 2, textAlign: 'center' }, content: [t('Titre centré')] }) },
  { name: 'headings 1-3', markdownExact: true, doc: doc(title('H'),
    { type: 'heading', attrs: { level: 1, textAlign: 'left' }, content: [t('Un')] },
    { type: 'heading', attrs: { level: 2, textAlign: 'left' }, content: [t('Deux ', [{ type: 'italic' }]), t('trois')] },
    { type: 'heading', attrs: { level: 3, textAlign: 'left' }, content: [t('Trois')] }) },
  { name: 'scene break and horizontal rule', markdownExact: true, doc: doc(title('S'),
    para('left', t('avant')), { type: 'sceneBreak' }, para('left', t('après')), { type: 'horizontalRule' }, para('left', t('fin'))) },
  { name: 'hard breaks', markdownExact: true, doc: doc(title('HB'),
    para('left', t('vers un'), { type: 'hardBreak' }, t('vers deux'), { type: 'hardBreak' }, t('vers trois'))) },
  { name: 'bullet list nested with multi-paragraph item', markdownExact: true, doc: doc(title('L'),
    { type: 'bulletList', content: [
      { type: 'listItem', content: [para('left', t('parent')), { type: 'bulletList', content: [{ type: 'listItem', content: [para('left', t('enfant'))] }] }] },
      { type: 'listItem', content: [para('left', t('premier')), para('left', t('second'))] }
    ] }) },
  { name: 'ordered list with start and type attrs', markdownExact: false, doc: doc(title('O'),
    { type: 'orderedList', attrs: { start: 4, type: null }, content: [
      { type: 'listItem', content: [para('left', t('quatre'))] },
      { type: 'listItem', content: [para('left', t('cinq'))] }
    ] }) },
  { name: 'blockquote with nested blocks', markdownExact: true, doc: doc(title('Q'),
    { type: 'blockquote', content: [para('left', t('Citation.')), { type: 'bulletList', content: [{ type: 'listItem', content: [para('left', t('point'))] }] }] }) },
  { name: 'code block with language and markdown-looking content', markdownExact: true, doc: doc(title('C'),
    { type: 'codeBlock', attrs: { language: 'ts' }, content: [t('const a = 1\n\n*x* - y')] },
    { type: 'codeBlock', attrs: { language: null }, content: [t('brut')] }) },
  { name: 'escapable characters in prose', markdownExact: true, doc: doc(title('E'),
    para('left', t('2 * 3 = 6, a_b, c\\d, `tick`, ~~non~~, ==non==, <u>non</u>, # pas titre')),
    para('left', t('+ pas puce')), para('left', t('* pas puce')), para('left', t('7. pas liste')), para('left', t('> pas citation')), para('left', t('---'))) },
  { name: 'french dialogue dashes', markdownExact: true, doc: doc(title('D'),
    para('left', t('- Bonjour, dit-il.')), para('left', t('- Bonsoir.')), para('left', t('\u2014 Cadratin aussi.'))) },
  { name: 'unknown node and unknown mark', markdownExact: false, doc: doc(title('U'),
    { type: 'callout', attrs: { kind: 'note' }, content: [para('left', t('texte du callout'))] },
    para('left', t('mot', [{ type: 'subscript' }]), t(' normal'))) },
  { name: 'empty paragraph in the middle', markdownExact: false, doc: doc(title('V'),
    para('left', t('a')), para('left'), para('left', t('b'))) },
  { name: 'heading beyond level 3', markdownExact: false, doc: doc(title('H5'),
    { type: 'heading', attrs: { level: 5, textAlign: 'left' }, content: [t('Cinq')] }) }
]

/** Synthetic samples reproducing the patterns found in Savana.palim (never the real prose). */
export const SAVANA_FORMAT_SAMPLES: Array<{ name: string; md: string; paragraphs: number }> = [
  { name: 'single newlines and dialogue dashes', paragraphs: 5, md: [
    'Au club, régnait une ambiance de ville assiégée.',
    "L'arrivée du visiteur avait ravivé la douleur.",
    '- Si la rivière t\'a oublié, c\'est qu\'elle ne t\'a jamais vu, murmura-t-elle.',
    '- Je reviendrai, répondit-il en baissant les yeux.',
    'Dehors, les hommes fumaient.'
  ].join('\n') + '\n' },
  { name: 'pasted notes with deep headings and numbered items', paragraphs: 2, md: [
    'Texte du chapitre.',
    '##### 4. Sa contribution',
    '2. Ce qui est à nuancer',
    '3. Ce que tu peux en tirer',
    'Suite du chapitre.'
  ].join('\n') + '\n' },
  { name: 'two trailing spaces glue lines', paragraphs: 1, md: 'Première ligne  \nsuite de la même strophe.\n' }
]
