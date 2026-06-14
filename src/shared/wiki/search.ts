import type { Fiche, WikiCategory } from './types.js'

export interface SearchHit {
  category: WikiCategory
  slug: string
  title: string
  score: number
  snippet: string
}

const STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'que', 'qui',
  'dans', 'pour', 'par', 'sur', 'avec', 'sans', 'ses', 'son', 'sa', 'ces', 'cet',
  'the', 'and', 'for', 'with'
])

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function queryTerms(query: string): string[] {
  const terms = normalize(query).split(/\W+/).filter(t => t.length >= 3 && !STOPWORDS.has(t))
  return Array.from(new Set(terms))
}

function snippet(text: string, normText: string, term: string, width = 120): string {
  const i = normText.indexOf(term)
  if (i < 0) return ''
  const start = Math.max(0, i - Math.floor(width / 2))
  const end = Math.min(text.length, start + width)
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '')
}

/** Full-text search over fiche title + body. Accent/case-insensitive, scored by occurrences. */
export function searchFiches(fiches: Fiche[], query: string): SearchHit[] {
  const terms = queryTerms(query)
  if (!terms.length) return []
  const hits: SearchHit[] = []
  for (const fiche of fiches) {
    const text = `${fiche.title}\n${fiche.body}`
    const norm = normalize(text)
    let score = 0
    let firstTerm = ''
    for (const term of terms) {
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
      const n = (norm.match(re) ?? []).length
      if (n > 0 && !firstTerm) firstTerm = term
      score += n
    }
    if (score > 0) {
      hits.push({
        category: fiche.category, slug: fiche.slug, title: fiche.title, score,
        snippet: snippet(text, norm, firstTerm)
      })
    }
  }
  hits.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
  return hits
}
