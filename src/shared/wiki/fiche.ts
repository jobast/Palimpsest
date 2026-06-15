import { parseFrontmatter, stringifyFrontmatter } from '../markdown/frontmatter.js'
import { WIKI_CATEGORIES, type Fiche, type WikiCategory } from './types.js'

const KNOWN_KEYS = new Set(['titre', 'categorie', 'cree', 'last_updated', 'sources', 'type'])

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const arr = v.filter((x): x is string => typeof x === 'string')
  return arr.length ? arr : undefined
}

/** chapter .md text → Fiche. Unknown frontmatter keys are preserved in `meta`. */
export function parseFiche(md: string, fallbackSlug: string, fallbackCategory: WikiCategory): Fiche {
  const { data, body } = parseFrontmatter(md)
  const rawCat = typeof data.categorie === 'string' ? data.categorie : ''
  const category = (WIKI_CATEGORIES as string[]).includes(rawCat)
    ? (rawCat as WikiCategory)
    : fallbackCategory
  const title = typeof data.titre === 'string' && data.titre.trim() ? data.titre : fallbackSlug
  const meta: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (!KNOWN_KEYS.has(k)) meta[k] = v
  }
  const fiche: Fiche = {
    slug: fallbackSlug,
    category,
    title,
    created: typeof data.cree === 'string' ? data.cree : '',
    body
  }
  if (typeof data.last_updated === 'string') fiche.lastUpdated = data.last_updated
  const sources = asStringArray(data.sources)
  if (sources) fiche.sources = sources
  if (typeof data.type === 'string') fiche.type = data.type
  if (Object.keys(meta).length) fiche.meta = meta
  return fiche
}

/** Fiche → chapter .md text. Title/category from fields; structured meta re-emitted. */
export function serializeFiche(fiche: Fiche): string {
  const data: Record<string, unknown> = {
    titre: fiche.title,
    categorie: fiche.category,
    cree: fiche.created
  }
  if (fiche.lastUpdated) data.last_updated = fiche.lastUpdated
  if (fiche.sources && fiche.sources.length) data.sources = fiche.sources
  if (fiche.type) data.type = fiche.type
  if (fiche.meta) {
    for (const [k, v] of Object.entries(fiche.meta)) data[k] = v
  }
  return stringifyFrontmatter(data, fiche.body)
}

/** Append a chapter to a fiche's sources (idempotent); refresh lastUpdated only on change. */
export function addSourceToFiche(fiche: Fiche, chapterId: string, today: string): Fiche {
  const sources = fiche.sources ?? []
  if (sources.includes(chapterId)) return fiche
  return { ...fiche, sources: [...sources, chapterId], lastUpdated: today }
}

/**
 * Append a dated section to a fiche body, tagged with an invisible marker
 * `<!-- ingest:<chapterId> -->` so a future "undo integration" can remove
 * exactly this section. Refreshes lastUpdated.
 */
export function appendIngestSection(fiche: Fiche, chapterId: string, sectionBody: string, today: string): Fiche {
  const section = `<!-- ingest:${chapterId} -->\n_(${today})_\n${sectionBody.trim()}`
  const base = fiche.body.trim()
  const body = base ? `${base}\n\n${section}\n` : `${section}\n`
  return { ...fiche, body, lastUpdated: today }
}
