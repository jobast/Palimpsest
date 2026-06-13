import { create } from 'zustand'
import type {
  Project,
  ProjectMeta,
  ManuscriptStructure,
  ManuscriptItem,
  Sheet,
  UserTypographyOverrides,
  AIReport,
  WritingGoal,
  ManuscriptMode,
  StreakInfo,
  DailyStats,
  StatsData
} from '@shared/types/project'
import { parseChapter, serializeChapter, planChapterFiles, orphanFiles, type ChapterRef } from '@shared/markdown'
import type { TipTapDoc } from '@shared/markdown'
import { aggregateDailyStats } from '@/lib/stats/aggregations'
import { calculateStreak } from '@/lib/stats/calculations'
import { useEditorStore } from './editorStore'
import { useStatsStore } from './statsStore'

// Load reports from disk
const loadReportsFromDisk = async (projectPath: string): Promise<AIReport[]> => {
  try {
    const result = await window.electronAPI.readFile(`${projectPath}/reports/reports.json`)
    if (result.success && result.content) {
      return JSON.parse(result.content)
    }
  } catch { /* ignore */ }
  return []
}

const loadStatsFromDisk = async (projectPath: string): Promise<StatsData> => {
  const sessionsResult = await window.electronAPI.readFile(`${projectPath}/stats/sessions.json`)
  const goalsResult = await window.electronAPI.readFile(`${projectPath}/stats/goals.json`)
  const summaryResult = await window.electronAPI.readFile(`${projectPath}/stats/stats.json`)

  const sessions = safeJsonParse(sessionsResult.content, [])
  const defaultGoals: WritingGoal[] = [
    { type: 'daily', target: 0, current: 0 },
    { type: 'project', target: 0, current: 0 }
  ]
  const goals = safeJsonParse<WritingGoal[]>(goalsResult.content, defaultGoals)

  const summary = safeJsonParse<{
    dailyStats: DailyStats[]
    totalWords: number
    streak: StreakInfo
    manuscriptMode: ManuscriptMode
  }>(summaryResult.content, {
    dailyStats: [],
    totalWords: 0,
    streak: { current: 0, longest: 0, lastWritingDate: '' },
    manuscriptMode: 'drafting'
  })

  const manuscriptMode: ManuscriptMode = summary.manuscriptMode || 'drafting'
  const dailyGoal = goals.find((g: { type: string }) => g.type === 'daily')
  const dailyTarget = dailyGoal?.target ?? 0

  const dailyStats = (summary.dailyStats && summary.dailyStats.length > 0)
    ? summary.dailyStats
    : aggregateDailyStats(sessions, dailyTarget, manuscriptMode)

  const totalWords = typeof summary.totalWords === 'number'
    ? summary.totalWords
    : sessions.reduce((sum: number, s: { netWords: number }) => sum + s.netWords, 0)

  const streak = summary.streak?.current !== undefined
    ? summary.streak
    : calculateStreak(dailyStats)

  return {
    sessions,
    dailyStats,
    goals,
    totalWords,
    streak,
    manuscriptMode
  }
}

const hasElectronAPI = (): boolean => {
  return typeof window !== 'undefined' && window.electronAPI !== undefined
}

// Recent project entry
export interface RecentProject {
  name: string
  author: string
  path: string
  lastOpened: string // ISO date string
}

// Max number of recent projects to keep
const MAX_RECENT_PROJECTS = 10

interface ProjectState {
  project: Project | null
  projectPath: string | null
  isLoading: boolean
  isSaving: boolean  // Prevent concurrent saves
  isDirty: boolean
  lastDirtyAt: number
  activeDocumentId: string | null
  chapterRefs: ChapterRef[]   // id↔file mapping from the manifest (kept stable on save)
  chaptersWithNote: Set<string>   // chapter ids that have a .note.md sidecar
  activeSheetId: string | null  // Currently edited sheet (null = editing manuscript)
  activeReportId: string | null  // Currently viewed report
  activeNoteId: string | null   // chapter id whose private note is open (center view)
  recentProjects: RecentProject[]

  // Actions
  setProject: (project: Project, path: string) => void
  updateProject: (updates: Partial<Project>) => void
  setActiveDocument: (id: string | null) => void
  setActiveSheet: (id: string | null) => void
  setActiveReport: (id: string | null) => void
  setActiveNote: (id: string | null) => void
  setDirty: (dirty: boolean) => void
  addToRecentProjects: (project: RecentProject) => void
  loadRecentProjects: () => void
  openRecentProject: (path: string) => Promise<void>

  // Manuscript actions
  addManuscriptItem: (item: ManuscriptItem, parentId?: string) => void
  updateManuscriptItem: (id: string, updates: Partial<ManuscriptItem>) => void
  renameChapter: (id: string, title: string) => void
  deleteManuscriptItem: (id: string) => void
  duplicateManuscriptItem: (id: string) => void
  reorderManuscriptItems: (items: ManuscriptItem[]) => void

  // Sheet actions
  addSheet: (sheet: Sheet) => void
  updateSheet: (id: string, updates: Partial<Sheet>) => void
  deleteSheet: (id: string) => void
  duplicateSheet: (id: string) => void

  // Report actions
  addReport: (report: AIReport) => void
  updateReport: (id: string, updates: Partial<AIReport>) => void
  deleteReport: (id: string) => void

  // Typography overrides
  updateTypographyOverrides: (overrides: UserTypographyOverrides) => void

  // Chapter note sidecar helpers (.note.md, never in manuscript, never exported)
  getChapterNotePath: (id: string) => string | null
  loadChapterNote: (id: string) => Promise<string>
  saveChapterNote: (id: string, note: string) => Promise<void>
  refreshChaptersWithNote: () => Promise<void>

  // File operations
  createNewProject: (name: string, author: string, template: string, path?: string) => Promise<void>
  openProject: () => Promise<void>
  saveProject: () => Promise<void>
  loadLastProject: () => Promise<void>
}

const createEmptyProject = (name: string, author: string, template: string): Project => ({
  meta: {
    id: crypto.randomUUID(),
    name,
    author,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    template
  },
  manuscript: {
    items: [
      {
        id: crypto.randomUUID(),
        type: 'chapter',
        title: 'Chapitre 1',
        status: 'draft',
        wordCount: 0,
        children: []
      }
    ]
  },
  sheets: {
    characters: [],
    locations: [],
    plots: [],
    notes: []
  },
  stats: {
    sessions: [],
    dailyStats: [],
    goals: [
      { type: 'daily', target: 1000, current: 0 },
      { type: 'project', target: 80000, current: 0 }
    ],
    totalWords: 0,
    streak: { current: 0, longest: 0, lastWritingDate: '' },
    manuscriptMode: 'drafting'
  },
  reports: []
})

// Load recent projects from localStorage
const loadRecentProjectsFromStorage = (): RecentProject[] => {
  try {
    const stored = localStorage.getItem('palimpseste_recentProjects')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// Validate document ID to prevent path traversal attacks
const isValidDocumentId = (id: string): boolean => {
  return /^[a-zA-Z0-9_-]+$/.test(id)
}

const isValidProjectPath = (projectPath: string): boolean => {
  return projectPath.toLowerCase().endsWith('.palim')
}

const findFirstValidDocumentId = (items: ManuscriptItem[]): string | null => {
  for (const item of items) {
    if (isValidDocumentId(item.id)) {
      return item.id
    }
    if (item.children) {
      const childId = findFirstValidDocumentId(item.children)
      if (childId) {
        return childId
      }
    }
  }
  return null
}

// Safe JSON parse with fallback
const safeJsonParse = <T>(content: string | undefined | null, fallback: T): T => {
  if (!content) return fallback
  try {
    return JSON.parse(content) as T
  } catch {
    return fallback
  }
}

const ensureCreateDirectory = async (dirPath: string): Promise<void> => {
  const result = await window.electronAPI.createDirectory(dirPath)
  if (!result.success) {
    throw new Error(`Impossible de creer le dossier: ${dirPath}`)
  }
}

const ensureWriteFile = async (filePath: string, content: string): Promise<void> => {
  const result = await window.electronAPI.writeFile(filePath, content)
  if (!result.success) {
    throw new Error(`Impossible d'ecrire le fichier: ${filePath}`)
  }
}

const ensureBeginSaveJournal = async (projectPath: string): Promise<void> => {
  const result = await window.electronAPI.beginSaveJournal(projectPath)
  if (!result.success) {
    throw new Error(result.error || 'Impossible de demarrer le journal de sauvegarde')
  }
}

const ensureCommitSaveJournal = async (projectPath: string): Promise<void> => {
  const result = await window.electronAPI.commitSaveJournal(projectPath)
  if (!result.success) {
    throw new Error(result.error || 'Impossible de finaliser le journal de sauvegarde')
  }
}

const ensureRecoverSaveJournal = async (projectPath: string): Promise<number> => {
  const result = await window.electronAPI.recoverSaveJournal(projectPath)
  if (!result.success) {
    throw new Error(result.error || 'Impossible de recuperer la sauvegarde interrompue')
  }
  return result.restored ?? 0
}

const recoverPendingSaveIfNeeded = async (projectPath: string): Promise<void> => {
  const hasPending = await window.electronAPI.hasPendingSaveJournal(projectPath)
  if (!hasPending) {
    return
  }

  const restored = await ensureRecoverSaveJournal(projectPath)
  const message = restored > 0
    ? `Recuperation automatique effectuee (${restored} fichier(s) restaure(s))`
    : 'Recuperation automatique effectuee'
  useStatsStore.getState().showNotification('info', message)
}

// Load sheets from disk
const loadSheetsFromDisk = async (projectPath: string): Promise<Project['sheets']> => {
  const sheets: Project['sheets'] = {
    characters: [],
    locations: [],
    plots: [],
    notes: []
  }

  try {
    const charactersResult = await window.electronAPI.readFile(`${projectPath}/sheets/characters.json`)
    if (charactersResult.success && charactersResult.content) {
      sheets.characters = JSON.parse(charactersResult.content)
    }
  } catch { /* ignore */ }

  try {
    const locationsResult = await window.electronAPI.readFile(`${projectPath}/sheets/locations.json`)
    if (locationsResult.success && locationsResult.content) {
      sheets.locations = JSON.parse(locationsResult.content)
    }
  } catch { /* ignore */ }

  try {
    const plotsResult = await window.electronAPI.readFile(`${projectPath}/sheets/plots.json`)
    if (plotsResult.success && plotsResult.content) {
      sheets.plots = JSON.parse(plotsResult.content)
    }
  } catch { /* ignore */ }

  try {
    const notesResult = await window.electronAPI.readFile(`${projectPath}/sheets/notes.json`)
    if (notesResult.success && notesResult.content) {
      sheets.notes = JSON.parse(notesResult.content)
    }
  } catch { /* ignore */ }

  return sheets
}

interface LoadedManuscript {
  items: ManuscriptItem[]
  documentContents: Record<string, string>  // chapterId → TipTap doc JSON string
  chapterRefs: ChapterRef[]                  // for stable filenames on save
}

// Read the manifest's chapter list + each chapitres/*.md into the in-memory model.
const loadManuscriptFromDisk = async (
  projectPath: string,
  chapterRefs: ChapterRef[]
): Promise<LoadedManuscript> => {
  const items: ManuscriptItem[] = []
  const documentContents: Record<string, string> = {}

  for (const ref of chapterRefs) {
    const fileResult = await window.electronAPI.readFile(`${projectPath}/${ref.file}`)
    if (!fileResult.success || !fileResult.content) continue
    const fallbackTitle = ref.file.replace(/^chapitres\//, '').replace(/\.md$/, '')
    const { frontmatter, doc } = parseChapter(fileResult.content, fallbackTitle)
    const id = frontmatter.id || ref.id
    items.push({
      id,
      type: 'chapter',
      title: frontmatter.title,
      status: frontmatter.status ?? 'draft',
      synopsis: frontmatter.synopsis,
      pov: frontmatter.pov,
      wordCount: 0,            // recomputed by the editor/stats, never persisted
      children: []
    })
    documentContents[id] = JSON.stringify(doc)
  }

  return { items, documentContents, chapterRefs }
}

// Save recent projects to localStorage
const saveRecentProjectsToStorage = (projects: RecentProject[]) => {
  localStorage.setItem('palimpseste_recentProjects', JSON.stringify(projects))
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  projectPath: null,
  isLoading: false,
  isSaving: false,
  isDirty: false,
  lastDirtyAt: 0,
  activeDocumentId: null,
  chapterRefs: [],
  chaptersWithNote: new Set<string>(),
  activeSheetId: null,
  activeReportId: null,
  activeNoteId: null,
  recentProjects: loadRecentProjectsFromStorage(),

  setProject: (project, path) => {
    set({ project, projectPath: path, isDirty: false, lastDirtyAt: 0, activeSheetId: null, activeReportId: null, activeNoteId: null, chaptersWithNote: new Set() })
    localStorage.setItem('lastProjectPath', path)
  },

  updateProject: (updates) => {
    const { project } = get()
    if (!project) return
    set({
      project: { ...project, ...updates },
      isDirty: true, lastDirtyAt: Date.now()
    })
  },

  setActiveDocument: (id) => set({
    activeDocumentId: id && isValidDocumentId(id) ? id : null,
    activeSheetId: null,
    activeNoteId: null
  }),

  setActiveSheet: (id) => set({ activeSheetId: id, activeReportId: null, activeNoteId: null }),

  setActiveReport: (id) => set({ activeReportId: id, activeSheetId: null, activeNoteId: null }),

  setActiveNote: (id) => set({
    activeNoteId: id,
    activeDocumentId: null,
    activeSheetId: null,
    activeReportId: null
  }),

  setDirty: (dirty) => set((state) => ({
    isDirty: dirty,
    lastDirtyAt: dirty ? Date.now() : state.lastDirtyAt
  })),

  addToRecentProjects: (recentProject) => {
    const { recentProjects } = get()
    // Remove existing entry with same path
    const filtered = recentProjects.filter(p => p.path !== recentProject.path)
    // Add new entry at the beginning
    const updated = [recentProject, ...filtered].slice(0, MAX_RECENT_PROJECTS)
    set({ recentProjects: updated })
    saveRecentProjectsToStorage(updated)
  },

  loadRecentProjects: () => {
    const projects = loadRecentProjectsFromStorage()
    set({ recentProjects: projects })
  },

  openRecentProject: async (projectPath: string) => {
    if (!hasElectronAPI()) return

    if (!isValidProjectPath(projectPath)) {
      const { recentProjects } = get()
      const updated = recentProjects.filter(p => p.path !== projectPath)
      set({ recentProjects: updated })
      saveRecentProjectsToStorage(updated)
      useStatsStore.getState().showNotification('error', 'Chemin de projet invalide (.palim requis)')
      return
    }

    const exists = await window.electronAPI.exists(projectPath)
    if (!exists) {
      // Remove from recent projects if it doesn't exist
      const { recentProjects } = get()
      const updated = recentProjects.filter(p => p.path !== projectPath)
      set({ recentProjects: updated })
      saveRecentProjectsToStorage(updated)
      useStatsStore.getState().showNotification('error', 'Projet introuvable')
      return
    }

    set({ isLoading: true })
    try {
      await recoverPendingSaveIfNeeded(projectPath)

      const metaResult = await window.electronAPI.readFile(`${projectPath}/project.json`)
      if (!metaResult.success || !metaResult.content) {
        throw new Error('Impossible de lire project.json')
      }
      const manifest = JSON.parse(metaResult.content) as Record<string, unknown> & { chapters?: ChapterRef[] }
      const { chapters: chapterRefsRaw, ...rest } = manifest
      const chapterRefs: ChapterRef[] = Array.isArray(chapterRefsRaw) ? chapterRefsRaw : []
      const meta = rest as unknown as ProjectMeta

      const stats = await loadStatsFromDisk(projectPath)
      const sheets = await loadSheetsFromDisk(projectPath)
      const reports = await loadReportsFromDisk(projectPath)

      const loaded = await loadManuscriptFromDisk(projectPath, chapterRefs)
      const manuscript: ManuscriptStructure = { items: loaded.items }

      const project: Project = { meta, manuscript, sheets, stats, reports }

      useStatsStore.getState().setProjectId(meta.id)
      useStatsStore.getState().loadStats(stats)
      useEditorStore.getState().loadUserOverrides(meta.typographyOverrides || {})

      const editorStore = useEditorStore.getState()
      editorStore.clearDocumentContents()
      editorStore.loadDocumentContents(loaded.documentContents)

      // Now set state with activeDocumentId (after documents are loaded)
      set({
        project,
        projectPath,
        isLoading: false,
        isDirty: false,
        lastDirtyAt: 0,
        chapterRefs: loaded.chapterRefs,
        activeDocumentId: findFirstValidDocumentId(manuscript.items)
      })
      void get().refreshChaptersWithNote()

      // Update recent projects
      get().addToRecentProjects({
        name: meta.name,
        author: meta.author || '',
        path: projectPath,
        lastOpened: new Date().toISOString()
      })

      useStatsStore.getState().showNotification('success', 'Projet ouvert')
    } catch (error) {
      console.error('Failed to open recent project:', error)
      set({ isLoading: false })
      useStatsStore.getState().showNotification('error', 'Erreur lors de l\'ouverture du projet')
    }
  },

  addManuscriptItem: (item, parentId) => {
    const { project } = get()
    if (!project) return

    const addToItems = (items: ManuscriptItem[]): ManuscriptItem[] => {
      if (!parentId) {
        return [...items, item]
      }
      return items.map(i => {
        if (i.id === parentId) {
          return { ...i, children: [...(i.children || []), item] }
        }
        if (i.children) {
          return { ...i, children: addToItems(i.children) }
        }
        return i
      })
    }

    set({
      project: {
        ...project,
        manuscript: {
          items: addToItems(project.manuscript.items)
        }
      },
      isDirty: true, lastDirtyAt: Date.now()
    })
  },

  updateManuscriptItem: (id, updates) => {
    const { project } = get()
    if (!project) return

    const updateItems = (items: ManuscriptItem[]): ManuscriptItem[] => {
      return items.map(i => {
        if (i.id === id) {
          return { ...i, ...updates }
        }
        if (i.children) {
          return { ...i, children: updateItems(i.children) }
        }
        return i
      })
    }

    set({
      project: {
        ...project,
        manuscript: {
          items: updateItems(project.manuscript.items)
        }
      },
      isDirty: true, lastDirtyAt: Date.now()
    })
  },

  // Single setter for a chapter title (the source of truth).
  // The TDM and the on-page chapter-title block both go through here.
  renameChapter: (id, title) => {
    get().updateManuscriptItem(id, { title })
  },

  deleteManuscriptItem: (id) => {
    const { project } = get()
    if (!project) return

    const removeFromItems = (items: ManuscriptItem[]): ManuscriptItem[] => {
      return items
        .filter(i => i.id !== id)
        .map(i => {
          if (i.children) {
            return { ...i, children: removeFromItems(i.children) }
          }
          return i
        })
    }

    set({
      project: {
        ...project,
        manuscript: {
          items: removeFromItems(project.manuscript.items)
        }
      },
      isDirty: true, lastDirtyAt: Date.now()
    })
  },

  duplicateManuscriptItem: (id) => {
    const { project } = get()
    if (!project) return

    // Deep clone function for manuscript items
    const cloneItem = (item: ManuscriptItem): ManuscriptItem => ({
      ...item,
      id: crypto.randomUUID(),
      title: `${item.title} (copie)`,
      children: item.children ? item.children.map(cloneItem) : undefined
    })

    // Find and duplicate item
    const duplicateInItems = (items: ManuscriptItem[]): ManuscriptItem[] => {
      const result: ManuscriptItem[] = []
      for (const item of items) {
        result.push(item)
        if (item.id === id) {
          result.push(cloneItem(item))
        } else if (item.children) {
          // Check if item to duplicate is in children
          const newChildren = duplicateInItems(item.children)
          if (newChildren.length !== item.children.length) {
            result[result.length - 1] = { ...item, children: newChildren }
          }
        }
      }
      return result
    }

    set({
      project: {
        ...project,
        manuscript: {
          items: duplicateInItems(project.manuscript.items)
        }
      },
      isDirty: true, lastDirtyAt: Date.now()
    })
  },

  reorderManuscriptItems: (items) => {
    const { project } = get()
    if (!project) return

    set({
      project: {
        ...project,
        manuscript: { items }
      },
      isDirty: true, lastDirtyAt: Date.now()
    })
  },

  addSheet: (sheet) => {
    const { project } = get()
    if (!project) return

    const sheetType = sheet.type as keyof typeof project.sheets
    set({
      project: {
        ...project,
        sheets: {
          ...project.sheets,
          [sheetType + 's']: [...project.sheets[sheetType + 's' as keyof typeof project.sheets], sheet]
        }
      },
      isDirty: true, lastDirtyAt: Date.now()
    })
  },

  updateSheet: (id, updates) => {
    const { project } = get()
    if (!project) return

    const updateSheets = <T extends Sheet>(sheets: T[]): T[] => {
      return sheets.map(s => s.id === id ? { ...s, ...updates } as T : s)
    }

    set({
      project: {
        ...project,
        sheets: {
          characters: updateSheets(project.sheets.characters),
          locations: updateSheets(project.sheets.locations),
          plots: updateSheets(project.sheets.plots),
          notes: updateSheets(project.sheets.notes)
        }
      },
      isDirty: true, lastDirtyAt: Date.now()
    })
  },

  deleteSheet: (id) => {
    const { project } = get()
    if (!project) return

    set({
      project: {
        ...project,
        sheets: {
          characters: project.sheets.characters.filter(s => s.id !== id),
          locations: project.sheets.locations.filter(s => s.id !== id),
          plots: project.sheets.plots.filter(s => s.id !== id),
          notes: project.sheets.notes.filter(s => s.id !== id)
        }
      },
      isDirty: true, lastDirtyAt: Date.now()
    })
  },

  duplicateSheet: (id) => {
    const { project, addSheet, setActiveSheet } = get()
    if (!project) return

    // Find the sheet to duplicate
    const allSheets: Sheet[] = [
      ...project.sheets.characters,
      ...project.sheets.locations,
      ...project.sheets.plots,
      ...project.sheets.notes
    ]
    const sheet = allSheets.find(s => s.id === id)
    if (!sheet) return

    const now = new Date().toISOString()
    const newSheet: Sheet = {
      ...sheet,
      id: crypto.randomUUID(),
      name: `${sheet.name} (copie)`,
      createdAt: now,
      updatedAt: now
    }

    addSheet(newSheet)
    setActiveSheet(newSheet.id)
  },

  addReport: (report) => {
    const { project } = get()
    if (!project) return

    set({
      project: {
        ...project,
        reports: [...project.reports, report]
      },
      isDirty: true, lastDirtyAt: Date.now()
    })
  },

  updateReport: (id, updates) => {
    const { project } = get()
    if (!project) return

    set({
      project: {
        ...project,
        reports: project.reports.map(r => r.id === id ? { ...r, ...updates } : r)
      },
      isDirty: true, lastDirtyAt: Date.now()
    })
  },

  deleteReport: (id) => {
    const { project, activeReportId } = get()
    if (!project) return

    set({
      project: {
        ...project,
        reports: project.reports.filter(r => r.id !== id)
      },
      activeReportId: activeReportId === id ? null : activeReportId,
      isDirty: true, lastDirtyAt: Date.now()
    })
  },

  updateTypographyOverrides: (overrides) => {
    const { project } = get()
    if (!project) return

    set({
      project: {
        ...project,
        meta: {
          ...project.meta,
          typographyOverrides: Object.keys(overrides).length > 0 ? overrides : undefined
        }
      },
      isDirty: true, lastDirtyAt: Date.now()
    })
  },

  getChapterNotePath: (id) => {
    const { projectPath, chapterRefs } = get()
    const ref = chapterRefs.find(r => r.id === id)
    if (!projectPath || !ref) return null
    return `${projectPath}/${ref.file.replace(/\.md$/, '.note.md')}`
  },

  loadChapterNote: async (id) => {
    const path = get().getChapterNotePath(id)
    if (!path) return ''
    const result = await window.electronAPI.readFile(path)
    return result.success && result.content ? result.content : ''
  },

  saveChapterNote: async (id, note) => {
    const path = get().getChapterNotePath(id)
    if (!path) return
    const next = new Set(get().chaptersWithNote)
    if (note.trim() === '') {
      await window.electronAPI.deleteFile(path)
      next.delete(id)
    } else {
      await window.electronAPI.writeFile(path, note)
      next.add(id)
    }
    set({ chaptersWithNote: next })
  },

  // Probe each chapter's sidecar to know which notes exist (for the TDM item).
  refreshChaptersWithNote: async () => {
    const { projectPath, chapterRefs } = get()
    if (!projectPath) { set({ chaptersWithNote: new Set() }); return }
    const entries = await Promise.all(
      chapterRefs.map(async (ref) => {
        const notePath = `${projectPath}/${ref.file.replace(/\.md$/, '.note.md')}`
        const exists = await window.electronAPI.exists(notePath)
        return exists ? ref.id : null
      })
    )
    set({ chaptersWithNote: new Set(entries.filter((id): id is string => id !== null)) })
  },

  createNewProject: async (name, author, template, providedPath?) => {
    set({ isLoading: true })
    try {
      const project = createEmptyProject(name, author, template)

      // Initialize stats store for this project
      useStatsStore.getState().setProjectId(project.meta.id)
      useStatsStore.getState().loadStats(project.stats)

      // Browser mode: use localStorage
      if (!hasElectronAPI()) {
        const projectPath = `browser://${project.meta.id}`
        localStorage.setItem(`palimpseste_project_${project.meta.id}`, JSON.stringify(project))
        localStorage.setItem('palimpseste_lastProject', project.meta.id)

        set({
          project,
          projectPath,
          isLoading: false,
          isDirty: false,
          lastDirtyAt: 0,
          activeDocumentId: findFirstValidDocumentId(project.manuscript.items)
        })
        return
      }

      // Electron mode: use file system
      let filePath = providedPath

      // If no path provided, ask the user
      if (!filePath) {
        const result = await window.electronAPI.saveProject()
        if (result.canceled || !result.filePath) {
          set({ isLoading: false })
          if (result.error) {
            useStatsStore.getState().showNotification('error', result.error)
          }
          return
        }
        filePath = result.filePath
      }

      const projectPath = isValidProjectPath(filePath)
        ? filePath
        : `${filePath}.palim`

      // Create project directory structure
      await ensureCreateDirectory(projectPath)
      await ensureCreateDirectory(`${projectPath}/chapitres`)
      await ensureCreateDirectory(`${projectPath}/sheets`)
      await ensureCreateDirectory(`${projectPath}/stats`)
      await ensureCreateDirectory(`${projectPath}/reports`)
      await ensureCreateDirectory(`${projectPath}/snapshots`)
      await ensureCreateDirectory(`${projectPath}/trash`)

      // Initial chapter → one .md + manifest entry
      const initialRefs = planChapterFiles(
        project.manuscript.items.map(i => ({ id: i.id, title: i.title })),
        []
      )
      for (const ref of initialRefs) {
        const item = project.manuscript.items.find(i => i.id === ref.id)!
        const md = serializeChapter({
          frontmatter: { id: item.id, title: item.title, status: item.status },
          doc: {
            type: 'doc',
            content: [
              { type: 'chapterTitle', content: [{ type: 'text', text: item.title }] },
              { type: 'firstParagraph', content: [] }
            ]
          }
        })
        await ensureWriteFile(`${projectPath}/${ref.file}`, md)
      }

      // Write project manifest (meta + chapter refs)
      await ensureWriteFile(
        `${projectPath}/project.json`,
        JSON.stringify({ ...project.meta, chapters: initialRefs }, null, 2)
      )

      // Write project files
      await ensureWriteFile(
        `${projectPath}/stats/sessions.json`,
        JSON.stringify(project.stats.sessions, null, 2)
      )
      await ensureWriteFile(
        `${projectPath}/stats/goals.json`,
        JSON.stringify(project.stats.goals, null, 2)
      )
      await ensureWriteFile(
        `${projectPath}/stats/stats.json`,
        JSON.stringify({
          dailyStats: project.stats.dailyStats,
          totalWords: project.stats.totalWords,
          streak: project.stats.streak,
          manuscriptMode: project.stats.manuscriptMode
        }, null, 2)
      )
      await ensureWriteFile(
        `${projectPath}/reports/reports.json`,
        JSON.stringify(project.reports, null, 2)
      )

      set({
        project,
        projectPath,
        chapterRefs: initialRefs,
        chaptersWithNote: new Set(),
        isLoading: false,
        isDirty: false,
        lastDirtyAt: 0,
        activeDocumentId: findFirstValidDocumentId(project.manuscript.items)
      })
      localStorage.setItem('lastProjectPath', projectPath)

      // Clear any old document contents then pre-load initial chapter content
      useEditorStore.getState().clearDocumentContents()
      const initialContents: Record<string, string> = {}
      for (const ref of initialRefs) {
        const item = project.manuscript.items.find(i => i.id === ref.id)!
        initialContents[item.id] = JSON.stringify({
          type: 'doc',
          content: [
            { type: 'chapterTitle', content: [{ type: 'text', text: item.title }] },
            { type: 'firstParagraph', content: [] }
          ]
        })
      }
      useEditorStore.getState().loadDocumentContents(initialContents)

      // Add to recent projects
      get().addToRecentProjects({
        name: project.meta.name,
        author: project.meta.author || '',
        path: projectPath,
        lastOpened: new Date().toISOString()
      })

      useStatsStore.getState().showNotification('success', 'Projet créé')
    } catch (error) {
      console.error('Failed to create project:', error)
      set({ isLoading: false })
      useStatsStore.getState().showNotification('error', 'Erreur lors de la création du projet')
    }
  },

  openProject: async () => {
    // Browser mode: not supported, show alert
    if (!hasElectronAPI()) {
      alert('Ouvrir un projet n\'est pas supporté en mode navigateur. Utilisez Electron.')
      return
    }

    set({ isLoading: true })
    try {
      const currentProjectPath = get().projectPath
      const lastProjectPath = localStorage.getItem('lastProjectPath')
      const suggestedPath = currentProjectPath && !currentProjectPath.startsWith('browser://')
        ? currentProjectPath
        : (lastProjectPath || undefined)

      const result = await window.electronAPI.openProject(suggestedPath)
      if (result.canceled || result.filePaths.length === 0) {
        set({ isLoading: false })
        if (result.error) {
          useStatsStore.getState().showNotification('error', result.error)
          return
        }

        const manualPath = window.prompt(
          'Le sélecteur de fichiers est vide. Collez le chemin complet du projet .palim :',
          suggestedPath || ''
        )
        if (manualPath && manualPath.trim()) {
          await get().openRecentProject(manualPath.trim())
        }
        return
      }

      const projectPath = result.filePaths[0]
      if (!isValidProjectPath(projectPath)) {
        set({ isLoading: false })
        useStatsStore.getState().showNotification('error', 'Chemin de projet invalide (.palim requis)')
        return
      }

      await recoverPendingSaveIfNeeded(projectPath)

      // Read project files
      const metaResult = await window.electronAPI.readFile(`${projectPath}/project.json`)
      if (!metaResult.success || !metaResult.content) {
        throw new Error('Impossible de lire project.json')
      }
      const manifest = JSON.parse(metaResult.content) as Record<string, unknown> & { chapters?: ChapterRef[] }
      const { chapters: chapterRefsRaw, ...rest } = manifest
      const chapterRefs: ChapterRef[] = Array.isArray(chapterRefsRaw) ? chapterRefsRaw : []
      const meta = rest as unknown as ProjectMeta

      const stats = await loadStatsFromDisk(projectPath)
      const sheets = await loadSheetsFromDisk(projectPath)
      const reports = await loadReportsFromDisk(projectPath)

      const loaded = await loadManuscriptFromDisk(projectPath, chapterRefs)
      const manuscript: ManuscriptStructure = { items: loaded.items }

      const project: Project = { meta, manuscript, sheets, stats, reports }

      useStatsStore.getState().setProjectId(meta.id)
      useStatsStore.getState().loadStats(stats)
      useEditorStore.getState().loadUserOverrides(meta.typographyOverrides || {})

      const editorStore = useEditorStore.getState()
      editorStore.clearDocumentContents()
      editorStore.loadDocumentContents(loaded.documentContents)

      // Now set state with activeDocumentId (after documents are loaded)
      set({
        project,
        projectPath,
        isLoading: false,
        isDirty: false,
        lastDirtyAt: 0,
        chapterRefs: loaded.chapterRefs,
        activeDocumentId: findFirstValidDocumentId(manuscript.items)
      })
      void get().refreshChaptersWithNote()
      localStorage.setItem('lastProjectPath', projectPath)

      // Add to recent projects
      get().addToRecentProjects({
        name: meta.name,
        author: meta.author || '',
        path: projectPath,
        lastOpened: new Date().toISOString()
      })

      useStatsStore.getState().showNotification('success', 'Projet ouvert')
    } catch (error) {
      console.error('Failed to open project:', error)
      set({ isLoading: false })
      useStatsStore.getState().showNotification('error', 'Erreur lors de l\'ouverture du projet')
    }
  },

  saveProject: async () => {
    const { project, projectPath, isSaving, activeDocumentId } = get()
    if (!project || !projectPath) return

    // Prevent concurrent saves - queue a retry if changes made during save
    if (isSaving) {
      // Mark as dirty so auto-save will pick it up later
      set({ isDirty: true, lastDirtyAt: Date.now() })
      return
    }

    // Flush current document content to store before saving
    // This ensures any pending debounced updates are captured
    useEditorStore.getState().flushCurrentDocument(activeDocumentId)

    // Get current typography overrides from editor store
    const typographyOverrides = useEditorStore.getState().userTypographyOverrides
    const hasOverrides = Object.keys(typographyOverrides).length > 0
    const stats = useStatsStore.getState().exportStats()
    const saveStartedAt = Date.now()
    let saveJournalStarted = false

    set({ isSaving: true })
    try {
      // Browser mode: save to localStorage
      // Browser mode keeps the in-memory TipTap JSON (no .md files on disk).
      if (!hasElectronAPI() || projectPath.startsWith('browser://')) {
        const projectId = project.meta.id
        const updatedProject = {
          ...project,
          meta: {
            ...project.meta,
            updatedAt: new Date().toISOString(),
            typographyOverrides: hasOverrides ? typographyOverrides : undefined
          },
          stats
        }
        localStorage.setItem(`palimpseste_project_${projectId}`, JSON.stringify(updatedProject))
        set((state) => ({
          project: updatedProject,
          isSaving: false,
          isDirty: state.lastDirtyAt > saveStartedAt
        }))
        useStatsStore.getState().markStatsSaved()
        return
      }

      // Electron mode - include typography overrides
      await ensureBeginSaveJournal(projectPath)
      saveJournalStarted = true

      const updatedMeta = {
        ...project.meta,
        updatedAt: new Date().toISOString(),
        typographyOverrides: hasOverrides ? typographyOverrides : undefined
      }
      const updatedProject: Project = {
        ...project,
        meta: updatedMeta,
        stats
      }
      await ensureWriteFile(
        `${projectPath}/stats/sessions.json`,
        JSON.stringify(stats.sessions, null, 2)
      )
      await ensureWriteFile(
        `${projectPath}/stats/goals.json`,
        JSON.stringify(stats.goals, null, 2)
      )
      await ensureWriteFile(
        `${projectPath}/stats/stats.json`,
        JSON.stringify({
          dailyStats: stats.dailyStats,
          totalWords: stats.totalWords,
          streak: stats.streak,
          manuscriptMode: stats.manuscriptMode
        }, null, 2)
      )

      // --- Manuscript: one .md per chapter + manifest order ---
      const items = project.manuscript.items
      const newRefs = planChapterFiles(
        items.map(i => ({ id: i.id, title: i.title })),
        get().chapterRefs
      )
      const refById = new Map(newRefs.map(r => [r.id, r.file]))
      const docContents = useEditorStore.getState().getAllDocumentContents()

      for (const item of items) {
        const file = refById.get(item.id)
        if (!file) continue
        const json = docContents.get(item.id)
        const doc: TipTapDoc = json
          ? (JSON.parse(json) as TipTapDoc)
          : { type: 'doc', content: [{ type: 'chapterTitle', content: [{ type: 'text', text: item.title }] }] }
        const md = serializeChapter({
          frontmatter: {
            id: item.id,
            title: item.title,
            status: item.status,
            synopsis: item.synopsis,
            pov: item.pov
          },
          doc
        })
        await ensureWriteFile(`${projectPath}/${file}`, md)
      }

      // Delete .md files for removed chapters (journal-aware).
      for (const orphan of orphanFiles(get().chapterRefs, newRefs)) {
        await window.electronAPI.deleteFile(`${projectPath}/${orphan}`)
      }

      // Manifest = meta + ordered chapter refs.
      await ensureWriteFile(
        `${projectPath}/project.json`,
        JSON.stringify({ ...updatedMeta, chapters: newRefs }, null, 2)
      )

      // Save sheets
      await ensureWriteFile(
        `${projectPath}/sheets/characters.json`,
        JSON.stringify(project.sheets.characters, null, 2)
      )
      await ensureWriteFile(
        `${projectPath}/sheets/locations.json`,
        JSON.stringify(project.sheets.locations, null, 2)
      )
      await ensureWriteFile(
        `${projectPath}/sheets/plots.json`,
        JSON.stringify(project.sheets.plots, null, 2)
      )
      await ensureWriteFile(
        `${projectPath}/sheets/notes.json`,
        JSON.stringify(project.sheets.notes, null, 2)
      )

      // Save reports
      await ensureWriteFile(
        `${projectPath}/reports/reports.json`,
        JSON.stringify(project.reports, null, 2)
      )

      await ensureCommitSaveJournal(projectPath)
      saveJournalStarted = false

      set((state) => ({
        project: updatedProject,
        chapterRefs: newRefs,
        isSaving: false,
        isDirty: state.lastDirtyAt > saveStartedAt
      }))
      useStatsStore.getState().markStatsSaved()
      useStatsStore.getState().showNotification('success', 'Projet sauvegardé')
    } catch (error) {
      console.error('Failed to save project:', error)
      if (saveJournalStarted) {
        try {
          const restored = await ensureRecoverSaveJournal(projectPath)
          const rollbackMessage = restored > 0
            ? `Sauvegarde annulee et restauration de ${restored} fichier(s)`
            : 'Sauvegarde annulee'
          useStatsStore.getState().showNotification('info', rollbackMessage)
        } catch (recoveryError) {
          console.error('Failed to recover interrupted save:', recoveryError)
        }
      }
      set({ isSaving: false })
      useStatsStore.getState().showNotification('error', 'Erreur lors de la sauvegarde')
    }
  },

  loadLastProject: async () => {
    // Browser mode: load from localStorage
    if (!hasElectronAPI()) {
      const lastProjectId = localStorage.getItem('palimpseste_lastProject')
      if (!lastProjectId) return

      const savedProject = localStorage.getItem(`palimpseste_project_${lastProjectId}`)
      if (!savedProject) return

      try {
        const project = JSON.parse(savedProject) as Project
        set({
          project,
          projectPath: `browser://${lastProjectId}`,
          isLoading: false,
          isDirty: false,
          lastDirtyAt: 0,
          activeDocumentId: findFirstValidDocumentId(project.manuscript.items)
        })

        // Load typography overrides into editor store
        useEditorStore.getState().loadUserOverrides(project.meta.typographyOverrides || {})

        // Sync stats store
        useStatsStore.getState().setProjectId(project.meta.id)
        useStatsStore.getState().loadStats(project.stats)
      } catch (error) {
        console.error('Failed to load project from localStorage:', error)
      }
      return
    }

    // Electron mode
    const lastPath = localStorage.getItem('lastProjectPath')
    if (!lastPath) return
    if (!isValidProjectPath(lastPath)) {
      localStorage.removeItem('lastProjectPath')
      return
    }

    const exists = await window.electronAPI.exists(lastPath)
    if (!exists) {
      localStorage.removeItem('lastProjectPath')
      return
    }

    await recoverPendingSaveIfNeeded(lastPath)

    set({ isLoading: true })
    try {
      const metaResult = await window.electronAPI.readFile(`${lastPath}/project.json`)
      if (!metaResult.success || !metaResult.content) {
        set({ isLoading: false })
        return
      }
      const manifest = JSON.parse(metaResult.content) as Record<string, unknown> & { chapters?: ChapterRef[] }
      const { chapters: chapterRefsRaw, ...rest } = manifest
      const chapterRefs: ChapterRef[] = Array.isArray(chapterRefsRaw) ? chapterRefsRaw : []
      const meta = rest as unknown as ProjectMeta

      const stats = await loadStatsFromDisk(lastPath)
      const sheets = await loadSheetsFromDisk(lastPath)
      const reports = await loadReportsFromDisk(lastPath)

      const loaded = await loadManuscriptFromDisk(lastPath, chapterRefs)
      const manuscript: ManuscriptStructure = { items: loaded.items }

      const project: Project = { meta, manuscript, sheets, stats, reports }

      useStatsStore.getState().setProjectId(meta.id)
      useStatsStore.getState().loadStats(stats)
      useEditorStore.getState().loadUserOverrides(meta.typographyOverrides || {})

      const editorStore = useEditorStore.getState()
      editorStore.clearDocumentContents()
      editorStore.loadDocumentContents(loaded.documentContents)

      // Now set state with activeDocumentId (after documents are loaded)
      set({
        project,
        projectPath: lastPath,
        isLoading: false,
        isDirty: false,
        lastDirtyAt: 0,
        chapterRefs: loaded.chapterRefs,
        activeDocumentId: findFirstValidDocumentId(manuscript.items)
      })
      void get().refreshChaptersWithNote()
    } catch (error) {
      console.error('Failed to load last project:', error)
      set({ isLoading: false })
      useStatsStore.getState().showNotification('error', 'Erreur lors du chargement du projet')
    }
  }
}))
