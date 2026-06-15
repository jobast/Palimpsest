import type { FicheRef, IntegrationRecord } from './types.js'

export function emptyIntegrationRecord(at: string): IntegrationRecord {
  return { at, created: [], appended: [], alerts: [] }
}

function asRefs(v: unknown): FicheRef[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is FicheRef =>
    !!x && typeof x === 'object' && typeof (x as FicheRef).category === 'string' && typeof (x as FicheRef).slug === 'string')
}

/** Coerce a raw integrations.json value (legacy timestamp string OR structured record) to a record. */
export function toIntegrationRecord(value: unknown): IntegrationRecord {
  if (typeof value === 'string') return { at: value, created: [], appended: [], alerts: [] }
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>
    return {
      at: typeof v.at === 'string' ? v.at : '',
      created: asRefs(v.created),
      appended: asRefs(v.appended),
      alerts: Array.isArray(v.alerts) ? v.alerts.filter((x): x is string => typeof x === 'string') : []
    }
  }
  return { at: '', created: [], appended: [], alerts: [] }
}
