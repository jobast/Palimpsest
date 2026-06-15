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
      alerts: Array.isArray(v.alerts) ? v.alerts.filter((x): x is string => typeof x === 'string') : [],
      ...(typeof v.chapterHash === 'string' ? { chapterHash: v.chapterHash } : {})
    }
  }
  return { at: '', created: [], appended: [], alerts: [] }
}

export type ChapterStatus = 'never' | 'stale' | 'current'

/** Deterministic content fingerprint (DJB2). Used to detect chapters changed since ingestion. */
export function hashContent(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** Freshness of a chapter vs its integration record. Legacy records (no hash) count as current. */
export function chapterStatus(currentHash: string, record: IntegrationRecord | undefined): ChapterStatus {
  if (!record) return 'never'
  if (!record.chapterHash) return 'current'
  return record.chapterHash === currentHash ? 'current' : 'stale'
}
