import { parseFrontmatter, stringifyFrontmatter } from '../markdown/frontmatter.js'
import type { Suggestion, SuggestionType } from './types.js'

const VALID: SuggestionType[] = ['nouvelle_fiche', 'ajout', 'incoherence']

/** Parse the LLM ingest output: blocks separated by "=== SUGGESTION ===". Tolerant. */
export function parseSuggestionsBlock(text: string): Suggestion[] {
  const out: Suggestion[] = []
  const blocks = text.split(/^[ \t]*===\s*SUGGESTION\s*===[ \t]*$/m)
  for (const raw of blocks) {
    const block = raw.trim()
    if (!block || /^AUCUNE SUGGESTION\.?$/i.test(block)) continue
    let type = '', cible = '', title = '', resume = ''
    const bodyLines: string[] = []
    let inBody = false
    for (const line of block.split('\n')) {
      if (inBody) { bodyLines.push(line); continue }
      const m = line.match(/^(TYPE|CIBLE|TITRE|RESUME|CORPS)\s*:\s*(.*)$/i)
      if (!m) continue
      const key = m[1].toUpperCase()
      const val = m[2]
      if (key === 'TYPE') type = val.trim()
      else if (key === 'CIBLE') cible = val.trim()
      else if (key === 'TITRE') title = val.trim()
      else if (key === 'RESUME') resume = val.trim()
      else { inBody = true; if (val.trim()) bodyLines.push(val) }
    }
    if (!(VALID as string[]).includes(type)) continue
    out.push({ id: '', type: type as SuggestionType, cible, title, resume, body: bodyLines.join('\n').trim() })
  }
  return out
}

/** Suggestion → _suggestions/<uuid>.md text. */
export function serializeSuggestion(s: Suggestion): string {
  const data: Record<string, unknown> = { type: s.type, cible: s.cible, titre: s.title, resume: s.resume }
  if (s.sourceChapitre) data.source_chapitre = s.sourceChapitre
  return stringifyFrontmatter(data, s.body)
}

/** _suggestions/<uuid>.md text → Suggestion (id supplied by the store from the filename). */
export function parseSuggestion(md: string, id: string): Suggestion {
  const { data, body } = parseFrontmatter(md)
  const rawType = typeof data.type === 'string' ? data.type : ''
  const type = (VALID as string[]).includes(rawType) ? (rawType as SuggestionType) : 'ajout'
  const s: Suggestion = {
    id,
    type,
    cible: typeof data.cible === 'string' ? data.cible : '',
    title: typeof data.titre === 'string' ? data.titre : '',
    resume: typeof data.resume === 'string' ? data.resume : '',
    body
  }
  if (typeof data.source_chapitre === 'string') s.sourceChapitre = data.source_chapitre
  return s
}
