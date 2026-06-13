import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import test from 'node:test'
import { assertProjectRootPath, assertProjectScopedPath } from '../projectPaths.js'

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

test('assertProjectScopedPath allows valid project files', async () => {
  const sandbox = createTempDir('palim-paths-')
  const projectRoot = path.join(sandbox, 'book.palim')
  const manuscriptDir = path.join(projectRoot, 'manuscript')
  const targetFile = path.join(manuscriptDir, 'structure.json')

  try {
    await fs.promises.mkdir(manuscriptDir, { recursive: true })
    await fs.promises.writeFile(targetFile, '{}', 'utf-8')

    const scoped = await assertProjectScopedPath(targetFile)

    assert.equal(scoped.projectRoot, projectRoot)
    assert.equal(scoped.safeProjectRoot, await fs.promises.realpath(projectRoot))
    assert.equal(scoped.safePath, await fs.promises.realpath(targetFile))
  } finally {
    await fs.promises.rm(sandbox, { recursive: true, force: true })
  }
})

test('assertProjectScopedPath blocks symlink escape outside project', async () => {
  const sandbox = createTempDir('palim-paths-')
  const projectRoot = path.join(sandbox, 'book.palim')
  const outsideDir = path.join(sandbox, 'outside')
  const escapedFile = path.join(outsideDir, 'secret.txt')
  const symlinkPath = path.join(projectRoot, 'linked')

  try {
    await fs.promises.mkdir(projectRoot, { recursive: true })
    await fs.promises.mkdir(outsideDir, { recursive: true })
    await fs.promises.writeFile(escapedFile, 'top secret', 'utf-8')

    try {
      await fs.promises.symlink(outsideDir, symlinkPath, 'dir')
    } catch {
      return
    }

    await assert.rejects(
      async () => assertProjectScopedPath(path.join(symlinkPath, 'secret.txt')),
      /Acces refuse/
    )
  } finally {
    await fs.promises.rm(sandbox, { recursive: true, force: true })
  }
})

test('assertProjectRootPath rejects non-root project paths', async () => {
  const sandbox = createTempDir('palim-paths-')
  const projectRoot = path.join(sandbox, 'book.palim')
  const childPath = path.join(projectRoot, 'manuscript')

  try {
    await fs.promises.mkdir(childPath, { recursive: true })
    await assert.rejects(
      async () => assertProjectRootPath(childPath),
      /Chemin projet invalide/
    )
  } finally {
    await fs.promises.rm(sandbox, { recursive: true, force: true })
  }
})
