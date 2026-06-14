import type { Fiche } from './types.js'

export interface MysteryRow {
  slug: string
  title: string
  statut: string
  revelation: string
  fauxPistes: number
  question: string
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Extract the first non-empty line of a "## <heading>" section (accent/case-insensitive). */
function section(body: string, heading: string): string {
  const lines = body.split('\n')
  const target = normalize(heading)
  let inSection = false
  const collected: string[] = []
  for (const line of lines) {
    const h = line.match(/^##\s+(.*)$/)
    if (h) {
      if (inSection) break
      inSection = normalize(h[1].trim()).startsWith(target)
      continue
    }
    if (inSection) collected.push(line)
  }
  return collected.join('\n').trim()
}

function firstLine(text: string): string {
  return text.split('\n').map(s => s.trim()).find(s => s.length > 0) ?? ''
}

function countBullets(text: string): number {
  return text.split('\n').filter(l => /^\s*[-*+]\s+\S/.test(l)).length
}

/** Dashboard rows from fiches whose type is "mystere". */
export function mysteriesOverview(fiches: Fiche[]): MysteryRow[] {
  return fiches.filter(f => f.type === 'mystere').map(f => ({
    slug: f.slug,
    title: f.title,
    statut: firstLine(section(f.body, 'Statut')),
    revelation: firstLine(section(f.body, 'Révélation')),
    fauxPistes: countBullets(section(f.body, 'Fausses pistes')),
    question: firstLine(section(f.body, 'Question')).slice(0, 100)
  }))
}

/** Fiches whose title appears as a whole word in `text` (accent/case-insensitive). */
export function sceneEntities(text: string, fiches: Fiche[]): Fiche[] {
  const norm = normalize(text)
  return fiches.filter(f => {
    const t = normalize(f.title.trim())
    if (!t) return false
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    return re.test(norm)
  })
}
