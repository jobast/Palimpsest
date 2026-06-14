import { parseFrontmatter, stringifyFrontmatter } from '../markdown/frontmatter.js'
import type { Alert, AlertType, AlertStatus, Suggestion } from './types.js'

const TYPES: AlertType[] = ['contradiction', 'nom_manquant', 'decision', 'autre']
const STATUSES: AlertStatus[] = ['ouverte', 'resolue']

export function serializeAlert(a: Alert): string {
  return stringifyFrontmatter(
    { type: a.type, titre: a.title, resume: a.resume, cree: a.created, statut: a.status },
    a.body
  )
}

export function parseAlert(md: string, id: string): Alert {
  const { data, body } = parseFrontmatter(md)
  const rawType = typeof data.type === 'string' ? data.type : ''
  const rawStatus = typeof data.statut === 'string' ? data.statut : ''
  return {
    id,
    type: (TYPES as string[]).includes(rawType) ? (rawType as AlertType) : 'autre',
    title: typeof data.titre === 'string' ? data.titre : '',
    resume: typeof data.resume === 'string' ? data.resume : '',
    body,
    created: typeof data.cree === 'string' ? data.cree : '',
    status: (STATUSES as string[]).includes(rawStatus) ? (rawStatus as AlertStatus) : 'ouverte'
  }
}

/** An accepted "incoherence" suggestion becomes a persistent open contradiction alert. */
export function suggestionToAlert(s: Suggestion, today: string): Omit<Alert, 'id'> {
  return {
    type: 'contradiction',
    title: s.title,
    resume: s.resume,
    body: s.body,
    created: today,
    status: 'ouverte'
  }
}
