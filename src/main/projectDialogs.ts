import fs from 'fs'
import path from 'path'
import {
  findProjectRoot,
  hasRequiredProjectFiles,
  isPalimProjectPath,
  normalizeProjectPath
} from './projectPaths.js'

export interface OpenDialogSelection {
  canceled: boolean
  filePaths: string[]
}

export interface SaveDialogSelection {
  canceled: boolean
  filePath?: string
}

export interface ValidatedOpenResult {
  canceled: boolean
  filePaths: string[]
  error?: string
}

export interface ValidatedSaveResult {
  canceled: boolean
  filePath?: string
  error?: string
}

async function resolveSelectedProjectPath(selectedPath: string): Promise<{
  projectPath?: string
  error?: string
}> {
  const resolvedSelectedPath = path.resolve(selectedPath)

  if (isPalimProjectPath(resolvedSelectedPath)) {
    const isValidProject = await hasRequiredProjectFiles(resolvedSelectedPath)
    return isValidProject
      ? { projectPath: resolvedSelectedPath }
      : { error: 'Projet invalide: fichiers requis manquants' }
  }

  // Allow selecting a file/folder inside an existing .palim project.
  const projectRootFromChild = findProjectRoot(resolvedSelectedPath)
  if (projectRootFromChild) {
    const isValidProject = await hasRequiredProjectFiles(projectRootFromChild)
    return isValidProject
      ? { projectPath: projectRootFromChild }
      : { error: 'Projet invalide: fichiers requis manquants' }
  }

  // Allow selecting a parent directory containing one .palim project.
  try {
    const stat = await fs.promises.stat(resolvedSelectedPath)
    if (stat.isDirectory()) {
      const entries = await fs.promises.readdir(resolvedSelectedPath, { withFileTypes: true })
      const candidates: string[] = []

      for (const entry of entries) {
        if (!entry.isDirectory() || !isPalimProjectPath(entry.name)) {
          continue
        }

        const candidatePath = path.join(resolvedSelectedPath, entry.name)
        if (await hasRequiredProjectFiles(candidatePath)) {
          candidates.push(candidatePath)
        }
      }

      if (candidates.length === 1) {
        return { projectPath: candidates[0] }
      }
      if (candidates.length > 1) {
        return {
          error: 'Plusieurs projets .palim detectes. Selectionnez directement le bon projet.'
        }
      }
    }
  } catch {
    return { error: 'Impossible de lire le chemin selectionne' }
  }

  return { error: 'Veuillez selectionner un dossier .palim valide' }
}

export async function validateOpenProjectSelection(
  result: OpenDialogSelection
): Promise<ValidatedOpenResult> {
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, filePaths: [] }
  }

  const selectedPath = result.filePaths[0]
  const resolved = await resolveSelectedProjectPath(selectedPath)
  if (!resolved.projectPath) {
    return {
      canceled: true,
      filePaths: [],
      error: resolved.error || 'Projet invalide'
    }
  }

  return { canceled: false, filePaths: [resolved.projectPath] }
}

export function normalizeSaveProjectSelection(
  result: SaveDialogSelection
): ValidatedSaveResult {
  if (result.canceled || !result.filePath) {
    return { canceled: true }
  }

  return {
    canceled: false,
    filePath: normalizeProjectPath(result.filePath)
  }
}
