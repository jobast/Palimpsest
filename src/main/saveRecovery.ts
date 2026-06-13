import fs from 'fs'
import path from 'path'
import { writeFileAtomic, writeTextFileAtomic } from './projectPaths.js'

export interface SaveRecoveryResult {
  restored: number
}

interface SaveJournalEntry {
  relativePath: string
  backupFile: string
}

interface SaveJournal {
  version: 1
  startedAt: string
  projectRoot: string
  backups: SaveJournalEntry[]
  created: string[]
}

const RECOVERY_DIRNAME = '.recovery'
const ACTIVE_JOURNAL_FILENAME = 'active-save.json'
const BACKUPS_DIRNAME = 'backups'

function getRecoveryDir(projectRoot: string): string {
  return path.join(projectRoot, RECOVERY_DIRNAME)
}

function getBackupsDir(projectRoot: string): string {
  return path.join(getRecoveryDir(projectRoot), BACKUPS_DIRNAME)
}

function getActiveJournalPath(projectRoot: string): string {
  return path.join(getRecoveryDir(projectRoot), ACTIVE_JOURNAL_FILENAME)
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/')
}

function toBackupFilename(relativePath: string, index: number): string {
  const safe = relativePath.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return `${Date.now()}-${index}-${safe}.bak`
}

function isRecoveryInternalPath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath)
  return normalized === RECOVERY_DIRNAME || normalized.startsWith(`${RECOVERY_DIRNAME}/`)
}

async function readActiveJournal(projectRoot: string): Promise<SaveJournal | null> {
  const activeJournalPath = getActiveJournalPath(projectRoot)
  try {
    const raw = await fs.promises.readFile(activeJournalPath, 'utf-8')
    const parsed = JSON.parse(raw) as SaveJournal
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.backups) ||
      typeof parsed.startedAt !== 'string' ||
      typeof parsed.projectRoot !== 'string'
    ) {
      return null
    }
    return {
      ...parsed,
      created: Array.isArray((parsed as Partial<SaveJournal>).created)
        ? (parsed as Partial<SaveJournal>).created as string[]
        : []
    }
  } catch {
    return null
  }
}

async function writeActiveJournal(projectRoot: string, journal: SaveJournal): Promise<void> {
  const activeJournalPath = getActiveJournalPath(projectRoot)
  await writeTextFileAtomic(activeJournalPath, JSON.stringify(journal, null, 2))
}

async function cleanupJournal(projectRoot: string, journal: SaveJournal): Promise<void> {
  const backupsDir = getBackupsDir(projectRoot)
  for (const entry of journal.backups) {
    const backupPath = path.join(backupsDir, entry.backupFile)
    await fs.promises.unlink(backupPath).catch(() => undefined)
  }
  await fs.promises.unlink(getActiveJournalPath(projectRoot)).catch(() => undefined)
}

export async function hasPendingSaveJournal(projectRoot: string): Promise<boolean> {
  const activeJournalPath = getActiveJournalPath(projectRoot)
  try {
    await fs.promises.access(activeJournalPath, fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function beginSaveJournal(projectRoot: string): Promise<void> {
  await fs.promises.mkdir(getRecoveryDir(projectRoot), { recursive: true })
  await fs.promises.mkdir(getBackupsDir(projectRoot), { recursive: true })

  const pendingJournal = await readActiveJournal(projectRoot)
  if (pendingJournal) {
    await recoverSaveJournal(projectRoot)
  }

  const journal: SaveJournal = {
    version: 1,
    startedAt: new Date().toISOString(),
    projectRoot,
    backups: [],
    created: []
  }

  await writeActiveJournal(projectRoot, journal)
}

export async function trackBackupForWrite(projectRoot: string, targetPath: string): Promise<void> {
  const relativePathRaw = path.relative(projectRoot, targetPath)
  if (!relativePathRaw || relativePathRaw === '.' || path.isAbsolute(relativePathRaw)) {
    return
  }

  const normalizedRelativePath = normalizeRelativePath(relativePathRaw)
  if (normalizedRelativePath.startsWith('../') || isRecoveryInternalPath(normalizedRelativePath)) {
    return
  }

  const journal = await readActiveJournal(projectRoot)
  if (!journal) {
    return
  }

  if (journal.backups.some(entry => entry.relativePath === normalizedRelativePath)) {
    return
  }
  if (journal.created.includes(normalizedRelativePath)) {
    return
  }

  try {
    await fs.promises.access(targetPath, fs.constants.F_OK)
  } catch {
    journal.created.push(normalizedRelativePath)
    await writeActiveJournal(projectRoot, journal)
    return
  }

  const backupsDir = getBackupsDir(projectRoot)
  const backupFile = toBackupFilename(normalizedRelativePath, journal.backups.length)
  const backupPath = path.join(backupsDir, backupFile)

  await fs.promises.copyFile(targetPath, backupPath)
  journal.backups.push({
    relativePath: normalizedRelativePath,
    backupFile
  })
  await writeActiveJournal(projectRoot, journal)
}

export async function commitSaveJournal(projectRoot: string): Promise<void> {
  const journal = await readActiveJournal(projectRoot)
  if (!journal) {
    return
  }
  await cleanupJournal(projectRoot, journal)
}

export async function recoverSaveJournal(projectRoot: string): Promise<SaveRecoveryResult> {
  const journal = await readActiveJournal(projectRoot)
  if (!journal) {
    return { restored: 0 }
  }

  const backupsDir = getBackupsDir(projectRoot)
  const failures: string[] = []
  let restored = 0

  for (const entry of [...journal.backups].reverse()) {
    const targetPath = path.join(projectRoot, entry.relativePath)
    const backupPath = path.join(backupsDir, entry.backupFile)

    try {
      const content = await fs.promises.readFile(backupPath)
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true })
      await writeFileAtomic(targetPath, content)
      restored += 1
    } catch {
      failures.push(entry.relativePath)
    }
  }

  for (const createdRelativePath of [...journal.created].reverse()) {
    const targetPath = path.join(projectRoot, createdRelativePath)
    try {
      await fs.promises.unlink(targetPath)
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err.code !== 'ENOENT') {
        failures.push(createdRelativePath)
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`Echec de restauration pour ${failures.length} fichier(s)`)
  }

  await cleanupJournal(projectRoot, journal)
  return { restored }
}
