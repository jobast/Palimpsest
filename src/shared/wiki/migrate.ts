import type { Sheet, CharacterSheet, LocationSheet, PlotSheet, NoteSheet } from '../types/project.js'
import type { Fiche, WikiCategory } from './types.js'
import { slugify } from '../markdown/filename.js'

function datePart(iso: string | undefined): string {
  return typeof iso === 'string' && iso.length >= 10 ? iso.slice(0, 10) : ''
}

/** Collect defined extra fields into a meta bag (drops undefined, null, empty string). */
function meta(obj: Record<string, unknown>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && !(typeof v === 'string' && v === '')) out[k] = v
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * Convert one sheet to a wiki fiche. The free-text becomes the body (LLM-maintained);
 * every structured field is preserved in `meta` so specialized editors keep working.
 */
export function sheetToFiche(sheet: Sheet): Fiche {
  const created = datePart(sheet.createdAt)
  const lastUpdated = datePart(sheet.updatedAt) || undefined
  const baseSlug = slugify(sheet.name || sheet.id)

  if (sheet.type === 'character') {
    const s = sheet as CharacterSheet
    const f: Fiche = { slug: baseSlug, category: 'personnages', title: s.name || baseSlug, created, body: s.description ?? '' }
    if (lastUpdated) f.lastUpdated = lastUpdated
    const m = meta({ role: s.role, physicalDescription: s.physicalDescription, backstory: s.backstory, goals: s.goals, flaws: s.flaws, relationships: s.relationships, notes: s.notes, imageUrl: s.imageUrl })
    if (m) f.meta = m
    return f
  }
  if (sheet.type === 'location') {
    const s = sheet as LocationSheet
    const f: Fiche = { slug: baseSlug, category: 'lieux', title: s.name || baseSlug, created, body: s.description ?? '' }
    if (lastUpdated) f.lastUpdated = lastUpdated
    const m = meta({ coordinates: s.coordinates, mapZoom: s.mapZoom, significance: s.significance, sensoryDetails: s.sensoryDetails, notes: s.notes, imageUrl: s.imageUrl })
    if (m) f.meta = m
    return f
  }
  if (sheet.type === 'plot') {
    const s = sheet as PlotSheet
    const f: Fiche = { slug: baseSlug, category: 'intrigues', title: s.name || baseSlug, created, body: s.description ?? '' }
    if (lastUpdated) f.lastUpdated = lastUpdated
    const m = meta({ plotType: s.plotType, acts: s.acts, keyEvents: s.keyEvents, notes: s.notes })
    if (m) f.meta = m
    return f
  }
  // note
  const s = sheet as NoteSheet
  const f: Fiche = { slug: baseSlug, category: 'notes', title: s.name || baseSlug, created, body: s.content ?? '' }
  if (lastUpdated) f.lastUpdated = lastUpdated
  const m = meta({ tags: s.tags })
  if (m) f.meta = m
  return f
}

/**
 * Map a list of sheets to fiches, disambiguating slugs within each category.
 */
export function sheetsToFiches(sheets: Sheet[]): Fiche[] {
  const takenByCat = new Map<WikiCategory, Set<string>>()
  return sheets.map(sheet => {
    const fiche = sheetToFiche(sheet)
    const taken = takenByCat.get(fiche.category) ?? new Set<string>()
    let slug = fiche.slug, i = 2
    while (taken.has(slug)) { slug = `${fiche.slug}-${i}`; i += 1 }
    taken.add(slug)
    takenByCat.set(fiche.category, taken)
    return { ...fiche, slug }
  })
}
