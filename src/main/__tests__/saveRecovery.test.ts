import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import test from 'node:test'
import {
  beginSaveJournal,
  commitSaveJournal,
  hasPendingSaveJournal,
  recoverSaveJournal,
  trackBackupForWrite
} from '../saveRecovery.js'
import { writeTextFileAtomic } from '../projectPaths.js'

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

test('recoverSaveJournal restores the previous file state', async () => {
  const sandbox = createTempDir('palim-recovery-')
  const projectRoot = path.join(sandbox, 'book.palim')
  const targetFile = path.join(projectRoot, 'project.json')

  try {
    await fs.promises.mkdir(projectRoot, { recursive: true })
    await fs.promises.writeFile(targetFile, '{"version":1}', 'utf-8')

    await beginSaveJournal(projectRoot)
    await trackBackupForWrite(projectRoot, targetFile)
    await writeTextFileAtomic(targetFile, '{"version":2}')

    const recovery = await recoverSaveJournal(projectRoot)

    assert.equal(recovery.restored, 1)
    assert.equal(await fs.promises.readFile(targetFile, 'utf-8'), '{"version":1}')
    assert.equal(await hasPendingSaveJournal(projectRoot), false)
  } finally {
    await fs.promises.rm(sandbox, { recursive: true, force: true })
  }
})

test('commitSaveJournal keeps new file content and clears journal', async () => {
  const sandbox = createTempDir('palim-recovery-')
  const projectRoot = path.join(sandbox, 'book.palim')
  const targetFile = path.join(projectRoot, 'project.json')

  try {
    await fs.promises.mkdir(projectRoot, { recursive: true })
    await fs.promises.writeFile(targetFile, '{"version":1}', 'utf-8')

    await beginSaveJournal(projectRoot)
    await trackBackupForWrite(projectRoot, targetFile)
    await writeTextFileAtomic(targetFile, '{"version":2}')
    await commitSaveJournal(projectRoot)

    assert.equal(await fs.promises.readFile(targetFile, 'utf-8'), '{"version":2}')
    assert.equal(await hasPendingSaveJournal(projectRoot), false)
  } finally {
    await fs.promises.rm(sandbox, { recursive: true, force: true })
  }
})

test('recoverSaveJournal removes files created during interrupted save', async () => {
  const sandbox = createTempDir('palim-recovery-')
  const projectRoot = path.join(sandbox, 'book.palim')
  const newFile = path.join(projectRoot, 'manuscript', 'new-doc.json')

  try {
    await fs.promises.mkdir(path.dirname(newFile), { recursive: true })

    await beginSaveJournal(projectRoot)
    await trackBackupForWrite(projectRoot, newFile)
    await writeTextFileAtomic(newFile, '{"draft":true}')

    const recovery = await recoverSaveJournal(projectRoot)

    assert.equal(recovery.restored, 0)
    await assert.rejects(async () => fs.promises.access(newFile))
    assert.equal(await hasPendingSaveJournal(projectRoot), false)
  } finally {
    await fs.promises.rm(sandbox, { recursive: true, force: true })
  }
})
