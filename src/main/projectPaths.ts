import fs from 'fs'
import path from 'path'

export interface ScopedProjectPath {
  safePath: string
  projectRoot: string
  safeProjectRoot: string
}

export function isPalimProjectPath(projectPath: string): boolean {
  return path.basename(projectPath).toLowerCase().endsWith('.palim')
}

export function normalizeProjectPath(projectPath: string): string {
  if (isPalimProjectPath(projectPath)) {
    return projectPath
  }
  return `${projectPath}.palim`
}

export function findProjectRoot(resolvedPath: string): string | null {
  let current = resolvedPath
  let searching = true
  while (searching) {
    if (isPalimProjectPath(current)) {
      return current
    }
    const parent = path.dirname(current)
    if (parent === current) {
      searching = false
    } else {
      current = parent
    }
  }
  return null
}

async function resolveRealPathAllowMissing(targetPath: string): Promise<string> {
  const resolved = path.resolve(targetPath)
  try {
    return await fs.promises.realpath(resolved)
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code !== 'ENOENT') {
      throw error
    }
    const parent = path.dirname(resolved)
    if (parent === resolved) {
      throw error
    }
    const realParent = await resolveRealPathAllowMissing(parent)
    return path.join(realParent, path.basename(resolved))
  }
}

export async function assertProjectScopedPath(targetPath: string): Promise<ScopedProjectPath> {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('Chemin invalide')
  }

  const resolved = path.resolve(targetPath)
  const projectRoot = findProjectRoot(resolved)

  if (!projectRoot) {
    throw new Error('Acces refuse: chemin hors projet .palim')
  }

  const safePath = await resolveRealPathAllowMissing(resolved)
  const safeProjectRoot = await resolveRealPathAllowMissing(path.resolve(projectRoot))

  if (safePath !== safeProjectRoot && !safePath.startsWith(`${safeProjectRoot}${path.sep}`)) {
    throw new Error('Acces refuse: chemin hors projet .palim')
  }

  return {
    safePath,
    projectRoot: path.resolve(projectRoot),
    safeProjectRoot
  }
}

export async function assertProjectRootPath(projectPath: string): Promise<{
  projectRoot: string
  safeProjectRoot: string
}> {
  const resolved = path.resolve(projectPath)
  const scoped = await assertProjectScopedPath(resolved)

  if (scoped.projectRoot !== resolved || scoped.safePath !== scoped.safeProjectRoot) {
    throw new Error('Chemin projet invalide')
  }

  return {
    projectRoot: scoped.projectRoot,
    safeProjectRoot: scoped.safeProjectRoot
  }
}

export async function hasRequiredProjectFiles(projectPath: string): Promise<boolean> {
  try {
    const { safeProjectRoot } = await assertProjectRootPath(projectPath)
    // The manifest project.json (meta + chapters list) is the single source of
    // truth for a project; the manuscript now lives in chapitres/*.md.
    const requiredFiles = [
      'project.json'
    ]

    for (const relativePath of requiredFiles) {
      await fs.promises.access(path.join(safeProjectRoot, relativePath), fs.constants.R_OK)
    }

    return true
  } catch {
    return false
  }
}

export async function writeFileAtomic(targetPath: string, content: string | Buffer): Promise<void> {
  const tmpPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`
  )
  await fs.promises.writeFile(tmpPath, content)
  try {
    await fs.promises.rename(tmpPath, targetPath)
  } catch (error) {
    await fs.promises.unlink(tmpPath).catch(() => undefined)
    throw error
  }
}

export async function writeTextFileAtomic(targetPath: string, content: string): Promise<void> {
  await writeFileAtomic(targetPath, content)
}
