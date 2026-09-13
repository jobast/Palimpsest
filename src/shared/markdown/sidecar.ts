import type { TipTapDoc } from './types.js'

/**
 * Per-chapter sidecar: the exact TipTap document, source of truth when its
 * mdHash matches the .md on disk. Named by chapter id (stable across renames).
 */
export const SIDECAR_VERSION = 1 as const
export const SIDECAR_DIR = 'chapitres/.palim'

export interface ChapterSidecar {
  version: typeof SIDECAR_VERSION
  mdHash: string    // sha256Hex of the full .md text as written
  savedAt: string   // ISO date
  doc: TipTapDoc
}

export type SidecarParseResult =
  | { ok: true; sidecar: ChapterSidecar }
  | { ok: false; reason: 'corrupt' | 'unknown-version' | 'invalid-doc' }

/**
 * Chapter ids come from project.json, which the app does not own alone. Only a
 * plain id may become a path: `../../project` would resolve inside the .palim
 * root and let the save loop overwrite the manifest.
 */
export function isSafeChapterId(chapterId: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(chapterId)
}

export function sidecarPath(chapterId: string): string {
  if (!isSafeChapterId(chapterId)) throw new Error('Identifiant de chapitre invalide')
  return `${SIDECAR_DIR}/${chapterId}.json`
}

export function stringifySidecar(sidecar: ChapterSidecar): string {
  return JSON.stringify(sidecar, null, 2) + '\n'
}

export function parseSidecar(text: string): SidecarParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'corrupt' }
  }
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'corrupt' }
  const obj = raw as Record<string, unknown>
  if (obj.version !== SIDECAR_VERSION) return { ok: false, reason: 'unknown-version' }
  const doc = obj.doc as Record<string, unknown> | undefined
  if (typeof obj.mdHash !== 'string' || !doc || doc.type !== 'doc' || !Array.isArray(doc.content)) {
    return { ok: false, reason: 'invalid-doc' }
  }
  return {
    ok: true,
    sidecar: {
      version: SIDECAR_VERSION,
      mdHash: obj.mdHash,
      savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : '',
      doc: doc as unknown as TipTapDoc
    }
  }
}
