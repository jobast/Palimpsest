import { WIKI_CATEGORIES, type Fiche, type WikiCategory } from './types.js'

export function ficheKey(fiche: Fiche): string {
  return `${fiche.category}/${fiche.slug}`
}

export interface FicheGroup { category: WikiCategory; fiches: Fiche[] }

/** Group fiches by category (canonical order), each group sorted by title. Empty groups omitted. */
export function groupFichesByCategory(fiches: Fiche[]): FicheGroup[] {
  const groups: FicheGroup[] = []
  for (const category of WIKI_CATEGORIES) {
    const inCat = fiches.filter(f => f.category === category)
      .sort((a, b) => a.title.localeCompare(b.title))
    if (inCat.length) groups.push({ category, fiches: inCat })
  }
  return groups
}
