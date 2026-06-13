import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import test from 'node:test'
import {
  normalizeSaveProjectSelection,
  validateOpenProjectSelection
} from '../projectDialogs.js'

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

test('validateOpenProjectSelection rejects invalid extension', async () => {
  const sandbox = createTempDir('palim-dialogs-')
  const invalidFolder = path.join(sandbox, 'not-a-project')

  try {
    await fs.promises.mkdir(invalidFolder, { recursive: true })
    const result = await validateOpenProjectSelection({
      canceled: false,
      filePaths: [invalidFolder]
    })

    assert.equal(result.canceled, true)
    assert.match(result.error || '', /\.palim/)
  } finally {
    await fs.promises.rm(sandbox, { recursive: true, force: true })
  }
})

test('validateOpenProjectSelection rejects missing required files', async () => {
  const sandbox = createTempDir('palim-dialogs-')
  const projectRoot = path.join(sandbox, 'book.palim')

  try {
    await fs.promises.mkdir(projectRoot, { recursive: true })
    const result = await validateOpenProjectSelection({
      canceled: false,
      filePaths: [projectRoot]
    })

    assert.equal(result.canceled, true)
    assert.match(result.error || '', /fichiers requis/)
  } finally {
    await fs.promises.rm(sandbox, { recursive: true, force: true })
  }
})

test('validateOpenProjectSelection accepts valid project', async () => {
  const sandbox = createTempDir('palim-dialogs-')
  const projectRoot = path.join(sandbox, 'book.palim')

  try {
    await fs.promises.mkdir(path.join(projectRoot, 'manuscript'), { recursive: true })
    await fs.promises.writeFile(path.join(projectRoot, 'project.json'), '{}', 'utf-8')
    await fs.promises.writeFile(path.join(projectRoot, 'manuscript', 'structure.json'), '{}', 'utf-8')

    const result = await validateOpenProjectSelection({
      canceled: false,
      filePaths: [projectRoot]
    })

    assert.equal(result.canceled, false)
    assert.deepEqual(result.filePaths, [projectRoot])
  } finally {
    await fs.promises.rm(sandbox, { recursive: true, force: true })
  }
})

test('normalizeSaveProjectSelection appends .palim', () => {
  const result = normalizeSaveProjectSelection({
    canceled: false,
    filePath: '/tmp/new-book'
  })

  assert.equal(result.canceled, false)
  assert.equal(result.filePath, '/tmp/new-book.palim')
})

test('normalizeSaveProjectSelection keeps existing .palim extension', () => {
  const result = normalizeSaveProjectSelection({
    canceled: false,
    filePath: '/tmp/new-book.palim'
  })

  assert.equal(result.canceled, false)
  assert.equal(result.filePath, '/tmp/new-book.palim')
})
