import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  beginSaveJournal, trackBackupForWrite, recoverSaveJournal
} from '../saveRecovery.js'

test('a deleted file is restored after recovery when backed up in the journal', async () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'palim-del-'))
  const projectRoot = path.join(sandbox, 'book.palim')
  const target = path.join(projectRoot, 'chapitres', '002-deux.md')
  try {
    await fs.promises.mkdir(path.dirname(target), { recursive: true })
    await fs.promises.writeFile(target, 'contenu', 'utf-8')

    await beginSaveJournal(projectRoot)
    await trackBackupForWrite(projectRoot, target)  // same hook deleteFile will use
    await fs.promises.unlink(target)

    const recovery = await recoverSaveJournal(projectRoot)
    assert.equal(recovery.restored, 1)
    assert.equal(await fs.promises.readFile(target, 'utf-8'), 'contenu')
  } finally {
    await fs.promises.rm(sandbox, { recursive: true, force: true })
  }
})
